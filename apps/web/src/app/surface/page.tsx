import { redirect } from 'next/navigation';
import { and, eq, ilike, desc, count, sql } from 'drizzle-orm';
import { ShieldAlert, FileSearch, Network } from 'lucide-react';
import { AppShell } from '../../components/shell/app-shell';
import { PageHeader } from '../../components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Table, THead, TBody, TR, TH, TD } from '../../components/ui/table';
import { Select } from '../../components/ui/select';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { EmptyState } from '../../components/ui/empty-state';
import { Pagination } from '../../components/ui/pagination';
import { Reveal } from '../../components/ui/reveal';
import { LeakStatusBadge } from '../../components/ui/finding-status';
import { LEAK_STATUS_LABEL, userCan, Permission } from '@vacti/core';
import { projects, discoveredUrls, exposureFindings, ipResolutions, ipResolutionSightings } from '@vacti/db';
import { getDb } from '../../lib/db';
import { getCurrentUser } from '../../lib/session';
import { getActiveProjectId } from '../../lib/active-project';
import { setExposureStatusAction, bulkReviewExposureAction } from '../../lib/surface-actions';

export const dynamic = 'force-dynamic';
const PAGE = 25;

export default async function SurfacePage({
  searchParams,
}: {
  searchParams: Promise<{
    project?: string;
    cat?: string;
    q?: string;
    etype?: string;
    estatus?: string;
    upage?: string;
    fpage?: string;
  }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const db = getDb();
  const projectRows = await db.select().from(projects).orderBy(desc(projects.createdAt));
  const sp = await searchParams;
  const projectId = await getActiveProjectId(sp.project, projectRows);
  if (!projectId) {
    return (
      <AppShell user={{ email: user.email, isSysAdmin: user.isSysAdmin }}>
        <PageHeader title="Attack Surface" />
        <EmptyState icon={<FileSearch />} title="No project yet" description="Create a project to run passive recon." />
      </AppShell>
    );
  }
  const canTriage = userCan(user, Permission.ModifyScanResults);
  const cat = sp.cat ?? 'all';
  const q = (sp.q ?? '').trim();
  const etype = sp.etype ?? 'all';
  const estatus = sp.estatus ?? 'all';
  const upage = Math.max(1, Number(sp.upage ?? 1) || 1);
  const fpage = Math.max(1, Number(sp.fpage ?? 1) || 1);

  const urlWhere = and(
    eq(discoveredUrls.projectId, projectId),
    cat !== 'all' ? eq(discoveredUrls.categorySlug, cat) : undefined,
    q ? ilike(discoveredUrls.urlText, `%${q}%`) : undefined,
  );
  const findWhere = and(
    eq(exposureFindings.projectId, projectId),
    etype !== 'all' ? eq(exposureFindings.findingType, etype) : undefined,
    estatus !== 'all' ? eq(exposureFindings.status, estatus) : undefined,
  );

  const [catCounts, urls, urlTotal, types, finds, findTotal, ips, ipTotal] = await Promise.all([
    db
      .select({ slug: discoveredUrls.categorySlug, n: count() })
      .from(discoveredUrls)
      .where(eq(discoveredUrls.projectId, projectId))
      .groupBy(discoveredUrls.categorySlug),
    db
      .select()
      .from(discoveredUrls)
      .where(urlWhere)
      .orderBy(desc(discoveredUrls.createdAt))
      .limit(PAGE)
      .offset((upage - 1) * PAGE),
    db.select({ n: count() }).from(discoveredUrls).where(urlWhere),
    db
      .select({ t: exposureFindings.findingType, n: count() })
      .from(exposureFindings)
      .where(eq(exposureFindings.projectId, projectId))
      .groupBy(exposureFindings.findingType),
    db
      .select()
      .from(exposureFindings)
      .where(findWhere)
      .orderBy(desc(exposureFindings.createdAt))
      .limit(PAGE)
      .offset((fpage - 1) * PAGE),
    db.select({ n: count() }).from(exposureFindings).where(findWhere),
    db
      .select({
        ip: ipResolutions.ipAddress,
        latest: ipResolutions.latestResolvedAt,
        hosts: sql<string>`string_agg(distinct ${ipResolutionSightings.hostname}, ', ')`,
      })
      .from(ipResolutions)
      .leftJoin(ipResolutionSightings, eq(ipResolutionSightings.ipResolutionId, ipResolutions.id))
      .where(eq(ipResolutions.projectId, projectId))
      .groupBy(ipResolutions.ipAddress, ipResolutions.latestResolvedAt)
      .orderBy(desc(ipResolutions.latestResolvedAt))
      .limit(50),
    db.select({ n: count() }).from(ipResolutions).where(eq(ipResolutions.projectId, projectId)),
  ]);

  const urlPages = Math.max(1, Math.ceil(Number(urlTotal[0]!.n) / PAGE));
  const findPages = Math.max(1, Math.ceil(Number(findTotal[0]!.n) / PAGE));
  const totalUrls = catCounts.reduce((a, c) => a + Number(c.n), 0);
  const keep = `project=${projectId}`;

  return (
    <AppShell user={{ email: user.email, isSysAdmin: user.isSysAdmin }}>
      <PageHeader
        title="Attack Surface"
        description="Passive OSINT discovery (VirusTotal + Wayback): URLs, exposure findings, and IP resolutions. Run a passive/full scan from Scans to populate."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <a href={`/surface/export?project=${projectId}&format=zip`}>
              <Button variant="secondary" size="sm">
                Export ZIP
              </Button>
            </a>
            <a href={`/surface/export?project=${projectId}&format=csv&resource=urls`}>
              <Button variant="ghost" size="sm">
                URLs CSV
              </Button>
            </a>
            <a href={`/surface/export?project=${projectId}&format=csv&resource=findings`}>
              <Button variant="ghost" size="sm">
                Findings CSV
              </Button>
            </a>
          </div>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardContent className="py-4">
            <div className="text-2xl font-semibold">{totalUrls}</div>
            <div className="text-xs text-fg-muted">Discovered URLs</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="text-2xl font-semibold">{Number(findTotal[0]!.n)}</div>
            <div className="text-xs text-fg-muted">Exposure findings</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="text-2xl font-semibold">{Number(ipTotal[0]!.n)}</div>
            <div className="text-xs text-fg-muted">IP resolutions</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="text-2xl font-semibold">{types.length}</div>
            <div className="text-xs text-fg-muted">Exposure types</div>
          </CardContent>
        </Card>
      </div>

      {/* Exposure findings */}
      <Card className="mt-2">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="size-4 text-accent" /> Exposure findings
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <form method="get" className="flex items-center gap-1.5">
              <input type="hidden" name="project" value={projectId} />
              <Select name="etype" defaultValue={etype} className="h-8 w-40 text-xs" aria-label="Filter by type">
                <option value="all">All types</option>
                {types.map((t) => (
                  <option key={t.t} value={t.t}>
                    {t.t} ({Number(t.n)})
                  </option>
                ))}
              </Select>
              <Select name="estatus" defaultValue={estatus} className="h-8 w-36 text-xs" aria-label="Filter by status">
                <option value="all">All statuses</option>
                {Object.entries(LEAK_STATUS_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </Select>
              <Button type="submit" variant="ghost" size="sm">
                Filter
              </Button>
            </form>
            {canTriage ? (
              <form action={bulkReviewExposureAction} className="flex items-center gap-1.5">
                <input type="hidden" name="projectId" value={projectId} />
                <input type="hidden" name="type" value={etype} />
                <input type="hidden" name="filter" value={estatus} />
                <Select
                  name="status"
                  defaultValue="investigating"
                  className="h-8 w-36 text-xs"
                  aria-label="Bulk status"
                >
                  {Object.entries(LEAK_STATUS_LABEL).map(([v, l]) => (
                    <option key={v} value={v}>
                      Mark all: {l}
                    </option>
                  ))}
                </Select>
                <Button type="submit" variant="outline" size="sm">
                  Apply
                </Button>
              </form>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {finds.length === 0 ? (
            <p className="py-3 text-sm text-fg-muted">No exposure findings match — run a passive or full scan.</p>
          ) : (
            <>
              <Table>
                <THead>
                  <TR>
                    <TH>Type</TH>
                    <TH>Snippet</TH>
                    <TH>URL</TH>
                    <TH>Status</TH>
                  </TR>
                </THead>
                <TBody>
                  {finds.map((f) => (
                    <TR key={f.id}>
                      <TD>
                        <Badge variant="danger">{f.findingType}</Badge>
                      </TD>
                      <TD>
                        <Reveal value={f.snippet} />
                      </TD>
                      <TD className="max-w-md truncate font-mono text-xs text-fg-subtle" title={f.urlText ?? ''}>
                        {f.urlText}
                      </TD>
                      <TD>
                        {canTriage ? (
                          <form action={setExposureStatusAction} className="flex items-center gap-1.5">
                            <input type="hidden" name="id" value={f.id} />
                            <Select key={f.status} name="status" defaultValue={f.status} className="h-8 w-36 text-xs">
                              {Object.entries(LEAK_STATUS_LABEL).map(([v, l]) => (
                                <option key={v} value={v}>
                                  {l}
                                </option>
                              ))}
                            </Select>
                            <Button type="submit" size="sm" variant="ghost">
                              Set
                            </Button>
                          </form>
                        ) : (
                          <LeakStatusBadge status={f.status} />
                        )}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
              <Pagination
                page={fpage}
                totalPages={findPages}
                total={Number(findTotal[0]!.n)}
                label="findings"
                makeHref={(p) => `/surface?${keep}&fpage=${p}&etype=${etype}&estatus=${estatus}`}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Discovered URLs */}
      <Card className="mt-4">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <FileSearch className="size-4 text-accent" /> Discovered URLs
          </CardTitle>
          <form method="get" className="flex flex-wrap items-center gap-1.5">
            <input type="hidden" name="project" value={projectId} />
            <Select name="cat" defaultValue={cat} className="h-8 w-44 text-xs" aria-label="Filter by category">
              <option value="all">All categories</option>
              {catCounts
                .filter((c) => c.slug)
                .map((c) => (
                  <option key={c.slug} value={c.slug!}>
                    {c.slug} ({Number(c.n)})
                  </option>
                ))}
            </Select>
            <Input name="q" defaultValue={q} placeholder="Search URL…" className="h-8 w-48 text-xs" />
            <Button type="submit" variant="ghost" size="sm">
              Filter
            </Button>
          </form>
        </CardHeader>
        <CardContent className="pt-0">
          {urls.length === 0 ? (
            <p className="py-3 text-sm text-fg-muted">No discovered URLs match.</p>
          ) : (
            <>
              <Table>
                <THead>
                  <TR>
                    <TH>URL</TH>
                    <TH>Category</TH>
                    <TH>Source</TH>
                  </TR>
                </THead>
                <TBody>
                  {urls.map((u) => (
                    <TR key={u.id}>
                      <TD className="max-w-xl truncate font-mono text-xs">
                        <a
                          href={u.urlText}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-accent hover:underline"
                          title={u.urlText}
                        >
                          {u.urlText}
                        </a>
                      </TD>
                      <TD>
                        {u.categorySlug ? (
                          <Badge variant="neutral">{u.categorySlug}</Badge>
                        ) : (
                          <span className="text-fg-subtle">—</span>
                        )}
                      </TD>
                      <TD className="text-xs text-fg-subtle">{(u.sources ?? []).join(', ')}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
              <Pagination
                page={upage}
                totalPages={urlPages}
                total={Number(urlTotal[0]!.n)}
                label="URLs"
                makeHref={(p) => `/surface?${keep}&upage=${p}&cat=${cat}&q=${encodeURIComponent(q)}`}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* IP directory (passive DNS) */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Network className="size-4 text-accent" /> IP directory (passive DNS)
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {ips.length === 0 ? (
            <p className="py-3 text-sm text-fg-muted">
              No IP resolutions yet — requires a VirusTotal API key (passive DNS).
            </p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>IP</TH>
                  <TH>Hostnames</TH>
                  <TH>Latest resolved</TH>
                </TR>
              </THead>
              <TBody>
                {ips.map((r) => (
                  <TR key={r.ip}>
                    <TD className="font-mono text-sm">{r.ip}</TD>
                    <TD className="text-xs text-fg-muted">{r.hosts ?? '—'}</TD>
                    <TD className="text-xs text-fg-subtle">
                      {r.latest ? new Date(r.latest).toISOString().slice(0, 10) : '—'}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
