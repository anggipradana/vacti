import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { ArrowLeft, Globe, Network, Server, ShieldAlert } from 'lucide-react';
import { AppShell } from '../../../components/shell/app-shell';
import { StatusPill } from '../../../components/ui/status-pill';
import { StageStepper, type StageState } from '../../../components/ui/stage-stepper';
import { Timeline } from '../../../components/ui/timeline';
import { SeverityBadge } from '../../../components/ui/severity-badge';
import { Card, CardContent } from '../../../components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../../components/ui/tabs';
import { Table, THead, TBody, TR, TH, TD } from '../../../components/ui/table';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Select } from '../../../components/ui/select';
import { VulnStatusBadge } from '../../../components/ui/finding-status';
import { VULN_STATUS_LABEL, userCan, Permission, type SeverityValue } from '@vacti/core';
import { scans, targets, scanActivity, subdomains, endpoints, ports as portsTable, vulnerabilities } from '@vacti/db';
import { getDb } from '../../../lib/db';
import { getCurrentUser } from '../../../lib/session';
import { setVulnStatusAction } from '../../../lib/status-actions';
import { cancelScanAction } from '../../../lib/recon-actions';
import { enrichVulnAction } from '../../../lib/ai-actions';
import AutoRefresh from './auto-refresh';

export const dynamic = 'force-dynamic';
const TERMINAL = ['completed', 'failed', 'cancelled'];
const STAGES = ['subfinder', 'httpx', 'naabu', 'nuclei', 'wordfence'];

export default async function ScanDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const { id } = await params;
  const db = getDb();
  const [scan] = await db.select().from(scans).where(eq(scans.id, id));
  if (!scan) notFound();
  const [target] = await db.select().from(targets).where(eq(targets.id, scan.targetId));
  const [activity, subs, eps, prt, vulns] = await Promise.all([
    db.select().from(scanActivity).where(eq(scanActivity.scanId, id)).orderBy(scanActivity.createdAt),
    db.select().from(subdomains).where(eq(subdomains.scanId, id)),
    db.select().from(endpoints).where(eq(endpoints.scanId, id)),
    db.select().from(portsTable).where(eq(portsTable.scanId, id)),
    db.select().from(vulnerabilities).where(eq(vulnerabilities.scanId, id)),
  ]);
  const terminal = TERMINAL.includes(scan.status);

  const stageState = (name: string): StageState => {
    const acts = activity.filter((a) => a.stage === name);
    const last = acts[acts.length - 1];
    if (!last) return 'pending';
    if (last.status === 'completed') return 'completed';
    if (last.status === 'skipped') return 'skipped';
    if (last.status === 'failed') return 'failed';
    return 'running';
  };
  const stages = STAGES.map((s) => ({ label: s, state: stageState(s) }));

  return (
    <AppShell user={{ email: user.email, isSysAdmin: user.isSysAdmin }}>
      <AutoRefresh terminal={terminal} />
      <div className="mb-6">
        <Link href="/scans" className="mb-3 inline-flex items-center gap-1 text-sm text-fg-muted hover:text-fg">
          <ArrowLeft className="size-4" /> Scans
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-2xl font-semibold tracking-tight">
              {target?.domain ?? scan.targetId.slice(0, 8)}
            </h1>
            <span data-testid="scan-status">
              <StatusPill status={scan.status} />
            </span>
          </div>
          <div className="flex items-center gap-2">
            {!terminal && userCan(user, Permission.InitiateScans) ? (
              <form action={cancelScanAction}>
                <input type="hidden" name="id" value={scan.id} />
                <Button type="submit" variant="outline" size="sm" className="text-danger hover:bg-danger/10">
                  Cancel scan
                </Button>
              </form>
            ) : null}
            <Button asChild variant="secondary" size="sm">
              <a href={`/reports/va/${scan.id}?type=full`} target="_blank" rel="noopener noreferrer">
                Generate report
              </a>
            </Button>
          </div>
        </div>
        {scan.error ? <p className="mt-2 text-sm text-danger">Error: {scan.error}</p> : null}
      </div>

      <Card className="mb-6">
        <CardContent className="space-y-4 pt-5">
          <StageStepper stages={stages} />
          <Timeline items={activity.map((a) => ({ stage: a.stage, status: a.status, message: a.message }))} />
        </CardContent>
      </Card>

      <Tabs defaultValue="endpoints">
        <TabsList>
          <TabsTrigger value="endpoints">
            <Globe className="size-3.5" /> Endpoints{' '}
            <Badge variant="neutral" className="ml-1">
              {eps.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="ports">
            <Network className="size-3.5" /> Ports{' '}
            <Badge variant="neutral" className="ml-1">
              {prt.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="subdomains">
            <Server className="size-3.5" /> Subdomains{' '}
            <Badge variant="neutral" className="ml-1">
              {subs.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="vulns">
            <ShieldAlert className="size-3.5" /> Vulnerabilities{' '}
            <Badge variant="neutral" className="ml-1">
              {vulns.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="endpoints" className="mt-4">
          <Table>
            <THead>
              <TR>
                <TH>URL</TH>
                <TH>Status</TH>
                <TH>Title</TH>
                <TH>Tech</TH>
              </TR>
            </THead>
            <TBody>
              {eps.map((e) => (
                <TR key={e.id}>
                  <TD className="font-mono text-xs">{e.url}</TD>
                  <TD className="tabular">{e.statusCode}</TD>
                  <TD className="max-w-xs truncate text-fg-muted">{e.title}</TD>
                  <TD>
                    <div className="flex flex-wrap gap-1">
                      {e.isWordpress ? <Badge variant="accent">WordPress</Badge> : null}
                      {e.tech.slice(0, 3).map((t) => (
                        <Badge key={t} variant="outline">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TabsContent>

        <TabsContent value="ports" className="mt-4">
          <div className="flex flex-wrap gap-2">
            {prt.length ? (
              prt.map((p) => (
                <Badge key={p.id} variant="neutral" className="font-mono">
                  {p.ip}:{p.port}/{p.protocol}
                </Badge>
              ))
            ) : (
              <p className="text-sm text-fg-subtle">No open ports found.</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="subdomains" className="mt-4">
          <div className="flex flex-wrap gap-2">
            {subs.length ? (
              subs.map((s) => (
                <Badge key={s.id} variant="neutral" className="font-mono">
                  {s.host}
                </Badge>
              ))
            ) : (
              <p className="text-sm text-fg-subtle">No subdomains (predefined or none discovered).</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="vulns" className="mt-4">
          {vulns.length ? (
            <Table>
              <THead>
                <TR>
                  <TH>Severity</TH>
                  <TH>Finding</TH>
                  <TH>Status</TH>
                  <TH>Change</TH>
                </TR>
              </THead>
              <TBody>
                {vulns.map((v) => (
                  <TR key={v.id}>
                    <TD>
                      <SeverityBadge severity={v.severity as SeverityValue} />
                    </TD>
                    <TD>
                      <div className="font-medium">{v.name}</div>
                      <div className="font-mono text-xs text-fg-subtle">{v.matchedAt}</div>
                      {v.isAiEnriched ? (
                        <details className="mt-1 max-w-md text-xs text-fg-muted">
                          <summary className="cursor-pointer text-accent">AI analysis</summary>
                          {v.aiDescription ? (
                            <p className="mt-1">
                              <strong>Description:</strong> {v.aiDescription}
                            </p>
                          ) : null}
                          {v.aiImpact ? (
                            <p className="mt-1">
                              <strong>Impact:</strong> {v.aiImpact}
                            </p>
                          ) : null}
                          {v.aiRemediation ? (
                            <p className="mt-1">
                              <strong>Remediation:</strong> {v.aiRemediation}
                            </p>
                          ) : null}
                        </details>
                      ) : null}
                    </TD>
                    <TD>
                      <VulnStatusBadge status={v.status} />
                    </TD>
                    <TD>
                      <div className="flex items-center gap-1.5">
                        <form action={setVulnStatusAction} className="flex items-center gap-1.5">
                          <input type="hidden" name="id" value={v.id} />
                          <input type="hidden" name="scanId" value={scan.id} />
                          <Select name="status" defaultValue={v.status} className="h-8 w-36 text-xs">
                            {Object.entries(VULN_STATUS_LABEL).map(([val, label]) => (
                              <option key={val} value={val}>
                                {label}
                              </option>
                            ))}
                          </Select>
                          <Button type="submit" size="sm" variant="ghost">
                            Set
                          </Button>
                        </form>
                        <form action={enrichVulnAction}>
                          <input type="hidden" name="id" value={v.id} />
                          <input type="hidden" name="scanId" value={scan.id} />
                          <Button type="submit" size="sm" variant="outline">
                            AI
                          </Button>
                        </form>
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          ) : (
            <p className="text-sm text-fg-subtle">No vulnerabilities found.</p>
          )}
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
