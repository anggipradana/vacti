import Link from 'next/link';
import Form from 'next/form';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { desc, eq, count, sql } from 'drizzle-orm';
import { RefreshCw, ShieldCheck, Bug, Activity, Plus } from 'lucide-react';
import { PageHeader } from '../../../components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { StatCard } from '../../../components/ui/stat-card';
import { RiskGauge } from '../../../components/ui/risk-gauge';
import { Button } from '../../../components/ui/button';
import { ActionForm, ActionSubmit } from '../../../components/ui/action-form';
import { Textarea } from '../../../components/ui/textarea';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Select } from '../../../components/ui/select';
import { Badge } from '../../../components/ui/badge';
import { EmptyState } from '../../../components/ui/empty-state';
import { computeProjectRisk } from '@vacti/threat-intel';
import { LEAK_STATUS_LABEL, NEWS_STATUS_LABEL, userCan, Permission } from '@vacti/core';
import { SECTORS } from '@vacti/threat-intel';
import {
  projects,
  otxThreatData,
  leakcheckData,
  manualIndicators,
  threatIntelStatus,
  threatNews,
  exposureFindings,
} from '@vacti/db';
import { getDb } from '../../../lib/db';
import { getCurrentUser } from '../../../lib/session';
import {
  refreshTiAction,
  addIndicatorAction,
  editIndicatorAction,
  deleteIndicatorAction,
  setSectorAction,
  bulkReviewNewsAction,
  bulkReviewLeaksAction,
} from '../../../lib/threat-actions';
import { aiTriageNewsAction } from '../../../lib/ai-actions';
import { NarrativeCard } from './narrative-card';
import { CtiCards } from './cti-cards';
import { BrandNews } from './brand-news';
import { LeakTable } from './leak-table';
import { SectorNewsList } from './sector-news-list';
import { getActiveProjectId } from '../../../lib/active-project';

export const dynamic = 'force-dynamic';

export default async function ThreatPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string; bnews?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const db = getDb();
  const projectRows = await db.select().from(projects).orderBy(desc(projects.createdAt));
  const sp = await searchParams;
  const projectId = await getActiveProjectId(sp.project, projectRows);
  const brandFilter = sp.bnews ?? 'all';

  if (!projectId) {
    return (
      <>
        <PageHeader title="Cyber Threat Intelligence" />
        <EmptyState
          icon={<ShieldCheck />}
          title="No project yet"
          description="Create a project to gather threat intel."
        />
      </>
    );
  }

  const project = projectRows.find((p) => p.id === projectId);
  const sector = project?.sector ?? 'banking';
  const [risk, otx, leakStatRows, leaks, indicators, statusRows, news, exposureTypes] = await Promise.all([
    computeProjectRisk(db, projectId),
    db.select().from(otxThreatData).where(eq(otxThreatData.projectId, projectId)).limit(100),
    db
      .select({ total: count(), unchecked: sql<number>`count(*) filter (where ${leakcheckData.checked} = false)` })
      .from(leakcheckData)
      .where(eq(leakcheckData.projectId, projectId)),
    db.select().from(leakcheckData).where(eq(leakcheckData.projectId, projectId)).orderBy(desc(leakcheckData.id)),
    db.select().from(manualIndicators).where(eq(manualIndicators.projectId, projectId)),
    db.select().from(threatIntelStatus).where(eq(threatIntelStatus.projectId, projectId)),
    db.select().from(threatNews).where(eq(threatNews.sector, sector)).orderBy(desc(threatNews.publishedAt)).limit(15),
    db
      .select({ type: exposureFindings.findingType, n: count() })
      .from(exposureFindings)
      .where(eq(exposureFindings.projectId, projectId))
      .groupBy(exposureFindings.findingType),
  ]);
  // Passive exposure findings summary (CTI surfacing). Credential-class types overlap LeakCheck.
  const exposureTotal = exposureTypes.reduce((a, t) => a + Number(t.n), 0);
  const CRED_TYPES = new Set(['combo-list-cred', 'basic-auth-url', 'credential-like', 'email', 'db-connection']);
  const exposureCredTotal = exposureTypes.filter((t) => CRED_TYPES.has(t.type)).reduce((a, t) => a + Number(t.n), 0);
  const exposureTop = [...exposureTypes].sort((a, b) => Number(b.n) - Number(a.n)).slice(0, 6);
  const status = statusRows[0];
  const canTriage = userCan(user, Permission.ModifyScanResults);
  const pulses = otx.reduce((a, o) => a + o.pulses, 0);
  const malware = otx.reduce((a, o) => a + o.malwareCount, 0);
  const leakTotal = Number(leakStatRows[0]?.total ?? 0);
  const unchecked = Number(leakStatRows[0]?.unchecked ?? 0);

  return (
    <>
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
            <ActionForm action={refreshTiAction}>
              <input type="hidden" name="projectId" value={projectId} />
              <ActionSubmit pendingText="Refreshing...">
                <RefreshCw /> Refresh
              </ActionSubmit>
            </ActionForm>
          </div>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Form action="/threat">
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
        </Form>
        {status ? (
          <Badge variant={status.state === 'running' ? 'accent' : status.state === 'failed' ? 'danger' : 'neutral'}>
            {status.state === 'running' ? `refreshing ${status.progress}%` : `last refresh: ${status.state}`}
          </Badge>
        ) : (
          <Badge variant="neutral">never refreshed</Badge>
        )}
        {!otx.length && leakTotal === 0 ? (
          <span className="text-xs text-fg-subtle">
            Set OTX_API_KEY / LEAKCHECK_API_KEY to populate live data - features degrade gracefully.
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
        <BrandNews
          projectId={projectId}
          brand={project?.brandQuery || project?.name || 'brand'}
          canTriage={canTriage}
          filter={brandFilter}
        />
      </Suspense>

      <NarrativeCard projectId={projectId} initial={status?.aiNarrative ?? null} canTriage={canTriage} />

      <Card className="mt-4">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle>Security news · {sector}</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            {canTriage ? (
              <>
                <ActionForm action={bulkReviewNewsAction} className="flex items-center gap-1.5">
                  <input type="hidden" name="sector" value={sector} />
                  <input type="hidden" name="filter" value="all" />
                  <Select name="status" defaultValue="reviewed" className="h-8 w-36 text-xs" aria-label="Bulk status">
                    {Object.entries(NEWS_STATUS_LABEL).map(([val, label]) => (
                      <option key={val} value={val}>
                        Mark all: {label}
                      </option>
                    ))}
                  </Select>
                  <ActionSubmit variant="outline" size="sm">
                    Apply
                  </ActionSubmit>
                </ActionForm>
                <ActionForm
                  action={setSectorAction}
                  className="flex items-center gap-2"
                  confirm="Fetching this sector's news keeps only the newest 15 headlines and removes older stored ones. Continue?"
                >
                  <input type="hidden" name="projectId" value={projectId} />
                  <Select name="sector" defaultValue={sector} className="w-40">
                    {Object.keys(SECTORS).map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Select>
                  <ActionSubmit variant="outline" size="sm">
                    Apply sector
                  </ActionSubmit>
                </ActionForm>
                <ActionForm
                  action={aiTriageNewsAction}
                  title="Auto-mark off-topic headlines as Irrelevant (learns from your past triage)"
                >
                  <input type="hidden" name="projectId" value={projectId} />
                  <input type="hidden" name="kind" value="sector" />
                  <ActionSubmit variant="ghost" size="sm" pendingText="Analyzing…">
                    AI: filter irrelevant
                  </ActionSubmit>
                </ActionForm>
              </>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {news.length === 0 ? (
            <p className="py-2 text-sm text-fg-muted">
              No news yet - pick a sector and refresh to pull the latest security headlines.
            </p>
          ) : (
            <SectorNewsList
              items={news.map((n) => ({
                id: n.id,
                title: n.title,
                link: n.link,
                source: n.source,
                publishedAt: n.publishedAt ? new Date(n.publishedAt).toISOString() : null,
                status: n.status,
              }))}
              canTriage={canTriage}
            />
          )}
        </CardContent>
      </Card>

      {/* Passive exposure (from Attack Surface) - credential-class types overlap leaked credentials. */}
      <Card className="mt-4">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <Bug className="size-4 text-accent" /> Exposure (passive) · {exposureTotal}
          </CardTitle>
          <Link href={`/surface?project=${projectId}`} className="text-xs text-accent hover:underline">
            View in Attack Surface →
          </Link>
        </CardHeader>
        <CardContent className="pt-0">
          {exposureTotal === 0 ? (
            <p className="py-1 text-sm text-fg-muted">
              No passive exposure findings yet - run a passive or full scan from Scans.
            </p>
          ) : (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {exposureTop.map((t) => (
                  <Link
                    key={t.type}
                    href={`/surface?project=${projectId}&etype=${t.type}`}
                    title="Open in Attack Surface"
                  >
                    <Badge variant="danger">
                      {t.type} · {Number(t.n)}
                    </Badge>
                  </Link>
                ))}
              </div>
              {exposureCredTotal > 0 ? (
                <p className="text-xs text-fg-muted">
                  {exposureCredTotal} credential-class finding(s) overlap leaked credentials below - feeds the Exposure
                  component of the risk score.
                </p>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mb-3 mt-8 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-fg-subtle">
          Leaked credentials
        </h2>
        {leakTotal > 0 && canTriage ? (
          <ActionForm action={bulkReviewLeaksAction} className="flex items-center gap-1.5">
            <input type="hidden" name="projectId" value={projectId} />
            <input type="hidden" name="filter" value="all" />
            <Select name="status" defaultValue="investigating" className="h-8 w-40 text-xs" aria-label="Bulk status">
              {Object.entries(LEAK_STATUS_LABEL).map(([val, label]) => (
                <option key={val} value={val}>
                  Mark all: {label}
                </option>
              ))}
            </Select>
            <ActionSubmit variant="outline" size="sm">
              Apply
            </ActionSubmit>
          </ActionForm>
        ) : null}
      </div>
      {leakTotal === 0 ? (
        <Card>
          <CardContent className="py-5 text-sm text-fg-muted">No leaked credentials found.</CardContent>
        </Card>
      ) : (
        <LeakTable
          leaks={leaks.map((l) => ({
            id: l.id,
            identifier: l.identifier,
            password: l.password,
            origin: l.origin,
            source: l.source,
            type: l.type,
            status: l.status,
          }))}
          canTriage={canTriage}
        />
      )}

      <h2 className="mb-3 mt-8 font-display text-sm font-semibold uppercase tracking-wider text-fg-subtle">
        Manual indicators
      </h2>
      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <Card>
          <CardContent className="pt-5">
            <ActionForm action={addIndicatorAction} className="space-y-3">
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
              <ActionSubmit className="w-full">
                <Plus /> Add indicator(s)
              </ActionSubmit>
            </ActionForm>
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
                <CardContent className="py-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm">{ind.value}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="accent">{ind.type}</Badge>
                      {canTriage ? (
                        <ActionForm action={deleteIndicatorAction} confirm="Delete this indicator?">
                          <input type="hidden" name="id" value={ind.id} />
                          <ActionSubmit size="sm" variant="ghost" className="text-danger hover:bg-danger/10">
                            Delete
                          </ActionSubmit>
                        </ActionForm>
                      ) : null}
                    </div>
                  </div>
                  {canTriage ? (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-fg-subtle hover:text-fg-muted">Edit</summary>
                      <ActionForm action={editIndicatorAction} className="mt-2 space-y-2">
                        <input type="hidden" name="id" value={ind.id} />
                        <Select name="type" defaultValue={ind.type} aria-label="Type">
                          <option value="domain">domain</option>
                          <option value="subdomain">subdomain</option>
                          <option value="ip">ip</option>
                        </Select>
                        <Input name="value" defaultValue={ind.value} placeholder="Value" required />
                        <Input name="note" defaultValue={ind.note ?? ''} placeholder="Note (optional)" />
                        <ActionSubmit size="sm" variant="outline">
                          Save
                        </ActionSubmit>
                      </ActionForm>
                    </details>
                  ) : null}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </>
  );
}
