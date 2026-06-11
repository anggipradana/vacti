import { and, desc, eq, notInArray, sql } from 'drizzle-orm';
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
import { fetchVtVerdict, computeIndicatorVerdict } from './vt-verdict';

export interface RefreshDeps {
  db: Database;
  projectId: string;
  otxKey?: string;
  leakKey?: string;
  /** VirusTotal key for manual-indicator reputation verdicts (monitored company IPs/domains). */
  vtKey?: string;
  /** Injected fetch for the sector news feeds (mocked in tests). */
  newsFetch?: FetchLike;
  /** Injected fetch for the VT verdict lookups (mocked in tests). */
  vtFetch?: FetchLike;
  /** Prune news older than this many days (default 90). Analyst-flagged items are always kept. */
  retentionDays?: number;
  onProgress?: (progress: number, message: string) => void;
}

/** Statuses an analyst has explicitly flagged to keep - never auto-pruned regardless of age. */
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
    // Retention is housekeeping - never let it break a refresh.
  }
}

/** Hard cap on curated news kept per sector / per project (keep only the newest). */
export const NEWS_CAP = 15;

/**
 * Keep only the newest `limit` news rows for a sector/project (by published date, falling back to
 * fetch date); delete the rest. Keeps the table small and predictable. Best-effort.
 */
export async function capNews(
  db: Database,
  limit: number,
  scope: { sector: string } | { projectId: string },
): Promise<void> {
  try {
    if ('sector' in scope) {
      const keep = await db
        .select({ id: threatNews.id })
        .from(threatNews)
        .where(eq(threatNews.sector, scope.sector))
        .orderBy(desc(sql`coalesce(${threatNews.publishedAt}, ${threatNews.fetchedAt})`))
        .limit(limit);
      const ids = keep.map((r) => r.id);
      if (ids.length) {
        // Never cap away analyst-flagged rows: KEEP_STATUSES outranks recency (same rule as prune).
        await db
          .delete(threatNews)
          .where(
            and(
              eq(threatNews.sector, scope.sector),
              notInArray(threatNews.id, ids),
              notInArray(threatNews.status, KEEP_STATUSES),
            ),
          );
      }
    } else {
      const keep = await db
        .select({ id: brandNews.id })
        .from(brandNews)
        .where(eq(brandNews.projectId, scope.projectId))
        .orderBy(desc(sql`coalesce(${brandNews.publishedAt}, ${brandNews.fetchedAt})`))
        .limit(limit);
      const ids = keep.map((r) => r.id);
      if (ids.length) {
        await db
          .delete(brandNews)
          .where(
            and(
              eq(brandNews.projectId, scope.projectId),
              notInArray(brandNews.id, ids),
              notInArray(brandNews.status, KEEP_STATUSES),
            ),
          );
      }
    }
  } catch {
    // Cap is housekeeping - never let it break a refresh.
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

    // Drop rows for indicators no longer in scope (removed targets/indicators). Refreshes replace
    // data per-indicator below, so an OTX outage (every fetch null) can no longer wipe prior intel.
    if (lookups.length) {
      await db.delete(otxThreatData).where(
        and(
          eq(otxThreatData.projectId, projectId),
          notInArray(
            otxThreatData.indicator,
            lookups.map((l) => l.value),
          ),
        ),
      );
    }

    let i = 0;
    const otxPulsesByValue = new Map<string, number>();
    // Track LeakCheck's reported totals so the UI can flag truncation (the per-query 1000 cap).
    let leakFoundTotal = 0;
    let leakTruncated = false;
    for (const { value: domain, otxType, leak } of lookups) {
      const otx = await fetchOtxIndicator(domain, { apiKey: deps.otxKey, type: otxType });
      if (otx) otxPulsesByValue.set(domain, otx.pulses);
      if (otx) {
        await db
          .delete(otxThreatData)
          .where(and(eq(otxThreatData.projectId, projectId), eq(otxThreatData.indicator, domain)));
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
      const leakResult = leak
        ? await fetchLeaks(domain, { apiKey: deps.leakKey })
        : { records: [], found: 0, truncated: false };
      leakFoundTotal += leakResult.found;
      leakTruncated = leakTruncated || leakResult.truncated;
      for (const l of leakResult.records) {
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

    // Reputation verdicts for the monitored assets (manual indicators): is the company's public
    // IP/domain flagged by VT engines or sitting in OTX pulses? Best-effort per indicator; when
    // both sources are unavailable the previous verdict is preserved (never downgraded to unknown).
    await setStatus('running', 91, 'checking indicator reputation');
    for (const ind of inds) {
      const kind = ind.type === 'ip' ? ('ip' as const) : ('domain' as const);
      const vt = await fetchVtVerdict(ind.value, kind, { apiKey: deps.vtKey, fetchImpl: deps.vtFetch });
      const pulses = otxPulsesByValue.get(ind.value) ?? null;
      if (!vt && pulses === null) continue;
      await db
        .update(manualIndicators)
        .set({
          vtMalicious: vt?.malicious ?? null,
          vtSuspicious: vt?.suspicious ?? null,
          vtHarmless: vt?.harmless ?? null,
          vtTotal: vt?.total ?? null,
          otxPulses: pulses,
          verdict: computeIndicatorVerdict(vt, pulses),
          lastCheckedAt: new Date(),
        })
        .where(eq(manualIndicators.id, ind.id));
    }

    // Sector security news (RSS) - refresh the shared per-sector cache for the project's sector.
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
      // News is best-effort - a feed outage must not fail the TI refresh.
    }
    // Retention: drop stale sector headlines (keeps analyst-flagged ones) so the table stays light.
    await pruneOldNews(db, retentionDays, { sector });
    await capNews(db, NEWS_CAP, { sector });

    // Brand monitoring - public news mentioning the project's brand/domain (per project, triageable).
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
        // Best-effort - a feed outage must not fail the TI refresh.
      }
      // Retention: drop stale brand headlines (keeps analyst-flagged ones).
      await pruneOldNews(db, retentionDays, { projectId });
      await capNews(db, NEWS_CAP, { projectId });
    }

    // Persist LeakCheck truncation info alongside the completed status (best-effort).
    await db
      .update(threatIntelStatus)
      .set({ leakFound: leakFoundTotal, leakTruncated })
      .where(eq(threatIntelStatus.projectId, projectId));
    await setStatus('completed', 100, `${lookups.length} indicator(s)`);
  } catch (err) {
    await setStatus('failed', 0, err instanceof Error ? err.message : String(err));
    throw err;
  }
}
