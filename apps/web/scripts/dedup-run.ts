import { and, eq } from 'drizzle-orm';
import { pentestEvidence, pentestFindings } from '@vacti/db';
import { dedupePentestFindings, type DedupFindingInput } from '@vacti/integrations';
import { getDb } from '../src/lib/db';
import { providerFor } from '../src/lib/ai-provider';

// Inline mirror of dedupeEngagementFindings (the 'use server' action chains to server-only, unusable in tsx).
const GID = '3ce6b9c3-c63f-4608-a36d-8eb0b83e90dd';
const PID = '0b00cf7d-8aab-4e83-bf50-2c8c884d7ad5';
(async () => {
  const db = getDb();
  const provider = await providerFor(PID);
  if (!provider) {
    console.log('NO_PROVIDER');
    process.exit(2);
  }
  const f = await db
    .select({
      id: pentestFindings.id,
      title: pentestFindings.title,
      findingClass: pentestFindings.findingClass,
      affectedUrl: pentestFindings.affectedUrl,
      severity: pentestFindings.severity,
      descriptionEn: pentestFindings.descriptionEn,
    })
    .from(pentestFindings)
    .where(and(eq(pentestFindings.engagementId, GID), eq(pentestFindings.status, 'accepted')));
  const input: DedupFindingInput[] = f.map((x) => ({
    id: x.id,
    title: x.title,
    findingClass: x.findingClass ?? '',
    affectedUrl: x.affectedUrl ?? '',
    severity: x.severity,
    summary: (x.descriptionEn ?? '').replace(/\s+/g, ' ').slice(0, 240),
  }));
  const clusters = await dedupePentestFindings(input, provider);
  let retired = 0;
  let movedEvidence = 0;
  for (const c of clusters) {
    const canonKeys = new Set(
      (
        await db
          .select({ k: pentestEvidence.evidenceKey })
          .from(pentestEvidence)
          .where(eq(pentestEvidence.findingId, c.canonicalId))
      ).map((r) => r.k),
    );
    for (const dupId of c.duplicateIds) {
      const dupEv = await db
        .select({ id: pentestEvidence.id, k: pentestEvidence.evidenceKey })
        .from(pentestEvidence)
        .where(eq(pentestEvidence.findingId, dupId));
      for (const e of dupEv) {
        if (canonKeys.has(e.k)) continue;
        await db.update(pentestEvidence).set({ findingId: c.canonicalId }).where(eq(pentestEvidence.id, e.id));
        canonKeys.add(e.k);
        movedEvidence++;
      }
      await db
        .update(pentestFindings)
        .set({ status: 'duplicate', retestNotes: `merged-into:${c.canonicalId}`, updatedAt: new Date() })
        .where(eq(pentestFindings.id, dupId));
      retired++;
    }
    if (c.canonicalClass)
      await db
        .update(pentestFindings)
        .set({ findingClass: c.canonicalClass, updatedAt: new Date() })
        .where(eq(pentestFindings.id, c.canonicalId));
  }
  console.log(JSON.stringify({ clusters: clusters.length, retired, movedEvidence }, null, 2));
  process.exit(0);
})().catch((e) => {
  console.error('ERR:', e?.message ?? e);
  process.exit(1);
});
