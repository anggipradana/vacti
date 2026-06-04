import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { loadEnv } from '@vacti/config';
import { createDb, runMigrations, scans, targets, scanProfiles } from '@vacti/db';
import { createQueue } from '@vacti/queue';
import { runScanPipeline, type ScanProfile } from '@vacti/recon';
import { refreshThreatIntel } from '@vacti/threat-intel';
import { sendProjectNotifications } from '@vacti/integrations';

const scanJobSchema = z.object({ scanId: z.string().uuid() });
const tiJobSchema = z.object({ projectId: z.string().uuid() });

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
    // Cancelled while still queued — never start it.
    if (scan.status === 'cancelled' || scan.cancelRequested) {
      await db.update(scans).set({ status: 'cancelled', finishedAt: new Date() }).where(eq(scans.id, scanId));
      return;
    }
    const [target] = await db.select().from(targets).where(eq(targets.id, scan.targetId));
    if (!target) return;
    let profile = DEFAULT_PROFILE;
    if (scan.profileId) {
      const [p] = await db.select().from(scanProfiles).where(eq(scanProfiles.id, scan.profileId));
      if (p)
        profile = {
          tools: p.tools as ScanProfile['tools'],
          ports: p.ports,
          severities: p.severities,
          timeoutSec: p.timeoutSec ?? undefined,
        };
    }
    console.log(`[worker] scan ${scanId} starting (${target.domain})`);
    // Poll the cancel flag and abort the in-flight run (kills child processes).
    const controller = new AbortController();
    const poll = setInterval(() => {
      void db
        .select()
        .from(scans)
        .where(eq(scans.id, scanId))
        .then(([s]) => {
          if (s?.cancelRequested && !controller.signal.aborted) {
            console.log(`[worker] scan ${scanId} cancellation requested`);
            controller.abort();
          }
        });
    }, 2000);
    try {
      await runScanPipeline(
        {
          scanId,
          domain: target.domain,
          predefinedSubdomains: target.predefinedSubdomains,
          profile,
          signal: controller.signal,
        },
        { db, onProgress: (stage, msg) => console.log(`[scan ${scanId}] ${stage}: ${msg}`) },
      );
    } finally {
      clearInterval(poll);
    }
    const [done] = await db.select().from(scans).where(eq(scans.id, scanId));
    if (done) {
      const counts = (done.counts ?? {}) as Record<string, number>;
      await sendProjectNotifications(db, done.projectId, {
        type: done.status === 'completed' ? 'scan.completed' : 'scan.failed',
        title: `Scan ${done.status}: ${target.domain}`,
        message: `${counts.endpoints ?? 0} endpoints · ${counts.ports ?? 0} ports · ${counts.vulnerabilities ?? 0} vulns`,
        severity: done.status === 'completed' ? 'success' : 'error',
        fields: { Status: done.status, Target: target.domain },
      });
    }
  });

  await queue.work('ti-refresh', tiJobSchema, async ({ projectId }) => {
    console.log(`[worker] threat-intel refresh ${projectId}`);
    await refreshThreatIntel({
      db,
      projectId,
      otxKey: env.OTX_API_KEY,
      leakKey: env.LEAKCHECK_API_KEY,
      onProgress: (p, msg) => console.log(`[ti ${projectId}] ${p}% ${msg}`),
    });
  });

  await queue.work('echo', z.object({ msg: z.string() }), async (p) => console.log(`[worker] echo: ${p.msg}`));

  console.log('[worker] started; consuming scan + ti-refresh queues');

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
