import { eq } from 'drizzle-orm';
import { Severity, VULN_ACTIVE_STATUSES } from '@vacti/core';
import {
  renderVaReport,
  renderPdf,
  DEFAULT_VA_SETTINGS,
  type Lang,
  type ReportSettings,
  type Signatory,
} from '@vacti/reports';
import {
  scans,
  targets,
  endpoints,
  vulnerabilities,
  subdomains,
  ports as portsTable,
  reportSettings,
  reportSignatories,
} from '@vacti/db';
import { getDb } from '../../../../lib/db';
import { getCurrentUser } from '../../../../lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const active = new Set<string>(VULN_ACTIVE_STATUSES);

export async function GET(req: Request, ctx: { params: Promise<{ scanId: string }> }) {
  if (!(await getCurrentUser())) return new Response('Unauthorized', { status: 401 });
  const { scanId } = await ctx.params;
  const url = new URL(req.url);
  const lang = (url.searchParams.get('lang') === 'id' ? 'id' : 'en') as Lang;
  const t = url.searchParams.get('type');
  const type = t === 'recon' || t === 'vuln' ? t : 'full';
  const db = getDb();

  const [scan] = await db.select().from(scans).where(eq(scans.id, scanId));
  if (!scan) return new Response('Not found', { status: 404 });
  const [target] = await db.select().from(targets).where(eq(targets.id, scan.targetId));
  const [eps, vulns, subs, prt, settingRows, signRows] = await Promise.all([
    db.select().from(endpoints).where(eq(endpoints.scanId, scanId)),
    db.select().from(vulnerabilities).where(eq(vulnerabilities.scanId, scanId)),
    db.select().from(subdomains).where(eq(subdomains.scanId, scanId)),
    db.select().from(portsTable).where(eq(portsTable.scanId, scanId)),
    db.select().from(reportSettings).where(eq(reportSettings.projectId, scan.projectId)),
    db.select().from(reportSignatories).where(eq(reportSignatories.projectId, scan.projectId)),
  ]);

  const sevCount = (sv: number) => vulns.filter((v) => v.severity === sv && active.has(v.status)).length;
  const settingRow = settingRows.find((s) => s.kind === 'va');
  const settings: ReportSettings = settingRow
    ? { ...DEFAULT_VA_SETTINGS, ...stripNulls(settingRow) }
    : DEFAULT_VA_SETTINGS;
  const signatories: Signatory[] = signRows
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((s) => ({ role: s.role as Signatory['role'], name: s.name, position: s.position }));

  const html = renderVaReport({
    lang,
    type,
    settings,
    signatories,
    target: { domain: target?.domain ?? scan.targetId },
    scan: { status: scan.status, startedAt: scan.startedAt, finishedAt: scan.finishedAt },
    counts: { subdomains: subs.length, endpoints: eps.length, ports: prt.length },
    severityCounts: [
      sevCount(Severity.Critical),
      sevCount(Severity.High),
      sevCount(Severity.Medium),
      sevCount(Severity.Low),
      sevCount(Severity.Info),
    ],
    endpoints: eps.map((e) => ({ url: e.url, statusCode: e.statusCode, title: e.title })),
    vulns: vulns.map((v) => ({
      name: v.name,
      severity: v.severity,
      status: v.status,
      matchedAt: v.matchedAt,
      type: v.type,
    })),
  });
  const pdf = await renderPdf(html);
  const name = `va_report_${(target?.domain ?? 'scan').replace(/\./g, '_')}_${type}.pdf`;
  return new Response(new Uint8Array(pdf), {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${name}"` },
  });
}

function stripNulls<T extends Record<string, unknown>>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined)) as Partial<T>;
}
