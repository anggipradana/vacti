import { and, eq, sql } from 'drizzle-orm';
import {
  targets,
  manualIndicators,
  otxThreatData,
  leakcheckData,
  threatIntelStatus,
  projects,
  threatNews,
  type Database,
} from '@vacti/db';
import { fetchOtxIndicator, type FetchLike } from './otx';
import { fetchLeaks } from './leakcheck';
import { fetchSectorNews } from './news';

export interface RefreshDeps {
  db: Database;
  projectId: string;
  otxKey?: string;
  leakKey?: string;
  /** Injected fetch for the sector news feeds (mocked in tests). */
  newsFetch?: FetchLike;
  onProgress?: (progress: number, message: string) => void;
}

/** Refresh Threat-Intel for a project: OTX + LeakCheck per domain/indicator. Degrades gracefully. */
export async function refreshThreatIntel(deps: RefreshDeps): Promise<void> {
  const { db, projectId } = deps;

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
            hashMd5: l.hashMd5,
            type: l.type,
          });
        } else if (l.password && !ex[0]!.password) {
          // Backfill a newly-available password onto an existing leak row.
          await db.update(leakcheckData).set({ password: l.password }).where(eq(leakcheckData.id, ex[0]!.id));
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

    await setStatus('completed', 100, `${lookups.length} indicator(s)`);
  } catch (err) {
    await setStatus('failed', 0, err instanceof Error ? err.message : String(err));
    throw err;
  }
}
