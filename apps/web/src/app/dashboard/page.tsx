import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Crosshair, Radar, Globe, ShieldAlert, ShieldCheck } from 'lucide-react';
import { AppShell } from '../../components/shell/app-shell';
import { PageHeader } from '../../components/ui/page-header';
import { StatCard } from '../../components/ui/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
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
    db.select().from(scans),
    db.select().from(endpoints),
    db.select().from(vulnerabilities),
  ]);

  const sev = (v: number) => vulnRows.filter((x) => x.severity === v).length;
  const severityCounts: [number, number, number, number, number] = [
    sev(Severity.Critical),
    sev(Severity.High),
    sev(Severity.Medium),
    sev(Severity.Low),
    sev(Severity.Info),
  ];

  // 7-day scan trend
  const days: { label: string; value: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const next = new Date(d);
    next.setDate(d.getDate() + 1);
    const label = d.toLocaleDateString(undefined, { weekday: 'short' });
    const value = scanRows.filter((s) => s.createdAt >= d && s.createdAt < next).length;
    days.push({ label, value });
  }

  return (
    <AppShell user={{ email: user.email, isSysAdmin: user.isSysAdmin }}>
      <PageHeader
        title="Dashboard"
        description={`Signed in as ${user.email}${user.isSysAdmin ? ' · SysAdmin' : ''}`}
        actions={
          <Button asChild>
            <Link href="/scans">New scan</Link>
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Targets" value={targetRows.length} icon={<Crosshair />} />
        <StatCard label="Scans" value={scanRows.length} icon={<Radar />} />
        <StatCard label="Live endpoints" value={endpointRows.length} icon={<Globe />} />
        <StatCard label="Vulnerabilities" value={vulnRows.length} icon={<ShieldAlert />} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
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

      <Card className="mt-6">
        <CardContent className="flex items-center gap-3 py-5 text-sm text-fg-muted">
          <ShieldCheck className="size-5 text-accent" />
          Threat Intelligence (OTX · LeakCheck · risk score) and PDF reports arrive in upcoming releases.
        </CardContent>
      </Card>
    </AppShell>
  );
}
