import { and, eq, notInArray, sql } from 'drizzle-orm';
import {
  targets,
  manualIndicators,
  otxThreatData,
  leakcheckData,
  threatIntelStatus,
  projects,
  threatNews,
  brandNews,
  type Database,
} from '@vacti/db';
import { fetchOtxIndicator, type FetchLike } from './otx';
import { fetchLeaks } from './leakcheck';
import { fetchSectorNews, fetchBrandNews } from './news';

export interface RefreshDeps {
  db: Database;
  projectId: string;
  otxKey?: string;
  leakKey?: string;
  /** Injected fetch for the sector news feeds (mocked in tests). */
  newsFetch?: FetchLike;
  /** Prune news older than this many days (default 90). Analyst-flagged items are always kept. */
  retentionDays?: number;
  onProgress?: (progress: number, message: string) => void;
}

/** Statuses an analyst has explicitly flagged to keep — never auto-pruned regardless of age. */
const KEEP_STATUSES = ['relevant', 'actioned'];

/**
 * Delete news rows older than `days` (by published date, falling back to fetch date), keeping any
 * the analyst flagged as relevant/actioned. Best-effort: a prune failure must not fail the refresh.
 */
export async function pruneOldNews(db: Database, days: number, scope: { sector: string } | { projectId: string }) {
  const cutoff = sql`now() - ${`${Math.max(1, Math.round(days))} days`}::interval`;
  try {
    if ('sector' in scope) {
      await db
        .delete(threatNews)
        .where(
          and(
            eq(threatNews.sector, scope.sector),
            sql`coalesce(${threatNews.publishedAt}, ${threatNews.fetchedAt}) < ${cutoff}`,
            notInArray(threatNews.status, KEEP_STATUSES),
          ),
        );
    } else {
      await db
        .delete(brandNews)
        .where(
          and(
            eq(brandNews.projectId, scope.projectId),
            sql`coalesce(${brandNews.publishedAt}, ${brandNews.fetchedAt}) < ${cutoff}`,
            notInArray(brandNews.status, KEEP_STATUSES),
          ),
        );
    }
  } catch {
    // Retention is housekeeping — never let it break a refresh.
  }
}

/** Refresh Threat-Intel for a project: OTX + LeakCheck per domain/indicator. Degrades gracefully. */
export async function refreshThreatIntel(deps: RefreshDeps): Promise<void> {
  const { db, projectId } = deps;
  const retentionDays = deps.retentionDays ?? 90;

  const setStatus = async (state: string, progress: number, message?: string): Promise<void> => {
    const existing = await db.select().from(threatIntelStatus).where(eq(threatIntelStatus.projectId, projectId));
    if (existing.length) {
      await db
        .update(threatIntelStatus)
        .set({ state, progress, message, updatedAt: new Date() })
        .where(eq(threatIntelStatus.projectId, projectId));
    } else {
      await db.insert(threatIntelStatus).values({ projectId, state, progress, message });
    }
    deps.onProgress?.(progress, message ?? state);
  };

  try {
    await setStatus('running', 0, 'starting');
    const tgts = await db.select().from(targets).where(eq(targets.projectId, projectId));
    const inds = await db.select().from(manualIndicators).where(eq(manualIndicators.projectId, projectId));
    // OTX lookup set: domains (targets + domain/subdomain indicators) + IP indicators (IPv4 lookup).
    const domainNames = [
      ...new Set([...tgts.map((t) => t.domain), ...inds.filter((i) => i.type !== 'ip').map((i) => i.value)]),
    ];
    const ipValues = [...new Set(inds.filter((i) => i.type === 'ip').map((i) => i.value))];
    const lookups: { value: string; otxType: 'domain' | 'IPv4'; leak: boolean }[] = [
      ...domainNames.map((value) => ({ value, otxType: 'domain' as const, leak: true })),
      ...ipValues.map((value) => ({ value, otxType: 'IPv4' as const, leak: false })),
    ];

    await db.delete(otxThreatData).where(eq(otxThreatData.projectId, projectId));

    let i = 0;
    for (const { value: domain, otxType, leak } of lookups) {
      const otx = await fetchOtxIndicator(domain, { apiKey: deps.otxKey, type: otxType });
      if (otx) {
        await db.insert(otxThreatData).values({
          projectId,
          indicator: domain,
          pulses: otx.pulses,
          malwareCount: otx.malwareCount,
          reputation: otx.reputation,
          passiveDns: otx.passiveDns,
          urls: otx.urls,
        });
      }
      for (const l of leak ? await fetchLeaks(domain, { apiKey: deps.leakKey }) : []) {
        const ex = await db
          .select({ id: leakcheckData.id, password: leakcheckData.password })
          .from(leakcheckData)
          .where(and(eq(leakcheckData.projectId, projectId), eq(leakcheckData.hashMd5, l.hashMd5)));
        if (!ex.length) {
          await db.insert(leakcheckData).values({
            projectId,
            domain,
            source: l.source,
            identifier: l.identifier,
            password: l.password,
            origin: l.origin,
            hashMd5: l.hashMd5,
            type: l.type,
          });
        } else if (l.password && !ex[0]!.password) {
          // Backfill a newly-available password onto an existing leak row.
          await db
            .update(leakcheckData)
            .set({ password: l.password, origin: l.origin })
            .where(eq(leakcheckData.id, ex[0]!.id));
        }
      }
      i += 1;
      await setStatus('running', Math.round((i / Math.max(1, lookups.length)) * 90), `processed ${domain}`);
    }

    // Sector security news (RSS) — refresh the shared per-sector cache for the project's sector.
    await setStatus('running', 92, 'fetching sector news');
    const [proj] = await db.select().from(projects).where(eq(projects.id, projectId));
    const sector = proj?.sector ?? 'banking';
    try {
      const news = await fetchSectorNews(sector, { fetchImpl: deps.newsFetch });
      if (news.length) {
        // Upsert by (sector, link): refresh the content but PRESERVE any triage status
        // an analyst has already set on a headline.
        await db
          .insert(threatNews)
          .values(
            news.map((n) => ({
              sector,
              title: n.title.slice(0, 500),
              link: n.link,
              source: n.source,
              summary: n.summary,
              publishedAt: n.publishedAt,
            })),
          )
          .onConflictDoUpdate({
            target: [threatNews.sector, threatNews.link],
            set: {
              title: sql`excluded.title`,
              source: sql`excluded.source`,
              summary: sql`excluded.summary`,
              publishedAt: sql`excluded.published_at`,
              fetchedAt: sql`now()`,
            },
          });
      }
    } catch {
      // News is best-effort — a feed outage must not fail the TI refresh.
    }
    // Retention: drop stale sector headlines (keeps analyst-flagged ones) so the table stays light.
    await pruneOldNews(db, retentionDays, { sector });

    // Brand monitoring — public news mentioning the project's brand/domain (per project, triageable).
    await setStatus('running', 96, 'fetching brand news');
    const brand = (proj?.name ?? '').trim() || tgts[0]?.domain || '';
    if (brand) {
      try {
        const [sec, gen] = await Promise.all([
          fetchBrandNews(brand, { security: true, limit: 10, fetchImpl: deps.newsFetch }),
          fetchBrandNews(brand, { security: false, limit: 10, fetchImpl: deps.newsFetch }),
        ]);
        const seen = new Set<string>();
        const items = [
          ...sec.map((n) => ({ ...n, security: true })),
          ...gen.map((n) => ({ ...n, security: false })),
        ].filter((n) => (seen.has(n.link) ? false : (seen.add(n.link), true)));
        if (items.length) {
          // Upsert by (projectId, link): refresh content but PRESERVE any analyst triage status.
          await db
            .insert(brandNews)
            .values(
              items.map((n) => ({
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
        // Best-effort — a feed outage must not fail the TI refresh.
      }
      // Retention: drop stale brand headlines (keeps analyst-flagged ones).
      await pruneOldNews(db, retentionDays, { projectId });
    }

    await setStatus('completed', 100, `${lookups.length} indicator(s)`);
  } catch (err) {
    await setStatus('failed', 0, err instanceof Error ? err.message : String(err));
    throw err;
  }
}
