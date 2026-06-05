import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { desc, eq } from 'drizzle-orm';
import { diffScans } from '@vacti/recon';
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
import { setVulnStatusAction, bulkReviewVulnsAction } from '../../../lib/status-actions';
import { Pagination } from '../../../components/ui/pagination';
import { cancelScanAction, rescanAction } from '../../../lib/recon-actions';
import { enrichVulnAction } from '../../../lib/ai-actions';
import AutoRefresh from './auto-refresh';

export const dynamic = 'force-dynamic';
const TERMINAL = ['completed', 'failed', 'cancelled'];
const STAGES = ['subfinder', 'httpx', 'naabu', 'nuclei', 'wordfence'];

export default async function ScanDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ compare?: string; vuln?: string; vpage?: string; tab?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const { id } = await params;
  const { compare, vuln: vulnFilter = 'all', vpage, tab = 'endpoints' } = await searchParams;
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
  const canScan = userCan(user, Permission.InitiateScans);
  const canTriage = userCan(user, Permission.ModifyScanResults);
  const filteredVulns = vulnFilter === 'all' ? vulns : vulns.filter((v) => v.status === vulnFilter);
  // The full vuln set is loaded for the scan-diff above, so the long table is paginated in-memory.
  const VULN_PAGE_SIZE = 50;
  const vulnPage = Math.max(1, Number(vpage ?? 1) || 1);
  const vulnTotalPages = Math.max(1, Math.ceil(filteredVulns.length / VULN_PAGE_SIZE));
  const shownVulns = filteredVulns.slice((vulnPage - 1) * VULN_PAGE_SIZE, vulnPage * VULN_PAGE_SIZE);

  // Sibling scans of the same target (for the compare dropdown) + optional diff.
  const siblings = (
    await db.select().from(scans).where(eq(scans.targetId, scan.targetId)).orderBy(desc(scans.createdAt))
  ).filter((s) => s.id !== id);
  const keysOf = (
    sd: { host: string }[],
    ep: { url: string }[],
    pt: { ip: string; port: number }[],
    vl: { templateId: string; matchedAt: string | null; url: string | null }[],
  ) => ({
    subdomains: sd.map((s) => s.host),
    endpoints: ep.map((e) => e.url),
    ports: pt.map((p) => `${p.ip}:${p.port}`),
    vulns: vl.map((v) => `${v.templateId}@${v.matchedAt ?? v.url ?? ''}`),
  });
  let diff: ReturnType<typeof diffScans> | null = null;
  if (compare && siblings.some((s) => s.id === compare)) {
    const [bsub, bep, bpt, bvl] = await Promise.all([
      db.select().from(subdomains).where(eq(subdomains.scanId, compare)),
      db.select().from(endpoints).where(eq(endpoints.scanId, compare)),
      db.select().from(portsTable).where(eq(portsTable.scanId, compare)),
      db.select().from(vulnerabilities).where(eq(vulnerabilities.scanId, compare)),
    ]);
    diff = diffScans(keysOf(bsub, bep, bpt, bvl), keysOf(subs, eps, prt, vulns));
  }

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

      {terminal && (siblings.length > 0 || canScan) ? (
        <Card className="mb-6">
          <CardContent className="space-y-4 pt-5">
            {siblings.length > 0 ? (
              <form method="get" className="flex flex-wrap items-end gap-2">
                <div className="space-y-1">
                  <span className="text-xs font-medium text-fg-subtle">Compare with an earlier scan</span>
                  <div className="flex items-center gap-2">
                    <Select name="compare" defaultValue={compare ?? ''} className="w-72">
                      <option value="">Select a scan…</option>
                      {siblings.map((s) => (
                        <option key={s.id} value={s.id}>
                          {new Date(s.createdAt).toISOString().slice(0, 16).replace('T', ' ')} · {s.status}
                        </option>
                      ))}
                    </Select>
                    <Button type="submit" variant="outline" size="sm">
                      Compare
                    </Button>
                  </div>
                </div>
              </form>
            ) : null}

            {diff ? (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {(
                  [
                    ['Subdomains', diff.subdomains],
                    ['Endpoints', diff.endpoints],
                    ['Ports', diff.ports],
                    ['Vulnerabilities', diff.vulns],
                  ] as const
                ).map(([label, d]) => (
                  <div key={label} className="rounded-lg border border-border p-3">
                    <div className="text-xs font-medium text-fg-subtle">{label}</div>
                    <div className="mt-1 flex gap-3 text-sm">
                      <span className="text-success">+{d.added.length}</span>
                      <span className="text-danger">−{d.removed.length}</span>
                      <span className="text-fg-muted">={d.unchanged}</span>
                    </div>
                    {d.added.length ? (
                      <div className="mt-1 truncate font-mono text-[11px] text-success" title={d.added.join('\n')}>
                        new: {d.added.slice(0, 3).join(', ')}
                        {d.added.length > 3 ? ` +${d.added.length - 3}` : ''}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}

            {canScan ? (
              <form action={rescanAction} className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
                <input type="hidden" name="id" value={scan.id} />
                <span className="text-xs font-medium text-fg-subtle">Rescan (uncheck tools for a sub-scan):</span>
                {STAGES.map((t) => (
                  <label key={t} className="flex items-center gap-1 text-xs">
                    <input type="checkbox" name="tools" value={t} defaultChecked /> {t}
                  </label>
                ))}
                <Button type="submit" size="sm">
                  Rescan
                </Button>
              </form>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Tabs defaultValue={tab}>
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
                      {e.isInteresting ? <Badge variant="danger">interesting</Badge> : null}
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
            <>
              <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
                <form method="get" className="flex items-center gap-1.5">
                  <input type="hidden" name="tab" value="vulns" />
                  {compare ? <input type="hidden" name="compare" value={compare} /> : null}
                  <Select
                    name="vuln"
                    defaultValue={vulnFilter}
                    className="h-8 w-40 text-xs"
                    aria-label="Filter findings by status"
                  >
                    <option value="all">All statuses</option>
                    {Object.entries(VULN_STATUS_LABEL).map(([val, label]) => (
                      <option key={val} value={val}>
                        {label}
                      </option>
                    ))}
                  </Select>
                  <Button type="submit" variant="ghost" size="sm">
                    Filter
                  </Button>
                </form>
                {canTriage ? (
                  <form action={bulkReviewVulnsAction} className="flex items-center gap-1.5">
                    <input type="hidden" name="scanId" value={scan.id} />
                    <input type="hidden" name="filter" value={vulnFilter} />
                    <Select
                      name="status"
                      defaultValue="in_progress"
                      className="h-8 w-36 text-xs"
                      aria-label="Bulk status"
                    >
                      {Object.entries(VULN_STATUS_LABEL).map(([val, label]) => (
                        <option key={val} value={val}>
                          Mark all: {label}
                        </option>
                      ))}
                    </Select>
                    <Button type="submit" variant="outline" size="sm">
                      Apply
                    </Button>
                  </form>
                ) : null}
              </div>
              {filteredVulns.length === 0 ? (
                <p className="text-sm text-fg-subtle">No findings match this status filter.</p>
              ) : (
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
                    {shownVulns.map((v) => (
                      <TR key={v.id}>
                        <TD>
                          <SeverityBadge severity={v.severity as SeverityValue} />
                        </TD>
                        <TD>
                          <div className="font-medium">{v.name}</div>
                          <div className="font-mono text-xs text-fg-subtle">{v.matchedAt}</div>
                          {v.description ||
                          v.remediation ||
                          v.cvss != null ||
                          (v.cveIds?.length ?? 0) > 0 ||
                          (v.references?.length ?? 0) > 0 ? (
                            <details className="mt-1 max-w-md text-xs text-fg-muted">
                              <summary className="cursor-pointer text-accent">Details (template)</summary>
                              {v.description ? (
                                <p className="mt-1">
                                  <strong>Description:</strong> {v.description}
                                </p>
                              ) : null}
                              {v.remediation ? (
                                <p className="mt-1">
                                  <strong>Remediation:</strong> {v.remediation}
                                </p>
                              ) : null}
                              {v.cvss != null || (v.cveIds?.length ?? 0) > 0 ? (
                                <p className="mt-1">
                                  {v.cvss != null ? <strong>CVSS {v.cvss}</strong> : null}
                                  {v.cvss != null && (v.cveIds?.length ?? 0) > 0 ? ' · ' : null}
                                  {v.cveIds?.join(', ')}
                                </p>
                              ) : null}
                              {v.references?.length ? (
                                <div className="mt-1">
                                  <strong>References:</strong>
                                  <ul className="ml-4 list-disc">
                                    {v.references.slice(0, 8).map((r) => (
                                      <li key={r} className="break-all">
                                        <a
                                          href={r}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-accent hover:underline"
                                        >
                                          {r}
                                        </a>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ) : null}
                            </details>
                          ) : null}
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
                          {v.request || v.response ? (
                            <details className="mt-1 max-w-md text-xs text-fg-muted">
                              <summary className="cursor-pointer text-accent">Request / Response</summary>
                              {v.request ? (
                                <div className="mt-1">
                                  <div className="font-semibold text-fg-subtle">Request</div>
                                  <pre className="mt-0.5 max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-bg-subtle p-2 font-mono text-[11px] leading-snug">
                                    {v.request}
                                  </pre>
                                </div>
                              ) : null}
                              {v.response ? (
                                <div className="mt-1">
                                  <div className="font-semibold text-fg-subtle">Response</div>
                                  <pre className="mt-0.5 max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-bg-subtle p-2 font-mono text-[11px] leading-snug">
                                    {v.response}
                                  </pre>
                                </div>
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
                              <Select key={v.status} name="status" defaultValue={v.status} className="h-8 w-36 text-xs">
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
              )}
              {filteredVulns.length > 0 ? (
                <Pagination
                  page={vulnPage}
                  totalPages={vulnTotalPages}
                  total={filteredVulns.length}
                  label="findings"
                  makeHref={(p) =>
                    `/scans/${scan.id}?tab=vulns&${compare ? `compare=${compare}&` : ''}vuln=${vulnFilter}&vpage=${p}`
                  }
                />
              ) : null}
            </>
          ) : (
            <p className="text-sm text-fg-subtle">No vulnerabilities found.</p>
          )}
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
