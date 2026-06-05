import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { desc, eq, inArray } from 'drizzle-orm';
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
} from 'lucide-react';
import { AppShell } from '../../components/shell/app-shell';
import { PageHeader } from '../../components/ui/page-header';
import { StatCard } from '../../components/ui/stat-card';
import { ModuleCard } from '../../components/ui/module-card';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { StatusPill } from '../../components/ui/status-pill';
import { Table, THead, TBody, TR, TH, TD } from '../../components/ui/table';
import { SeverityDonut } from '../../components/ui/severity-donut';
import { TrendArea } from '../../components/ui/trend-area';
import { Severity, VULN_ACTIVE_STATUSES, VULN_STATUS_LABEL, LEAK_STATUS_LABEL } from '@vacti/core';
import type { SeverityValue, VulnStatusValue, LeakStatusValue } from '@vacti/core';
import { SeverityBadge } from '../../components/ui/severity-badge';
import { Badge } from '../../components/ui/badge';
import { RiskGauge } from '../../components/ui/risk-gauge';
import { targets, scans, endpoints, vulnerabilities, projects, leakcheckData, threatNews, brandNews } from '@vacti/db';
import { computeProjectRisk } from '@vacti/threat-intel';
import { getDb } from '../../lib/db';
import { getCurrentUser } from '../../lib/session';
import { ProjectSwitcher } from '../../components/project-switcher';
import { getActiveProjectId } from '../../lib/active-project';
import { RansomwareHighlight, RansomwareHighlightFallback } from './cti-overview';

export const dynamic = 'force-dynamic';

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
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
  const [endpointRows, vulnRows] = scanIds.length
    ? await Promise.all([
        db.select().from(endpoints).where(inArray(endpoints.scanId, scanIds)),
        db.select().from(vulnerabilities).where(inArray(vulnerabilities.scanId, scanIds)),
      ])
    : [[], []];
  const targetById = new Map(targetRows.map((t) => [t.id, t]));

  // CTI overview (scoped to the active project): unified risk score + leaked-credential rows.
  // computeProjectRisk runs purely off the DB; the network-fetch ransomware card streams via Suspense.
  const [risk, leakRows] = projectId
    ? await Promise.all([
        computeProjectRisk(db, projectId),
        db.select().from(leakcheckData).where(eq(leakcheckData.projectId, projectId)),
      ])
    : [{ score: 0 } as Awaited<ReturnType<typeof computeProjectRisk>>, []];
  const leakUnchecked = leakRows.filter((l) => !l.checked).length;

  // "Needs review" — items still in their initial untriaged state, aggregated across modules.
  const dashProject = projectRows.find((p) => p.id === projectId);
  const dashSector = dashProject?.sector ?? 'banking';
  const [newsRows, brandRows] = projectId
    ? await Promise.all([
        db.select({ status: threatNews.status }).from(threatNews).where(eq(threatNews.sector, dashSector)),
        db.select({ status: brandNews.status }).from(brandNews).where(eq(brandNews.projectId, projectId)),
      ])
    : [[], []];
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
    <AppShell user={{ email: user.email, isSysAdmin: user.isSysAdmin }}>
      <PageHeader
        title="Overview"
        description={`Signed in as ${user.email}${user.isSysAdmin ? ' · SysAdmin' : ''}`}
        actions={
          <div className="flex items-center gap-2">
            <ProjectSwitcher projects={projectRows} current={projectId} basePath="/dashboard" />
            <Button asChild>
              <Link href="/scans">New scan</Link>
            </Button>
          </div>
        }
      />

      {/* First-run onboarding: guide the next step until the user has data. */}
      {targetRows.length === 0 || scanRows.length === 0 ? (
        <Card className="mb-6 border-accent/40 bg-accent/5">
          <CardHeader>
            <CardTitle>Get started</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ol className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <span className="flex size-5 items-center justify-center rounded-full bg-accent/20 text-xs font-semibold">
                  1
                </span>
                <span className={targetRows.length ? 'text-fg-subtle line-through' : ''}>Create a project</span>
                {targetRows.length === 0 ? (
                  <Link href="/projects" className="text-accent hover:underline">
                    → Projects
                  </Link>
                ) : null}
              </li>
              <li className="flex items-center gap-2">
                <span className="flex size-5 items-center justify-center rounded-full bg-accent/20 text-xs font-semibold">
                  2
                </span>
                <span className={targetRows.length ? 'text-fg-subtle line-through' : ''}>Add a target</span>
                {targetRows.length === 0 ? (
                  <Link href="/targets" className="text-accent hover:underline">
                    → Targets
                  </Link>
                ) : null}
              </li>
              <li className="flex items-center gap-2">
                <span className="flex size-5 items-center justify-center rounded-full bg-accent/20 text-xs font-semibold">
                  3
                </span>
                <span className={scanRows.length ? 'text-fg-subtle line-through' : ''}>Run your first scan</span>
                {targetRows.length > 0 && scanRows.length === 0 ? (
                  <Link href="/scans" className="text-accent hover:underline">
                    → Scans
                  </Link>
                ) : null}
              </li>
              <li className="flex items-center gap-2">
                <span className="flex size-5 items-center justify-center rounded-full bg-accent/20 text-xs font-semibold">
                  4
                </span>
                <span className="text-fg-muted">Generate a report from the scan detail</span>
              </li>
            </ol>
          </CardContent>
        </Card>
      ) : null}

      {/* Metric tiles */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Targets" value={targetRows.length} icon={<Crosshair />} testId="stat-targets" />
        <StatCard label="Scans" value={scanRows.length} icon={<Radar />} />
        <StatCard label="Live endpoints" value={endpointRows.length} icon={<Globe />} />
        <StatCard label="Vulnerabilities" value={vulnRows.length} icon={<ShieldAlert />} />
      </div>

      {/* Needs review — untriaged items across every module, all in one place */}
      <Card className="mt-4">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="size-4 text-accent" /> Needs review
          </CardTitle>
          <Badge variant={reviewTotal > 0 ? 'accent' : 'neutral'}>{reviewTotal} pending</Badge>
        </CardHeader>
        <CardContent>
          {reviewTotal === 0 ? (
            <p className="py-1 text-sm text-fg-muted">Nothing pending — all findings, leaks and news are triaged. 🎉</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                { label: 'Open vulnerabilities', count: reviewVulns, href: '/scans' },
                { label: 'New leaked creds', count: reviewLeaks, href: '/threat?leak=new' },
                { label: 'New sector news', count: reviewNews, href: '/threat?news=new' },
                { label: 'New brand news', count: reviewBrand, href: '/threat?bnews=new' },
              ].map((r) => (
                <Link
                  key={r.label}
                  href={r.href}
                  className="rounded-lg border border-border p-3 transition-colors hover:border-accent hover:bg-bg-subtle"
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
      <h2 className="mb-3 mt-8 font-display text-sm font-semibold uppercase tracking-wider text-fg-subtle">Modules</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ModuleCard
          hue="204 90% 50%"
          icon={<RadarIcon />}
          title="Vulnerability Assessment"
          description="subfinder · httpx · naabu · nuclei recon pipeline."
          href="/scans"
          status="live"
        />
        <ModuleCard
          hue="262 70% 62%"
          icon={<ShieldCheck />}
          title="Cyber Threat Intelligence"
          description="OTX, LeakCheck, indicators & unified risk score."
          href="/threat"
          status="live"
        />
        <ModuleCard
          hue="160 70% 42%"
          icon={<FileText />}
          title="Reports"
          description="Bilingual VA & TI PDF reports — generate from any scan."
          href="/scans"
          status="live"
        />
        <ModuleCard
          hue="35 92% 52%"
          icon={<Plug />}
          title="API & Integrations"
          description="REST API tokens, webhooks & AI enrichment."
          href="/settings/tokens"
          status="live"
        />
      </div>

      {/* Visualizations */}
      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Severity breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <SeverityDonut counts={severityCounts} />
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Scans · last 7 days</CardTitle>
          </CardHeader>
          <CardContent>
            <TrendArea data={days} />
          </CardContent>
        </Card>
      </div>

      {/* VA review status — triage breakdown of this project's findings. */}
      {vulnRows.length > 0 ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>VA review status</CardTitle>
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

      {/* CTI overview — unified risk, leaked credentials & ransomware highlight for this project. */}
      <div className="mb-3 mt-8 flex items-center justify-between">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-fg-subtle">
          Threat intelligence
        </h2>
        <Button asChild variant="ghost" size="sm">
          <Link href={projectId ? `/threat?project=${projectId}` : '/threat'}>Open CTI →</Link>
        </Button>
      </div>
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Unified risk score</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center py-4">
            <RiskGauge score={risk.score} />
          </CardContent>
        </Card>
        <div className="grid content-start gap-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <StatCard label="Risk score" value={risk.score} icon={<Gauge />} />
            <StatCard
              label="Leaked creds"
              value={leakRows.length}
              icon={<KeyRound />}
              hint={`${leakUnchecked} unchecked`}
            />
            <StatCard label="Targets" value={targetRows.length} icon={<Crosshair />} />
          </div>
          {leakStatusBreakdown.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Leak triage status</CardTitle>
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
      {/* Ransomware highlight does a (cached) network fetch — stream it so it never blocks the dashboard. */}
      <div className="mt-4">
        <Suspense fallback={<RansomwareHighlightFallback />}>
          <RansomwareHighlight />
        </Suspense>
      </div>

      {/* Data-relevant analytics */}
      {vulnRows.length > 0 ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Top vulnerable subdomains</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {topHosts.length ? (
                <Table>
                  <THead>
                    <TR>
                      <TH>Subdomain / host</TH>
                      <TH>Top severity</TH>
                      <TH className="text-right">Active findings</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {topHosts.map((h) => (
                      <TR key={h.host}>
                        <TD className="font-mono text-sm">{h.host}</TD>
                        <TD>
                          <SeverityBadge severity={h.severity as SeverityValue} />
                        </TD>
                        <TD className="text-right tabular">{h.count}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              ) : (
                <p className="py-4 text-sm text-fg-muted">No active findings.</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Most common vulnerabilities</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <Table>
                <THead>
                  <TR>
                    <TH>Finding</TH>
                    <TH>Severity</TH>
                    <TH className="text-right">Count</TH>
                  </TR>
                </THead>
                <TBody>
                  {mostCommon.map(([name, info]) => (
                    <TR key={name}>
                      <TD className="font-medium">{name}</TD>
                      <TD>
                        <SeverityBadge severity={info.severity as SeverityValue} />
                      </TD>
                      <TD className="text-right tabular">{info.count}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Top targets by active findings</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {topTargets.length ? (
                <Table>
                  <THead>
                    <TR>
                      <TH>Target</TH>
                      <TH className="text-right">Active findings</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {topTargets.map((t) => (
                      <TR key={t.domain}>
                        <TD className="font-mono text-sm">{t.domain}</TD>
                        <TD className="text-right tabular">{t.count}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              ) : (
                <p className="py-4 text-sm text-fg-muted">No active findings.</p>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Recent scans */}
      <h2 className="mb-3 mt-8 font-display text-sm font-semibold uppercase tracking-wider text-fg-subtle">
        Recent scans
      </h2>
      {scanRows.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-sm text-fg-muted">
            No scans yet.{' '}
            <Link href="/targets" className="text-accent hover:underline">
              Add a target
            </Link>{' '}
            to begin.
          </CardContent>
        </Card>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Target</TH>
              <TH>Status</TH>
              <TH>Findings</TH>
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
                    {c.endpoints ?? 0} endpoints · {c.ports ?? 0} ports · {c.vulnerabilities ?? 0} vulns
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      )}
    </AppShell>
  );
}
