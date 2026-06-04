import { eq } from 'drizzle-orm';
import {
  renderTiReport,
  renderPdf,
  DEFAULT_TI_SETTINGS,
  type Lang,
  type ReportSettings,
  type Signatory,
} from '@vacti/reports';
import { computeProjectRisk } from '@vacti/threat-intel';
import {
  projects,
  otxThreatData,
  leakcheckData,
  manualIndicators,
  reportSettings,
  reportSignatories,
  threatIntelStatus,
} from '@vacti/db';
import { getDb } from '../../../../lib/db';
import { getCurrentUser } from '../../../../lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request, ctx: { params: Promise<{ projectId: string }> }) {
  if (!(await getCurrentUser())) return new Response('Unauthorized', { status: 401 });
  const { projectId } = await ctx.params;
  const langParam = new URL(req.url).searchParams.get('lang');
  const db = getDb();

  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!project) return new Response('Not found', { status: 404 });

  const [risk, otx, leaks, indicators, settingRows, signRows, tiStatusRows] = await Promise.all([
    computeProjectRisk(db, projectId),
    db.select().from(otxThreatData).where(eq(otxThreatData.projectId, projectId)),
    db.select().from(leakcheckData).where(eq(leakcheckData.projectId, projectId)),
    db.select().from(manualIndicators).where(eq(manualIndicators.projectId, projectId)),
    db.select().from(reportSettings).where(eq(reportSettings.projectId, projectId)),
    db.select().from(reportSignatories).where(eq(reportSignatories.projectId, projectId)),
    db.select().from(threatIntelStatus).where(eq(threatIntelStatus.projectId, projectId)),
  ]);

  const settingRow = settingRows.find((s) => s.kind === 'ti');
  const settings: ReportSettings = settingRow
    ? { ...DEFAULT_TI_SETTINGS, ...stripNulls(settingRow) }
    : DEFAULT_TI_SETTINGS;
  // Explicit ?lang wins; otherwise fall back to the saved report language.
  const lang = (langParam === 'id' || langParam === 'en' ? langParam : (settingRow?.language ?? 'en')) as Lang;
  const signatories: Signatory[] = signRows
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((s) => ({
      role: s.role as Signatory['role'],
      name: s.name,
      position: s.position,
      signatureImage: s.signatureImage,
    }));

  const html = renderTiReport({
    lang,
    settings,
    signatories,
    project: { name: project.name },
    risk: { score: risk.score, color: risk.color, components: risk.components },
    aiNarrative: tiStatusRows[0]?.aiNarrative ?? null,
    totals: {
      pulses: otx.reduce((a, o) => a + o.pulses, 0),
      malware: otx.reduce((a, o) => a + o.malwareCount, 0),
      leaks: leaks.length,
    },
    otx: otx.map((o) => ({
      indicator: o.indicator,
      pulses: o.pulses,
      malwareCount: o.malwareCount,
      reputation: o.reputation,
    })),
    leaks: leaks.map((x) => ({ identifier: x.identifier ?? '', source: x.source, status: x.status })),
    indicators: indicators.map((i) => ({ type: i.type, value: i.value })),
  });
  const pdf = await renderPdf(html);
  const name = `ti_report_${project.slug}.pdf`;
  return new Response(new Uint8Array(pdf), {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${name}"` },
  });
}

function stripNulls<T extends Record<string, unknown>>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined)) as Partial<T>;
}
