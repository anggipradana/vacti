import { Newspaper } from 'lucide-react';
import { desc, eq, sql } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Select } from '../../../components/ui/select';
import { Input } from '../../../components/ui/input';
import { Button } from '../../../components/ui/button';
import { SubmitButton } from '../../../components/ui/submit-button';
import { Badge } from '../../../components/ui/badge';
import { NewsStatusBadge } from '../../../components/ui/finding-status';
import { NEWS_STATUS_LABEL } from '@vacti/core';
import { fetchBrandNews } from '@vacti/threat-intel';
import { brandNews } from '@vacti/db';
import { getDb } from '../../../lib/db';
import {
  setBrandNewsStatusAction,
  bulkReviewBrandNewsAction,
  refreshBrandNewsAction,
} from '../../../lib/threat-actions';
import { aiTriageNewsAction } from '../../../lib/ai-actions';

/**
 * Brand monitoring: public news mentioning the project's brand/domain (Google News RSS, key-less,
 * security-biased). Persisted per project so analysts can triage each headline (status survives
 * refreshes). Streamed via Suspense; a fresh fetch is upserted on load, then read back from the DB.
 */
export async function BrandNews({
  projectId,
  brand,
  canTriage,
  filter = 'all',
  newsFilter = 'all',
  leakFilter = 'all',
}: {
  projectId: string;
  brand: string;
  canTriage: boolean;
  filter?: string;
  newsFilter?: string;
  leakFilter?: string;
}) {
  const db = getDb();

  // Pull a fresh feed and upsert it (preserving any triage status already set), best-effort.
  try {
    const [security, general] = await Promise.all([
      fetchBrandNews(brand, { security: true, limit: 10 }),
      fetchBrandNews(brand, { security: false, limit: 10 }),
    ]);
    const seen = new Set<string>();
    const fresh = [
      ...security.map((n) => ({ ...n, security: true })),
      ...general.map((n) => ({ ...n, security: false })),
    ].filter((n) => (seen.has(n.link) ? false : (seen.add(n.link), true)));
    if (fresh.length) {
      await db
        .insert(brandNews)
        .values(
          fresh.map((n) => ({
            projectId,
            title: n.title.slice(0, 500),
            link: n.link,
            source: n.source,
            summary: n.summary,
            publishedAt: n.publishedAt,
            security: n.security,
          })),
        )
        .onConflictDoUpdate({
          target: [brandNews.projectId, brandNews.link],
          set: {
            title: sql`excluded.title`,
            source: sql`excluded.source`,
            summary: sql`excluded.summary`,
            publishedAt: sql`excluded.published_at`,
            security: sql`excluded.security`,
            fetchedAt: sql`now()`,
          },
        });
    }
  } catch {
    // Feed outage must not break the page — fall back to whatever is already stored.
  }

  const rows = await db
    .select()
    .from(brandNews)
    .where(eq(brandNews.projectId, projectId))
    .orderBy(desc(brandNews.publishedAt))
    .limit(20);
  const items = filter === 'all' ? rows : rows.filter((r) => r.status === filter);

  return (
    <Card className="mt-4">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2">
          <Newspaper className="size-4 text-accent" /> Brand monitoring · {brand}
        </CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <form method="get" className="flex items-center gap-1.5">
            <input type="hidden" name="project" value={projectId} />
            <input type="hidden" name="news" value={newsFilter} />
            <input type="hidden" name="leak" value={leakFilter} />
            <Select name="bnews" defaultValue={filter} className="h-8 w-36 text-xs" aria-label="Filter brand news">
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
              <form action={refreshBrandNewsAction} className="flex items-center gap-1.5">
                <input type="hidden" name="projectId" value={projectId} />
                <Input
                  name="query"
                  defaultValue={brand}
                  placeholder="brand / keyword"
                  className="h-8 w-44 text-xs"
                  aria-label="Brand search term"
                />
                <SubmitButton variant="primary" size="sm" pendingText="Searching…">
                  Search now
                </SubmitButton>
              </form>
              <form action={bulkReviewBrandNewsAction} className="flex items-center gap-1.5">
                <input type="hidden" name="projectId" value={projectId} />
                <input type="hidden" name="filter" value={filter} />
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
              <form
                action={aiTriageNewsAction}
                title="Auto-mark off-topic headlines as Irrelevant (learns from your past triage)"
              >
                <input type="hidden" name="projectId" value={projectId} />
                <input type="hidden" name="kind" value="brand" />
                <SubmitButton variant="ghost" size="sm" pendingText="Analyzing…">
                  AI: filter irrelevant
                </SubmitButton>
              </form>
            </>
          ) : (
            <span className="text-xs text-fg-subtle">public news</span>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {rows.length === 0 ? (
          <p className="py-2 text-sm text-fg-muted">No recent public news mentioning this brand.</p>
        ) : items.length === 0 ? (
          <p className="py-2 text-sm text-fg-muted">No headlines match this status filter.</p>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((n) => (
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
                    {n.security ? ' · security' : ''}
                  </div>
                </div>
                {canTriage ? (
                  <div className="flex shrink-0 items-center gap-1.5">
                    <NewsStatusBadge status={n.status} />
                    <form action={setBrandNewsStatusAction} className="flex items-center gap-1.5">
                      <input type="hidden" name="id" value={n.id} />
                      <Select key={n.status} name="status" defaultValue={n.status} className="h-8 w-36 text-xs">
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
  );
}
