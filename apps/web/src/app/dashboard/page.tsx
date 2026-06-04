import Link from 'next/link';
import { redirect } from 'next/navigation';
import { desc } from 'drizzle-orm';
import { Crosshair, Radar, Globe, ShieldAlert, ShieldCheck, FileText, Plug, Radar as RadarIcon } from 'lucide-react';
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
import { Severity, VULN_ACTIVE_STATUSES } from '@vacti/core';
import { SeverityBadge } from '../../components/ui/severity-badge';
import type { SeverityValue } from '@vacti/core';
import { targets, scans, endpoints, vulnerabilities } from '@vacti/db';
import { getDb } from '../../lib/db';
import { getCurrentUser } from '../../lib/session';

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const db = getDb();
  const [targetRows, scanRows, endpointRows, vulnRows] = await Promise.all([
    db.select().from(targets),
    db.select().from(scans).orderBy(desc(scans.createdAt)),
    db.select().from(endpoints),
    db.select().from(vulnerabilities),
  ]);
  const targetById = new Map(targetRows.map((t) => [t.id, t]));

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
          <Button asChild>
            <Link href="/scans">New scan</Link>
          </Button>
        }
      />

      {/* Metric tiles */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Targets" value={targetRows.length} icon={<Crosshair />} />
        <StatCard label="Scans" value={scanRows.length} icon={<Radar />} />
        <StatCard label="Live endpoints" value={endpointRows.length} icon={<Globe />} />
        <StatCard label="Vulnerabilities" value={vulnRows.length} icon={<ShieldAlert />} />
      </div>

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
          title="Threat Intelligence"
          description="OTX, LeakCheck, indicators & unified risk score."
          href="/threat"
          status="live"
        />
        <ModuleCard
          hue="160 70% 42%"
          icon={<FileText />}
          title="Reports"
          description="Bilingual VA & TI PDF reports."
          status="soon"
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

      {/* Data-relevant analytics */}
      {vulnRows.length > 0 ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
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
