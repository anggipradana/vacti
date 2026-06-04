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
import { Severity } from '@vacti/core';
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
