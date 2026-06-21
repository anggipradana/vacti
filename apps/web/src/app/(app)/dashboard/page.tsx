import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { desc, eq, inArray, and, count, sql, gte } from 'drizzle-orm';
import {
  Crosshair,
  Radar,
  Globe,
  ShieldAlert,
  ShieldCheck,
  FileText,
  Plug,
  Radar as RadarIcon,
  Gauge,
  KeyRound,
  Bug,
  Radio,
} from 'lucide-react';
import { PageHeader } from '../../../components/ui/page-header';
import { StatCard } from '../../../components/ui/stat-card';
import { ModuleCard } from '../../../components/ui/module-card';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { StatusPill } from '../../../components/ui/status-pill';
import { Table, THead, TBody, TR, TH, TD } from '../../../components/ui/table';
import { SeverityDonut } from '../../../components/ui/severity-donut';
import { TrendArea } from '../../../components/ui/trend-area';
import { Severity, VULN_ACTIVE_STATUSES, VULN_STATUS_LABEL, LEAK_STATUS_LABEL } from '@vacti/core';
import type { SeverityValue, VulnStatusValue, LeakStatusValue } from '@vacti/core';
import { SeverityBadge } from '../../../components/ui/severity-badge';
import { CountBar } from '../../../components/ui/count-bar';
import { Badge } from '../../../components/ui/badge';
import { RiskGauge } from '../../../components/ui/risk-gauge';
import {
  targets,
  scans,
  endpoints,
  vulnerabilities,
  projects,
  leakcheckData,
  threatNews,
  brandNews,
  subdomains,
  exposureFindings,
  discoveredUrls,
  pentestEngagements,
  pentestEngines,
  pentestFindings,
} from '@vacti/db';
import { computeProjectRisk } from '@vacti/threat-intel';
import { getDb } from '../../../lib/db';
import { getCurrentUser } from '../../../lib/session';
import { ProjectSwitcher } from '../../../components/project-switcher';
import { getActiveProjectId } from '../../../lib/active-project';
import { getLocale } from '../../../lib/locale';
import { tx } from '../../../lib/i18n';
import { RansomwareHighlight, RansomwareHighlightFallback } from './cti-overview';
import { ENG_STATUS_LABEL } from '../pentest/ui';
import { SectionHeader, ProgressBar } from './section';

export const dynamic = 'force-dynamic';

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const locale = await getLocale();
  const db = getDb();
  const projectRows = await db.select().from(projects).orderBy(desc(projects.createdAt));
  const projectId = await getActiveProjectId((await searchParams).project, projectRows);
  // Scope the whole overview to the active project so client engagements never bleed into each other.
  const [targetRows, scanRows] = projectId
    ? await Promise.all([
        db.select().from(targets).where(eq(targets.projectId, projectId)),
        db.select().from(scans).where(eq(scans.projectId, projectId)).orderBy(desc(scans.createdAt)),
      ])
    : [[], []];
  const scanIds = scanRows.map((s) => s.id);
  // Endpoints are only ever counted on this page; tally server-side instead of hauling every row.
  // Vulnerabilities feed several top-N reductions, so we still pull rows - but only the columns those
  // reductions touch (name/severity/status/scanId/host/url/matchedAt), never the request/response/
  // description blobs that bloat the payload.
  const [endpointCountRows, vulnRows] = scanIds.length
    ? await Promise.all([
        db.select({ n: count() }).from(endpoints).where(inArray(endpoints.scanId, scanIds)),
        db
          .select({
            name: vulnerabilities.name,
            severity: vulnerabilities.severity,
            status: vulnerabilities.status,
            scanId: vulnerabilities.scanId,
            host: vulnerabilities.host,
            url: vulnerabilities.url,
            matchedAt: vulnerabilities.matchedAt,
          })
          .from(vulnerabilities)
          .where(inArray(vulnerabilities.scanId, scanIds)),
      ])
    : [[{ n: 0 }], []];
  const endpointCount = Number(endpointCountRows[0]?.n ?? 0);
  const targetById = new Map(targetRows.map((t) => [t.id, t]));

  // These overview queries are all independent of one another, so fan them out together:
  //  - exposure-finding count + distinct passive-subdomain count (passive recon surfacing)
  //  - URL discovery bucketed per day for the last 14 days + a cheap "any discovered URL ever?" gate
  //  - unified risk score + leaked-credential rows (CTI overview)
  //  - sector/brand news rows for the "needs review" tallies
  // dashSector comes from already-loaded projectRows, so it's safe to read before the fan-out.
  const dashProject = projectRows.find((p) => p.id === projectId);
  const dashSector = dashProject?.sector ?? 'banking';
  const [expCount, passiveSubCount, discoveryByDay, discoveryEverCount, risk, leakRows, newsRows, brandRows] = projectId
    ? await Promise.all([
        db.select({ n: count() }).from(exposureFindings).where(eq(exposureFindings.projectId, projectId)),
        scanIds.length
          ? db
              .select({ n: sql<number>`count(distinct ${subdomains.host})` })
              .from(subdomains)
              .where(and(inArray(subdomains.scanId, scanIds), eq(subdomains.source, 'passive')))
          : Promise.resolve([{ n: 0 }]),
        db
          .select({ day: sql<string>`date_trunc('day', ${discoveredUrls.createdAt})`, n: count() })
          .from(discoveredUrls)
          .where(
            and(
              eq(discoveredUrls.projectId, projectId),
              gte(discoveredUrls.createdAt, sql`now() - interval '14 days'`),
            ),
          )
          .groupBy(sql`date_trunc('day', ${discoveredUrls.createdAt})`)
          .orderBy(sql`date_trunc('day', ${discoveredUrls.createdAt})`),
        db.select({ n: count() }).from(discoveredUrls).where(eq(discoveredUrls.projectId, projectId)),
        computeProjectRisk(db, projectId),
        db.select().from(leakcheckData).where(eq(leakcheckData.projectId, projectId)),
        db.select({ status: threatNews.status }).from(threatNews).where(eq(threatNews.sector, dashSector)),
        db.select({ status: brandNews.status }).from(brandNews).where(eq(brandNews.projectId, projectId)),
      ])
    : ([
        [{ n: 0 }],
        [{ n: 0 }],
        [],
        [{ n: 0 }],
        { score: 0 } as Awaited<ReturnType<typeof computeProjectRisk>>,
        [],
        [],
        [],
      ] as const);
  const exposureFindingsCount = Number(expCount[0]?.n ?? 0);
  const passiveSubdomains = Number(passiveSubCount[0]?.n ?? 0);

  // Index the per-day counts by local calendar day so we can fill the 14-day window (0 for gaps).
  const discoveryCountByDay = new Map<number, number>();
  for (const row of discoveryByDay) {
    const d = new Date(row.day);
    d.setHours(0, 0, 0, 0);
    discoveryCountByDay.set(d.getTime(), Number(row.n));
  }
  const discoveryDays: { label: string; value: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    discoveryDays.push({
      label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      value: discoveryCountByDay.get(d.getTime()) ?? 0,
    });
  }
  // Gate the discovery card on "project has ever discovered a URL" (matches prior behavior), so a
  // project with only stale (>14d) discoveries still shows its - necessarily flat - chart.
  const discoveryEver = Number(discoveryEverCount[0]?.n ?? 0);

  const leakUnchecked = leakRows.filter((l) => !l.checked).length;

  const reviewVulns = vulnRows.filter((v) => v.status === 'open').length;
  const reviewLeaks = leakRows.filter((l) => l.status === 'new').length;
  const reviewNews = newsRows.filter((n) => n.status === 'new').length;
  const reviewBrand = brandRows.filter((n) => n.status === 'new').length;
  const reviewTotal = reviewVulns + reviewLeaks + reviewNews + reviewBrand;
  const leakStatusCounts = leakRows.reduce<Map<string, number>>((m, l) => {
    m.set(l.status, (m.get(l.status) ?? 0) + 1);
    return m;
  }, new Map());
  const leakStatusBreakdown = (Object.keys(LEAK_STATUS_LABEL) as LeakStatusValue[])
    .map((s) => ({ status: s, label: LEAK_STATUS_LABEL[s], count: leakStatusCounts.get(s) ?? 0 }))
    .filter((s) => s.count > 0);

  // VA review-status breakdown: project vulnerabilities grouped by triage status.
  const vulnStatusCounts = vulnRows.reduce<Map<string, number>>((m, v) => {
    m.set(v.status, (m.get(v.status) ?? 0) + 1);
    return m;
  }, new Map());
  const vulnStatusBreakdown = (Object.keys(VULN_STATUS_LABEL) as VulnStatusValue[])
    .map((s) => ({ status: s, label: VULN_STATUS_LABEL[s], count: vulnStatusCounts.get(s) ?? 0 }))
    .filter((s) => s.count > 0);

  const sev = (v: number) => vulnRows.filter((x) => x.severity === v).length;
  const severityCounts: [number, number, number, number, number] = [
    sev(Severity.Critical),
    sev(Severity.High),
    sev(Severity.Medium),
    sev(Severity.Low),
    sev(Severity.Info),
  ];

  // Most common vulnerabilities (by name), top 5.
  const byName = vulnRows.reduce<Map<string, { count: number; severity: number }>>((m, v) => {
    const cur = m.get(v.name) ?? { count: 0, severity: v.severity };
    m.set(v.name, { count: cur.count + 1, severity: Math.max(cur.severity, v.severity) });
    return m;
  }, new Map());
  const mostCommon = [...byName.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 5);

  // Top targets by active findings, top 5.
  const activeSet = new Set<string>(VULN_ACTIVE_STATUSES);
  const scanToTarget = new Map(scanRows.map((s) => [s.id, s.targetId]));
  const byTarget = vulnRows.reduce<Map<string, number>>((m, v) => {
    if (!activeSet.has(v.status)) return m;
    const tid = scanToTarget.get(v.scanId);
    if (!tid) return m;
    m.set(tid, (m.get(tid) ?? 0) + 1);
    return m;
  }, new Map());
  const topTargets = [...byTarget.entries()]
    .map(([tid, count]) => ({ domain: targetById.get(tid)?.domain ?? tid.slice(0, 8), count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Top vulnerable subdomains/hosts by active findings, top 8 (VA drill-down below target level).
  const hostOf = (v: (typeof vulnRows)[number]): string => {
    if (v.host?.trim()) return v.host.trim();
    const src = v.url ?? v.matchedAt ?? '';
    try {
      return new URL(src).hostname;
    } catch {
      return src.replace(/^\w+:\/\//, '').split('/')[0] ?? '';
    }
  };
  const byHost = vulnRows.reduce<Map<string, { count: number; severity: number }>>((m, v) => {
    if (!activeSet.has(v.status)) return m;
    const host = hostOf(v);
    if (!host) return m;
    const cur = m.get(host) ?? { count: 0, severity: v.severity };
    m.set(host, { count: cur.count + 1, severity: Math.max(cur.severity, v.severity) });
    return m;
  }, new Map());
  const topHosts = [...byHost.entries()]
    .map(([host, x]) => ({ host, ...x }))
    .sort((a, b) => b.count - a.count || b.severity - a.severity)
    .slice(0, 8);

  // AI Pentest aggregates - PROJECT-AGNOSTIC: an engagement targets a host, not a business project, so
  // this section ignores the dashboard's active project and tallies across every engagement/engine.
  // (Mirrors apps/web/src/app/(app)/pentest/page.tsx.)
  const PENTEST_ENGINE_STALE_MS = 90_000;
  const [pentestEngRows, pentestSevRows, pentestRetestRows, pentestEngineRows] = await Promise.all([
    db.select({ status: pentestEngagements.status }).from(pentestEngagements),
    // Accepted (shippable) findings grouped by severity, across all engagements.
    db
      .select({ severity: pentestFindings.severity, n: count() })
      .from(pentestFindings)
      .where(inArray(pentestFindings.status, ['accepted', 'reported']))
      .groupBy(pentestFindings.severity),
    // Of accepted findings, how many are marked fixed on retest.
    db
      .select({ retestStatus: pentestFindings.retestStatus, n: count() })
      .from(pentestFindings)
      .where(inArray(pentestFindings.status, ['accepted', 'reported']))
      .groupBy(pentestFindings.retestStatus),
    db.select({ lastHeartbeatAt: pentestEngines.lastHeartbeatAt }).from(pentestEngines),
  ]);

  // Engagements by status -> total + per-status bars.
  const pentestEngagementTotal = pentestEngRows.length;
  const pentestStatusCounts = pentestEngRows.reduce<Map<string, number>>((m, r) => {
    m.set(r.status, (m.get(r.status) ?? 0) + 1);
    return m;
  }, new Map());
  const pentestStatusBreakdown = [...pentestStatusCounts.entries()]
    .map(([status, n]) => ({ status, label: ENG_STATUS_LABEL[status] ?? status, count: n }))
    .sort((a, b) => b.count - a.count);
  // "Active" = claimed or running engagements (drives the narrative).
  const pentestActive = (pentestStatusCounts.get('claimed') ?? 0) + (pentestStatusCounts.get('running') ?? 0);

  // Accepted findings by severity -> reuse SeverityDonut [crit, high, med, low, info].
  const pentestSevByName = pentestSevRows.reduce<Map<string, number>>((m, r) => {
    m.set(r.severity, (m.get(r.severity) ?? 0) + Number(r.n));
    return m;
  }, new Map());
  const pentestSeverityCounts: [number, number, number, number, number] = [
    pentestSevByName.get('critical') ?? 0,
    pentestSevByName.get('high') ?? 0,
    pentestSevByName.get('medium') ?? 0,
    pentestSevByName.get('low') ?? 0,
    pentestSevByName.get('info') ?? 0,
  ];
  const pentestAcceptedTotal = pentestSeverityCounts.reduce((a, b) => a + b, 0);

  // Remediation progress: fixed / total accepted.
  const pentestFixed = pentestRetestRows.filter((r) => r.retestStatus === 'fixed').reduce((a, r) => a + Number(r.n), 0);
  const pentestRetestTotal = pentestRetestRows.reduce((a, r) => a + Number(r.n), 0);
  const pentestRemediatedPct = pentestRetestTotal > 0 ? Math.round((pentestFixed / pentestRetestTotal) * 100) : 0;

  // Engines online (heartbeat within ~90s).
  const pentestNow = Date.now();
  const pentestEnginesOnline = pentestEngineRows.filter(
    (e) => e.lastHeartbeatAt && pentestNow - e.lastHeartbeatAt.getTime() < PENTEST_ENGINE_STALE_MS,
  ).length;
  const pentestEnginesTotal = pentestEngineRows.length;

  // Deterministic narrative (no AI call) summarising the aggregates above. Bilingual via tx.
  const pentestSevParts: string[] = [];
  if (pentestSeverityCounts[0] > 0) pentestSevParts.push(`${pentestSeverityCounts[0]} Critical`);
  if (pentestSeverityCounts[1] > 0) pentestSevParts.push(`${pentestSeverityCounts[1]} High`);
  if (pentestSeverityCounts[2] > 0) pentestSevParts.push(`${pentestSeverityCounts[2]} Medium`);
  if (pentestSeverityCounts[3] > 0) pentestSevParts.push(`${pentestSeverityCounts[3]} Low`);
  const pentestSevSuffix = pentestSevParts.length ? ` (${pentestSevParts.join(', ')})` : '';
  const pentestNarrative =
    pentestEngagementTotal === 0
      ? tx(
          locale,
          'No engagements yet. Stand up an engine and run an authorized pentest to see findings here.',
          'Belum ada engagement. Siapkan engine dan jalankan pentest terotorisasi untuk melihat temuan di sini.',
        )
      : tx(
          locale,
          `${pentestActive} active engagement(s); ${pentestAcceptedTotal} accepted finding(s)${pentestSevSuffix}; ${pentestRemediatedPct}% remediated; ${pentestEnginesOnline} of ${pentestEnginesTotal} engine(s) online.`,
          `${pentestActive} engagement aktif; ${pentestAcceptedTotal} temuan accepted${pentestSevSuffix}; ${pentestRemediatedPct}% diremediasi; ${pentestEnginesOnline} dari ${pentestEnginesTotal} engine online.`,
        );

  const days: { label: string; value: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const next = new Date(d);
    next.setDate(d.getDate() + 1);
    days.push({
      label: d.toLocaleDateString(undefined, { weekday: 'short' }),
      value: scanRows.filter((s) => s.createdAt >= d && s.createdAt < next).length,
    });
  }

  return (
    <>
      <PageHeader
        title={tx(locale, 'Overview', 'Ikhtisar')}
        description={`${tx(locale, 'Signed in as', 'Masuk sebagai')} ${user.email}${user.isSysAdmin ? ' · SysAdmin' : ''}`}
        actions={
          <div className="flex items-center gap-2">
            <ProjectSwitcher projects={projectRows} current={projectId} basePath="/dashboard" />
            <Button asChild>
              <Link href="/scans">{tx(locale, 'New scan', 'Scan baru')}</Link>
            </Button>
          </div>
        }
      />

      {/* First-run onboarding: guide the next step until the user has data. */}
      {targetRows.length === 0 || scanRows.length === 0 ? (
        <Card className="mb-6 border-accent/40 bg-accent/5">
          <CardHeader>
            <CardTitle>{tx(locale, 'Get started', 'Mulai')}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ol className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <span className="flex size-5 items-center justify-center rounded-full bg-accent/20 text-xs font-semibold">
                  1
                </span>
                <span className={targetRows.length ? 'text-fg-subtle line-through' : ''}>
                  {tx(locale, 'Create a project', 'Buat proyek')}
                </span>
                {targetRows.length === 0 ? (
                  <Link href="/settings/projects" className="text-accent hover:underline">
                    → {tx(locale, 'Projects', 'Proyek')}
                  </Link>
                ) : null}
              </li>
              <li className="flex items-center gap-2">
                <span className="flex size-5 items-center justify-center rounded-full bg-accent/20 text-xs font-semibold">
                  2
                </span>
                <span className={targetRows.length ? 'text-fg-subtle line-through' : ''}>
                  {tx(locale, 'Add a target', 'Tambah target')}
                </span>
                {targetRows.length === 0 ? (
                  <Link href="/targets" className="text-accent hover:underline">
                    → {tx(locale, 'Targets', 'Target')}
                  </Link>
                ) : null}
              </li>
              <li className="flex items-center gap-2">
                <span className="flex size-5 items-center justify-center rounded-full bg-accent/20 text-xs font-semibold">
                  3
                </span>
                <span className={scanRows.length ? 'text-fg-subtle line-through' : ''}>
                  {tx(locale, 'Run your first scan', 'Jalankan scan pertama Anda')}
                </span>
                {targetRows.length > 0 && scanRows.length === 0 ? (
                  <Link href="/scans" className="text-accent hover:underline">
                    → {tx(locale, 'Scans', 'Scan')}
                  </Link>
                ) : null}
              </li>
              <li className="flex items-center gap-2">
                <span className="flex size-5 items-center justify-center rounded-full bg-accent/20 text-xs font-semibold">
                  4
                </span>
                <span className="text-fg-muted">
                  {tx(locale, 'Generate a report from the scan detail', 'Buat laporan dari detail scan')}
                </span>
              </li>
            </ol>
          </CardContent>
        </Card>
      ) : null}

      {/* Global stat ribbon - at-a-glance totals across the active project + AI Pentest. */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard
          label={tx(locale, 'Targets', 'Target')}
          value={targetRows.length}
          icon={<Crosshair />}
          testId="stat-targets"
        />
        <StatCard label={tx(locale, 'Scans', 'Scan')} value={scanRows.length} icon={<Radar />} />
        <StatCard label={tx(locale, 'Live endpoints', 'Endpoint aktif')} value={endpointCount} icon={<Globe />} />
        <StatCard label="Vulnerabilities" value={vulnRows.length} icon={<ShieldAlert />} />
        <Link href="/surface">
          <StatCard label="Passive subdomains" value={passiveSubdomains} icon={<RadarIcon />} />
        </Link>
        <Link href="/pentest">
          <StatCard
            label={tx(locale, 'Pentest findings', 'Temuan pentest')}
            value={pentestAcceptedTotal}
            icon={<Bug />}
          />
        </Link>
      </div>

      {/* Needs review - untriaged items across every module, all in one place */}
      <Card className="mt-4">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="size-4 text-accent" /> {tx(locale, 'Needs review', 'Perlu ditinjau')}
          </CardTitle>
          <Badge variant={reviewTotal > 0 ? 'accent' : 'neutral'}>
            {reviewTotal} {tx(locale, 'pending', 'menunggu')}
          </Badge>
        </CardHeader>
        <CardContent>
          {reviewTotal === 0 ? (
            <p className="py-1 text-sm text-fg-muted">
              {tx(
                locale,
                'Nothing pending - all findings, leaks and news are triaged. 🎉',
                'Tidak ada yang menunggu - semua temuan, kebocoran, dan berita sudah ditriase. 🎉',
              )}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                {
                  label: tx(locale, 'Open vulnerabilities', 'Vulnerability terbuka'),
                  count: reviewVulns,
                  href: `/scans?project=${projectId}`,
                },
                {
                  label: tx(locale, 'New leaked creds', 'Kredensial bocor baru'),
                  count: reviewLeaks,
                  href: `/threat?project=${projectId}&leak=new`,
                },
                {
                  label: tx(locale, 'New sector news', 'Berita sektor baru'),
                  count: reviewNews,
                  href: `/threat?project=${projectId}&news=new`,
                },
                {
                  label: tx(locale, 'New brand news', 'Berita brand baru'),
                  count: reviewBrand,
                  href: `/threat?project=${projectId}&bnews=new`,
                },
              ].map((r) => (
                <Link
                  key={r.label}
                  href={r.href}
                  className="rounded-lg border border-border p-3 transition-colors hover:border-accent hover:bg-surface-2"
                >
                  <div className={`text-2xl font-semibold ${r.count > 0 ? 'text-fg' : 'text-fg-subtle'}`}>
                    {r.count}
                  </div>
                  <div className="mt-0.5 text-xs text-fg-muted">{r.label}</div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modules */}
      <h2 className="mb-3 mt-8 font-display text-sm font-semibold uppercase tracking-wider text-fg-subtle">
        {tx(locale, 'Modules', 'Modul')}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ModuleCard
          hue="204 90% 50%"
          icon={<RadarIcon />}
          title="Vulnerability Assessment"
          description={tx(
            locale,
            'subfinder · httpx · naabu · nuclei recon pipeline.',
            'Pipeline recon subfinder · httpx · naabu · nuclei.',
          )}
          href="/scans"
          status="live"
        />
        <ModuleCard
          hue="262 70% 62%"
          icon={<ShieldCheck />}
          title="Cyber Threat Intelligence"
          description={tx(
            locale,
            'OTX, LeakCheck, indicators & unified risk score.',
            'OTX, LeakCheck, indikator & skor risiko terpadu.',
          )}
          href="/threat"
          status="live"
        />
        <ModuleCard
          hue="160 70% 42%"
          icon={<FileText />}
          title={tx(locale, 'Reports', 'Laporan')}
          description={tx(
            locale,
            'Bilingual VA & TI PDF reports - generate from any scan.',
            'Laporan PDF VA & TI dwibahasa - buat dari scan mana pun.',
          )}
          href="/scans"
          status="live"
        />
        <ModuleCard
          hue="35 92% 52%"
          icon={<Plug />}
          title={tx(locale, 'API & Integrations', 'API & Integrasi')}
          description={tx(
            locale,
            'REST API tokens, webhooks & AI enrichment.',
            'Token REST API, webhook & pengayaan AI.',
          )}
          href="/settings/tokens"
          status="live"
        />
      </div>

      {/* ===================== Vulnerability Assessment ===================== */}
      <SectionHeader
        title="Vulnerability Assessment"
        subtitle={tx(
          locale,
          'Findings, scan trend & triage for this project.',
          'Temuan, tren scan & triase untuk proyek ini.',
        )}
        action={
          <Button asChild variant="ghost" size="sm">
            <Link href={projectId ? `/scans?project=${projectId}` : '/scans'}>
              {tx(locale, 'Open VA →', 'Buka VA →')}
            </Link>
          </Button>
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>{tx(locale, 'Severity breakdown', 'Rincian severity')}</CardTitle>
          </CardHeader>
          <CardContent>
            <SeverityDonut counts={severityCounts} />
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{tx(locale, 'Scans · last 7 days', 'Scan · 7 hari terakhir')}</CardTitle>
          </CardHeader>
          <CardContent>
            <TrendArea data={days} />
          </CardContent>
        </Card>
      </div>

      {/* VA review status - triage breakdown of this project's findings. */}
      {vulnRows.length > 0 ? (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>{tx(locale, 'VA review status', 'Status review VA')}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-2">
              {vulnStatusBreakdown.map((s) => (
                <Badge
                  key={s.status}
                  variant={
                    s.status === 'open' || s.status === 'reopened'
                      ? 'danger'
                      : s.status === 'in_progress'
                        ? 'accent'
                        : s.status === 'resolved'
                          ? 'success'
                          : 'neutral'
                  }
                >
                  {s.label} · {s.count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Top vulnerable hosts + most common findings (VA drill-downs). */}
      {vulnRows.length > 0 ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>{tx(locale, 'Top vulnerable subdomains', 'Subdomain paling rentan')}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {topHosts.length ? (
                <Table>
                  <THead>
                    <TR>
                      <TH>{tx(locale, 'Subdomain / host', 'Subdomain / host')}</TH>
                      <TH>{tx(locale, 'Top severity', 'Severity tertinggi')}</TH>
                      <TH className="text-right">{tx(locale, 'Active findings', 'Temuan aktif')}</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {topHosts.map((h) => (
                      <TR key={h.host}>
                        <TD className="font-mono text-sm">{h.host}</TD>
                        <TD>
                          <SeverityBadge severity={h.severity as SeverityValue} />
                        </TD>
                        <TD>
                          <CountBar value={h.count} max={topHosts[0]?.count ?? 1} />
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              ) : (
                <p className="py-4 text-sm text-fg-muted">
                  {tx(locale, 'No active findings.', 'Tidak ada temuan aktif.')}
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{tx(locale, 'Most common vulnerabilities', 'Vulnerability paling umum')}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <Table>
                <THead>
                  <TR>
                    <TH>{tx(locale, 'Finding', 'Temuan')}</TH>
                    <TH>Severity</TH>
                    <TH className="text-right">{tx(locale, 'Count', 'Jumlah')}</TH>
                  </TR>
                </THead>
                <TBody>
                  {mostCommon.map(([name, info]) => (
                    <TR key={name}>
                      <TD className="font-medium">{name}</TD>
                      <TD>
                        <SeverityBadge severity={info.severity as SeverityValue} />
                      </TD>
                      <TD>
                        <CountBar value={info.count} max={mostCommon[0]?.[1].count ?? 1} />
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>
                {tx(locale, 'Top targets by active findings', 'Target teratas berdasarkan temuan aktif')}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {topTargets.length ? (
                <Table>
                  <THead>
                    <TR>
                      <TH>{tx(locale, 'Target', 'Target')}</TH>
                      <TH className="text-right">{tx(locale, 'Active findings', 'Temuan aktif')}</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {topTargets.map((t) => (
                      <TR key={t.domain}>
                        <TD className="font-mono text-sm">{t.domain}</TD>
                        <TD>
                          <CountBar value={t.count} max={topTargets[0]?.count ?? 1} />
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              ) : (
                <p className="py-4 text-sm text-fg-muted">
                  {tx(locale, 'No active findings.', 'Tidak ada temuan aktif.')}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* ===================== Attack Surface ===================== */}
      <SectionHeader
        title="Attack Surface"
        subtitle={tx(
          locale,
          'Passive subdomains, exposure findings & URL discovery.',
          'Subdomain pasif, temuan exposure & penemuan URL.',
        )}
        action={
          <Button asChild variant="ghost" size="sm">
            <Link href="/surface">{tx(locale, 'Open Surface →', 'Buka Surface →')}</Link>
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-2">
        <Link href="/surface">
          <StatCard label="Passive subdomains" value={passiveSubdomains} icon={<RadarIcon />} />
        </Link>
        <Link href="/surface">
          <StatCard
            label={tx(locale, 'Exposure findings', 'Temuan exposure')}
            value={exposureFindingsCount}
            icon={<KeyRound />}
          />
        </Link>
      </div>
      {discoveryEver > 0 ? (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>
              {tx(locale, 'URL discovery · last 14 days (passive)', 'Penemuan URL · 14 hari terakhir (pasif)')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TrendArea data={discoveryDays} />
          </CardContent>
        </Card>
      ) : null}

      {/* ===================== Cyber Threat Intel ===================== */}
      <SectionHeader
        title="Cyber Threat Intel"
        subtitle={tx(
          locale,
          'Unified risk, leaked credentials & ransomware highlight.',
          'Risiko terpadu, kredensial bocor & sorotan ransomware.',
        )}
        action={
          <Button asChild variant="ghost" size="sm">
            <Link href={projectId ? `/threat?project=${projectId}` : '/threat'}>
              {tx(locale, 'Open CTI →', 'Buka CTI →')}
            </Link>
          </Button>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>{tx(locale, 'Unified risk score', 'Skor risiko terpadu')}</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center py-4">
            <RiskGauge score={risk.score} />
          </CardContent>
        </Card>
        <div className="grid content-start gap-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <StatCard label={tx(locale, 'Risk score', 'Skor risiko')} value={risk.score} icon={<Gauge />} />
            <StatCard
              label={tx(locale, 'Leaked creds', 'Kredensial bocor')}
              value={leakRows.length}
              icon={<KeyRound />}
              hint={`${leakUnchecked} ${tx(locale, 'unchecked', 'belum diperiksa')}`}
            />
            <StatCard label={tx(locale, 'Targets', 'Target')} value={targetRows.length} icon={<Crosshair />} />
          </div>
          {leakStatusBreakdown.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>{tx(locale, 'Leak triage status', 'Status triase kebocoran')}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap gap-2">
                  {leakStatusBreakdown.map((s) => (
                    <Badge
                      key={s.status}
                      variant={
                        s.status === 'new'
                          ? 'danger'
                          : s.status === 'investigating' || s.status === 'confirmed'
                            ? 'accent'
                            : s.status === 'remediated'
                              ? 'success'
                              : 'neutral'
                      }
                    >
                      {s.label} · {s.count}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
      {/* Ransomware highlight does a (cached) network fetch - stream it so it never blocks the dashboard. */}
      <div className="mt-4">
        <Suspense fallback={<RansomwareHighlightFallback locale={locale} />}>
          <RansomwareHighlight locale={locale} />
        </Suspense>
      </div>

      {/* ===================== AI Pentest (NEW) - PROJECT-AGNOSTIC ===================== */}
      <SectionHeader
        title="AI Pentest"
        subtitle={tx(
          locale,
          'Autonomous, verified penetration testing - across all engagements (not scoped to a project).',
          'Penetration testing otonom & terverifikasi - lintas semua engagement (tidak dibatasi proyek).',
        )}
        action={
          <Button asChild variant="ghost" size="sm">
            <Link href="/pentest">{tx(locale, 'Open AI Pentest →', 'Buka AI Pentest →')}</Link>
          </Button>
        }
      />
      <Card className="border-accent/40 bg-accent/5">
        <CardContent className="pt-6">
          <p className="mb-5 text-sm text-fg-muted">
            <Bug className="mr-1.5 inline size-4 text-accent" />
            {pentestNarrative}
          </p>
          <div className="grid gap-5 lg:grid-cols-3">
            {/* Engagements by status */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">
                  {tx(locale, 'Engagements by status', 'Engagement per status')}
                </span>
                <span className="text-xs text-fg-muted">
                  {pentestEngagementTotal} {tx(locale, 'total', 'total')}
                </span>
              </div>
              {pentestStatusBreakdown.length ? (
                <div className="space-y-2">
                  {pentestStatusBreakdown.map((s) => (
                    <div key={s.status} className="flex items-center gap-2 text-sm">
                      <span className="w-20 shrink-0 text-fg-muted">{s.label}</span>
                      <div className="flex-1">
                        <CountBar value={s.count} max={pentestStatusBreakdown[0]?.count ?? 1} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-2 text-sm text-fg-muted">
                  {tx(locale, 'No engagements yet.', 'Belum ada engagement.')}
                </p>
              )}
            </div>

            {/* Accepted findings by severity */}
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-subtle">
                {tx(locale, 'Accepted findings by severity', 'Temuan accepted per severity')}
              </div>
              <SeverityDonut counts={pentestSeverityCounts} />
            </div>

            {/* Remediation progress + engines online */}
            <div className="space-y-5">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">
                    {tx(locale, 'Remediation progress', 'Progres remediasi')}
                  </span>
                  <span className="text-xs text-fg-muted">{pentestRemediatedPct}%</span>
                </div>
                <ProgressBar
                  pct={pentestRemediatedPct}
                  label={`${pentestFixed} / ${pentestRetestTotal} ${tx(locale, 'fixed', 'diperbaiki')}`}
                />
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-fg-subtle">
                    <Radio className="size-3.5 text-accent" /> {tx(locale, 'Engines', 'Engine')}
                  </span>
                  <Badge variant={pentestEnginesOnline > 0 ? 'success' : 'neutral'}>
                    {pentestEnginesOnline} {tx(locale, 'online', 'online')}
                  </Badge>
                </div>
                <p className="text-sm text-fg-muted">
                  {pentestEnginesOnline} {tx(locale, 'of', 'dari')} {pentestEnginesTotal}{' '}
                  {tx(locale, 'engine(s) online', 'engine online')}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent scans */}
      <h2 className="mb-3 mt-8 font-display text-sm font-semibold uppercase tracking-wider text-fg-subtle">
        {tx(locale, 'Recent scans', 'Scan terbaru')}
      </h2>
      {scanRows.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-sm text-fg-muted">
            {tx(locale, 'No scans yet.', 'Belum ada scan.')}{' '}
            <Link href="/targets" className="text-accent hover:underline">
              {tx(locale, 'Add a target', 'Tambah target')}
            </Link>{' '}
            {tx(locale, 'to begin.', 'untuk memulai.')}
          </CardContent>
        </Card>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>{tx(locale, 'Target', 'Target')}</TH>
              <TH>{tx(locale, 'Status', 'Status')}</TH>
              <TH>{tx(locale, 'Findings', 'Temuan')}</TH>
            </TR>
          </THead>
          <TBody>
            {scanRows.slice(0, 6).map((s) => {
              const c = (s.counts ?? {}) as Record<string, number>;
              return (
                <TR key={s.id}>
                  <TD>
                    <Link href={`/scans/${s.id}`} className="font-mono text-sm text-accent hover:underline">
                      {targetById.get(s.targetId)?.domain ?? s.targetId.slice(0, 8)}
                    </Link>
                  </TD>
                  <TD>
                    <StatusPill status={s.status} />
                  </TD>
                  <TD className="tabular text-sm text-fg-muted">
                    {c.endpoints ?? 0} {tx(locale, 'endpoints', 'endpoint')} · {c.ports ?? 0}{' '}
                    {tx(locale, 'ports', 'port')} · {c.vulnerabilities ?? 0} {tx(locale, 'vulns', 'vuln')}
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      )}
    </>
  );
}
