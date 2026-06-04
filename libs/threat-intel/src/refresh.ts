import { and, eq } from 'drizzle-orm';
import { targets, manualIndicators, otxThreatData, leakcheckData, threatIntelStatus, type Database } from '@vacti/db';
import { fetchOtxIndicator } from './otx';
import { fetchLeaks } from './leakcheck';

export interface RefreshDeps {
  db: Database;
  projectId: string;
  otxKey?: string;
  leakKey?: string;
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
    const domains = [
      ...new Set([...tgts.map((t) => t.domain), ...inds.filter((i) => i.type !== 'ip').map((i) => i.value)]),
    ];

    await db.delete(otxThreatData).where(eq(otxThreatData.projectId, projectId));

    let i = 0;
    for (const domain of domains) {
      const otx = await fetchOtxIndicator(domain, { apiKey: deps.otxKey, type: 'domain' });
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
      for (const l of await fetchLeaks(domain, { apiKey: deps.leakKey })) {
        const ex = await db
          .select({ id: leakcheckData.id })
          .from(leakcheckData)
          .where(and(eq(leakcheckData.projectId, projectId), eq(leakcheckData.hashMd5, l.hashMd5)));
        if (!ex.length) {
          await db.insert(leakcheckData).values({
            projectId,
            domain,
            source: l.source,
            identifier: l.identifier,
            hashMd5: l.hashMd5,
            type: l.type,
          });
        }
      }
      i += 1;
      await setStatus('running', Math.round((i / Math.max(1, domains.length)) * 100), `processed ${domain}`);
    }
    await setStatus('completed', 100, `${domains.length} indicator(s)`);
  } catch (err) {
    await setStatus('failed', 0, err instanceof Error ? err.message : String(err));
    throw err;
  }
}
