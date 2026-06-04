import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { loadEnv } from '@vacti/config';
import { createDb, runMigrations, scans, targets, scanProfiles } from '@vacti/db';
import { createQueue } from '@vacti/queue';
import { runScanPipeline, type ScanProfile } from '@vacti/recon';

const scanJobSchema = z.object({ scanId: z.string().uuid() });

const DEFAULT_PROFILE: ScanProfile = {
  tools: { subfinder: true, httpx: true, naabu: true, nuclei: true, wordfence: true },
  ports: 'top-100',
  severities: ['critical', 'high', 'medium', 'low'],
  timeoutSec: 600,
};

async function main(): Promise<void> {
  const env = loadEnv();
  console.log('[worker] running migrations…');
  await runMigrations(env.DATABASE_URL);
  const { db } = createDb(env.DATABASE_URL);
  const queue = createQueue(env.DATABASE_URL);
  await queue.start();

  await queue.work('scan', scanJobSchema, async ({ scanId }) => {
    const [scan] = await db.select().from(scans).where(eq(scans.id, scanId));
    if (!scan) return;
    const [target] = await db.select().from(targets).where(eq(targets.id, scan.targetId));
    if (!target) return;

    let profile = DEFAULT_PROFILE;
    if (scan.profileId) {
      const [p] = await db.select().from(scanProfiles).where(eq(scanProfiles.id, scan.profileId));
      if (p) {
        profile = {
          tools: p.tools as ScanProfile['tools'],
          ports: p.ports,
          severities: p.severities,
          timeoutSec: p.timeoutSec ?? undefined,
        };
      }
    }

    console.log(`[worker] scan ${scanId} starting (${target.domain})`);
    await runScanPipeline(
      {
        scanId,
        domain: target.domain,
        predefinedSubdomains: target.predefinedSubdomains,
        profile,
      },
      { db, onProgress: (stage, msg) => console.log(`[scan ${scanId}] ${stage}: ${msg}`) },
    );
  });

  // Placeholder echo job retained for health checks.
  await queue.work('echo', z.object({ msg: z.string() }), async (p) => console.log(`[worker] echo: ${p.msg}`));

  console.log('[worker] started; consuming scan + echo queues');

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`[worker] ${signal} received, shutting down…`);
    await queue.stop();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('[worker] fatal:', err);
  process.exit(1);
});
