import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { and, desc, eq, count, sql } from 'drizzle-orm';
import { RefreshCw, ShieldCheck, Bug, Activity, Plus } from 'lucide-react';
import { AppShell } from '../../components/shell/app-shell';
import { PageHeader } from '../../components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { StatCard } from '../../components/ui/stat-card';
import { RiskGauge } from '../../components/ui/risk-gauge';
import { Button } from '../../components/ui/button';
import { Textarea } from '../../components/ui/textarea';
import { Label } from '../../components/ui/label';
import { Select } from '../../components/ui/select';
import { Badge } from '../../components/ui/badge';
import { Table, THead, TBody, TR, TH, TD } from '../../components/ui/table';
import { EmptyState } from '../../components/ui/empty-state';
import { ReviewToggle } from '../../components/ui/review-toggle';
import { Pagination } from '../../components/ui/pagination';
import { Reveal } from '../../components/ui/reveal';
import { computeProjectRisk } from '@vacti/threat-intel';
import { LEAK_STATUS_LABEL, NEWS_STATUS_LABEL, userCan, Permission } from '@vacti/core';
import { SECTORS } from '@vacti/threat-intel';
import { projects, otxThreatData, leakcheckData, manualIndicators, threatIntelStatus, threatNews } from '@vacti/db';
import { getDb } from '../../lib/db';
import { getCurrentUser } from '../../lib/session';
import {
  refreshTiAction,
  addIndicatorAction,
  setSectorAction,
  setNewsStatusAction,
  bulkReviewNewsAction,
  bulkReviewLeaksAction,
} from '../../lib/threat-actions';
import { setLeakStatusAction } from '../../lib/status-actions';
import { generateThreatNarrativeAction } from '../../lib/ai-actions';
import { CtiCards } from './cti-cards';
import { BrandNews } from './brand-news';
import { getActiveProjectId } from '../../lib/active-project';

export const dynamic = 'force-dynamic';

export default async function ThreatPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string; leak?: string; news?: string; lpage?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const db = getDb();
  const projectRows = await db.select().from(projects).orderBy(desc(projects.createdAt));
  const sp = await searchParams;
  const projectId = await getActiveProjectId(sp.project, projectRows);
  const leakFilter = sp.leak ?? 'all';
  const newsFilter = sp.news ?? 'all';
  const LEAK_PAGE_SIZE = 25;
  const leakPage = Math.max(1, Number(sp.lpage ?? 1) || 1);

  if (!projectId) {
    return (
      <AppShell user={{ email: user.email, isSysAdmin: user.isSysAdmin }}>
        <PageHeader title="Cyber Threat Intelligence" />
        <EmptyState
          icon={<ShieldCheck />}
          title="No project yet"
          description="Create a project to gather threat intel."
        />
      </AppShell>
    );
  }

  const project = projectRows.find((p) => p.id === projectId);
  const sector = project?.sector ?? 'banking';
  // Leaks are paginated server-side (the list can run to hundreds of rows); the filter is pushed into SQL.
  const leakWhere = and(
    eq(leakcheckData.projectId, projectId),
    leakFilter !== 'all' ? eq(leakcheckData.status, leakFilter) : undefined,
  );
  const [risk, otx, leakStatRows, leaks, leakFilteredRows, indicators, statusRows, news] = await Promise.all([
    computeProjectRisk(db, projectId),
    db.select().from(otxThreatData).where(eq(otxThreatData.projectId, projectId)),
    db
      .select({ total: count(), unchecked: sql<number>`count(*) filter (where ${leakcheckData.checked} = false)` })
      .from(leakcheckData)
      .where(eq(leakcheckData.projectId, projectId)),
    db
      .select()
      .from(leakcheckData)
      .where(leakWhere)
      .orderBy(desc(leakcheckData.id))
      .limit(LEAK_PAGE_SIZE)
      .offset((leakPage - 1) * LEAK_PAGE_SIZE),
    db.select({ n: count() }).from(leakcheckData).where(leakWhere),
    db.select().from(manualIndicators).where(eq(manualIndicators.projectId, projectId)),
    db.select().from(threatIntelStatus).where(eq(threatIntelStatus.projectId, projectId)),
    db.select().from(threatNews).where(eq(threatNews.sector, sector)).orderBy(desc(threatNews.publishedAt)).limit(15),
  ]);
  const status = statusRows[0];
  const canTriage = userCan(user, Permission.ModifyScanResults);
  const pulses = otx.reduce((a, o) => a + o.pulses, 0);
  const malware = otx.reduce((a, o) => a + o.malwareCount, 0);
  const leakTotal = Number(leakStatRows[0]?.total ?? 0);
  const unchecked = Number(leakStatRows[0]?.unchecked ?? 0);
  const leakFilteredTotal = Number(leakFilteredRows[0]?.n ?? 0);
  const leakTotalPages = Math.max(1, Math.ceil(leakFilteredTotal / LEAK_PAGE_SIZE));
  const shownNews = newsFilter === 'all' ? news : news.filter((n) => n.status === newsFilter);

  return (
    <AppShell user={{ email: user.email, isSysAdmin: user.isSysAdmin }}>
      <PageHeader
        title="Cyber Threat Intelligence"
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
        {!otx.length && leakTotal === 0 ? (
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
          <StatCard label="Leaked creds" value={leakTotal} icon={<ShieldCheck />} hint={`${unchecked} unchecked`} />
          <StatCard label="Indicators" value={indicators.length} icon={<Plus />} />
        </div>
      </div>

      <Suspense
        fallback={<div className="mt-4 text-sm text-fg-subtle">Loading threat landscape (KEV, EPSS, ransomware)…</div>}
      >
        <CtiCards projectId={projectId} />
      </Suspense>

      <Suspense fallback={<div className="mt-4 text-sm text-fg-subtle">Loading brand news…</div>}>
        <BrandNews brand={project?.name ?? 'brand'} />
      </Suspense>

      <Card className="mt-4">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>AI risk analysis</CardTitle>
          {canTriage ? (
            <form action={generateThreatNarrativeAction}>
              <input type="hidden" name="projectId" value={projectId} />
              <Button type="submit" variant="outline" size="sm">
                {status?.aiNarrative ? 'Regenerate' : 'Generate'}
              </Button>
            </form>
          ) : null}
        </CardHeader>
        <CardContent className="pt-0 text-sm leading-relaxed text-fg-muted">
          {status?.aiNarrative ? (
            status.aiNarrative.replace(/[—–]/g, '-')
          ) : (
            <span className="text-fg-subtle">Not generated yet.</span>
          )}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle>Security news · {sector}</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <form method="get" className="flex items-center gap-1.5">
              <input type="hidden" name="project" value={projectId} />
              <input type="hidden" name="leak" value={leakFilter} />
              <Select
                name="news"
                defaultValue={newsFilter}
                className="h-8 w-36 text-xs"
                aria-label="Filter news by status"
              >
                <option value="all">All statuses</option>
                {Object.entries(NEWS_STATUS_LABEL).map(([val, label]) => (
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
              <>
                <form action={bulkReviewNewsAction} className="flex items-center gap-1.5">
                  <input type="hidden" name="sector" value={sector} />
                  <Select name="status" defaultValue="reviewed" className="h-8 w-36 text-xs" aria-label="Bulk status">
                    {Object.entries(NEWS_STATUS_LABEL).map(([val, label]) => (
                      <option key={val} value={val}>
                        Mark all: {label}
                      </option>
                    ))}
                  </Select>
                  <Button type="submit" variant="outline" size="sm">
                    Apply
                  </Button>
                </form>
                <form action={setSectorAction} className="flex items-center gap-2">
                  <input type="hidden" name="projectId" value={projectId} />
                  <Select name="sector" defaultValue={sector} className="w-40">
                    {Object.keys(SECTORS).map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Select>
                  <Button type="submit" variant="outline" size="sm">
                    Apply sector
                  </Button>
                </form>
              </>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {news.length === 0 ? (
            <p className="py-2 text-sm text-fg-muted">
              No news yet — pick a sector and refresh to pull the latest security headlines.
            </p>
          ) : shownNews.length === 0 ? (
            <p className="py-2 text-sm text-fg-muted">No headlines match this status filter.</p>
          ) : (
            <ul className="divide-y divide-border">
              {shownNews.map((n) => (
                <li key={n.id} className="flex items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <a
                      href={n.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-accent hover:underline"
                    >
                      {n.title}
                    </a>
                    <div className="mt-0.5 text-xs text-fg-subtle">
                      {n.source}
                      {n.publishedAt ? ` · ${new Date(n.publishedAt).toISOString().slice(0, 10)}` : ''}
                    </div>
                  </div>
                  {canTriage ? (
                    <div className="flex shrink-0 items-center gap-1.5">
                      <ReviewToggle action={setNewsStatusAction} kind="news" id={n.id} status={n.status} />
                      <form action={setNewsStatusAction} className="flex items-center gap-1.5">
                        <input type="hidden" name="id" value={n.id} />
                        <Select name="status" defaultValue={n.status} className="h-8 w-36 text-xs">
                          {Object.entries(NEWS_STATUS_LABEL).map(([val, label]) => (
                            <option key={val} value={val}>
                              {label}
                            </option>
                          ))}
                        </Select>
                        <Button type="submit" size="sm" variant="ghost">
                          Set
                        </Button>
                      </form>
                    </div>
                  ) : (
                    <Badge variant="neutral" className="shrink-0">
                      {NEWS_STATUS_LABEL[n.status as keyof typeof NEWS_STATUS_LABEL] ?? n.status}
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="mb-3 mt-8 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-fg-subtle">
          Leaked credentials
        </h2>
        {leakTotal > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <form method="get" className="flex items-center gap-1.5">
              <input type="hidden" name="project" value={projectId} />
              <input type="hidden" name="news" value={newsFilter} />
              <Select
                name="leak"
                defaultValue={leakFilter}
                className="h-8 w-40 text-xs"
                aria-label="Filter leaks by status"
              >
                <option value="all">All statuses</option>
                {Object.entries(LEAK_STATUS_LABEL).map(([val, label]) => (
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
              <form action={bulkReviewLeaksAction} className="flex items-center gap-1.5">
                <input type="hidden" name="projectId" value={projectId} />
                <Select
                  name="status"
                  defaultValue="investigating"
                  className="h-8 w-40 text-xs"
                  aria-label="Bulk status"
                >
                  {Object.entries(LEAK_STATUS_LABEL).map(([val, label]) => (
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
        ) : null}
      </div>
      {leakTotal === 0 ? (
        <Card>
          <CardContent className="py-5 text-sm text-fg-muted">No leaked credentials found.</CardContent>
        </Card>
      ) : leakFilteredTotal === 0 ? (
        <Card>
          <CardContent className="py-5 text-sm text-fg-muted">No leaks match this status filter.</CardContent>
        </Card>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Identifier</TH>
              <TH>Password</TH>
              <TH>Origin</TH>
              <TH>Source</TH>
              <TH>Type</TH>
              <TH className="text-right">Triage status</TH>
            </TR>
          </THead>
          <TBody>
            {leaks.map((l) => (
              <TR key={l.id}>
                <TD className="font-mono text-xs">{l.identifier}</TD>
                <TD>
                  <Reveal value={l.password} />
                </TD>
                <TD className="max-w-[200px] truncate font-mono text-xs text-fg-subtle" title={l.origin ?? ''}>
                  {l.origin ?? '-'}
                </TD>
                <TD>{l.source}</TD>
                <TD>
                  <Badge variant="neutral">{l.type}</Badge>
                </TD>
                <TD>
                  <div className="flex items-center justify-end gap-1.5">
                    <ReviewToggle action={setLeakStatusAction} kind="leak" id={l.id} status={l.status} />
                    <form action={setLeakStatusAction} className="flex items-center gap-1.5">
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
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
      {leakFilteredTotal > 0 ? (
        <Pagination
          page={leakPage}
          totalPages={leakTotalPages}
          total={leakFilteredTotal}
          label="leaks"
          makeHref={(p) => `/threat?project=${projectId}&leak=${leakFilter}&news=${newsFilter}&lpage=${p}`}
        />
      ) : null}

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
                <Label htmlFor="value">Value(s)</Label>
                <Textarea
                  id="value"
                  name="value"
                  rows={4}
                  placeholder={'evil.example.com\nbad.example.com\n34.1.2.3'}
                  required
                />
                <p className="text-xs text-fg-subtle">One per line (or comma/space separated) for bulk add.</p>
              </div>
              <Button type="submit" className="w-full">
                <Plus /> Add indicator(s)
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
