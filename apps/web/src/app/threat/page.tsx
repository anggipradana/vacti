import { redirect } from 'next/navigation';
import { desc, eq } from 'drizzle-orm';
import { RefreshCw, ShieldCheck, Bug, Activity, Plus } from 'lucide-react';
import { AppShell } from '../../components/shell/app-shell';
import { PageHeader } from '../../components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { StatCard } from '../../components/ui/stat-card';
import { RiskGauge } from '../../components/ui/risk-gauge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select } from '../../components/ui/select';
import { Badge } from '../../components/ui/badge';
import { Table, THead, TBody, TR, TH, TD } from '../../components/ui/table';
import { EmptyState } from '../../components/ui/empty-state';
import { computeProjectRisk } from '@vacti/threat-intel';
import { LEAK_STATUS_LABEL } from '@vacti/core';
import { projects, otxThreatData, leakcheckData, manualIndicators, threatIntelStatus } from '@vacti/db';
import { getDb } from '../../lib/db';
import { getCurrentUser } from '../../lib/session';
import { refreshTiAction, addIndicatorAction } from '../../lib/threat-actions';
import { setLeakStatusAction } from '../../lib/status-actions';

export const dynamic = 'force-dynamic';

export default async function ThreatPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const db = getDb();
  const projectRows = await db.select().from(projects).orderBy(desc(projects.createdAt));
  const sp = await searchParams;
  const projectId = sp.project ?? projectRows[0]?.id;

  if (!projectId) {
    return (
      <AppShell user={{ email: user.email, isSysAdmin: user.isSysAdmin }}>
        <PageHeader title="Threat Intelligence" />
        <EmptyState
          icon={<ShieldCheck />}
          title="No project yet"
          description="Create a project to gather threat intel."
        />
      </AppShell>
    );
  }

  const [risk, otx, leaks, indicators, statusRows] = await Promise.all([
    computeProjectRisk(db, projectId),
    db.select().from(otxThreatData).where(eq(otxThreatData.projectId, projectId)),
    db.select().from(leakcheckData).where(eq(leakcheckData.projectId, projectId)),
    db.select().from(manualIndicators).where(eq(manualIndicators.projectId, projectId)),
    db.select().from(threatIntelStatus).where(eq(threatIntelStatus.projectId, projectId)),
  ]);
  const status = statusRows[0];
  const pulses = otx.reduce((a, o) => a + o.pulses, 0);
  const malware = otx.reduce((a, o) => a + o.malwareCount, 0);
  const unchecked = leaks.filter((l) => !l.checked).length;

  return (
    <AppShell user={{ email: user.email, isSysAdmin: user.isSysAdmin }}>
      <PageHeader
        title="Threat Intelligence"
        description="OTX AlienVault, leaked credentials, manual indicators & unified risk score."
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="secondary">
              <a href={`/reports/ti/${projectId}`} target="_blank" rel="noopener noreferrer">
                Generate report
              </a>
            </Button>
            <form action={refreshTiAction}>
              <input type="hidden" name="projectId" value={projectId} />
              <Button type="submit">
                <RefreshCw /> Refresh
              </Button>
            </form>
          </div>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <form>
          <Select name="project" defaultValue={projectId} aria-label="Project">
            {projectRows.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          <Button type="submit" variant="ghost" size="sm" className="ml-2">
            Switch
          </Button>
        </form>
        {status ? (
          <Badge variant={status.state === 'running' ? 'accent' : status.state === 'failed' ? 'danger' : 'neutral'}>
            {status.state === 'running' ? `refreshing ${status.progress}%` : `last refresh: ${status.state}`}
          </Badge>
        ) : (
          <Badge variant="neutral">never refreshed</Badge>
        )}
        {!otx.length && !leaks.length ? (
          <span className="text-xs text-fg-subtle">
            Set OTX_API_KEY / LEAKCHECK_API_KEY to populate live data — features degrade gracefully.
          </span>
        ) : null}
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
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="OTX pulses" value={pulses} icon={<Activity />} />
          <StatCard label="Malware refs" value={malware} icon={<Bug />} />
          <StatCard label="Leaked creds" value={leaks.length} icon={<ShieldCheck />} hint={`${unchecked} unchecked`} />
          <StatCard label="Indicators" value={indicators.length} icon={<Plus />} />
        </div>
      </div>

      <h2 className="mb-3 mt-8 font-display text-sm font-semibold uppercase tracking-wider text-fg-subtle">
        Leaked credentials
      </h2>
      {leaks.length === 0 ? (
        <Card>
          <CardContent className="py-5 text-sm text-fg-muted">No leaked credentials found.</CardContent>
        </Card>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Identifier</TH>
              <TH>Source</TH>
              <TH>Type</TH>
              <TH className="text-right">Triage status</TH>
            </TR>
          </THead>
          <TBody>
            {leaks.map((l) => (
              <TR key={l.id}>
                <TD className="font-mono text-xs">{l.identifier}</TD>
                <TD>{l.source}</TD>
                <TD>
                  <Badge variant="neutral">{l.type}</Badge>
                </TD>
                <TD>
                  <form action={setLeakStatusAction} className="flex items-center justify-end gap-1.5">
                    <input type="hidden" name="id" value={l.id} />
                    <Select name="status" defaultValue={l.status} className="h-8 w-40 text-xs">
                      {Object.entries(LEAK_STATUS_LABEL).map(([val, label]) => (
                        <option key={val} value={val}>
                          {label}
                        </option>
                      ))}
                    </Select>
                    <Button type="submit" size="sm" variant="ghost">
                      Set
                    </Button>
                  </form>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <h2 className="mb-3 mt-8 font-display text-sm font-semibold uppercase tracking-wider text-fg-subtle">
        Manual indicators
      </h2>
      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <Card>
          <CardContent className="pt-5">
            <form action={addIndicatorAction} className="space-y-3">
              <input type="hidden" name="projectId" value={projectId} />
              <div className="space-y-1.5">
                <Label htmlFor="type">Type</Label>
                <Select id="type" name="type">
                  <option value="domain">domain</option>
                  <option value="subdomain">subdomain</option>
                  <option value="ip">ip</option>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="value">Value</Label>
                <Input id="value" name="value" placeholder="evil.example.com" required />
              </div>
              <Button type="submit" className="w-full">
                <Plus /> Add indicator
              </Button>
            </form>
          </CardContent>
        </Card>
        <div className="space-y-2">
          {indicators.length === 0 ? (
            <Card>
              <CardContent className="py-5 text-sm text-fg-muted">No manual indicators.</CardContent>
            </Card>
          ) : (
            indicators.map((ind) => (
              <Card key={ind.id}>
                <CardContent className="flex items-center justify-between py-3">
                  <span className="font-mono text-sm">{ind.value}</span>
                  <Badge variant="accent">{ind.type}</Badge>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </AppShell>
  );
}
