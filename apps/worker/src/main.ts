import { and, count, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { loadEnv } from '@vacti/config';
import { cronMatches, Severity, SEVERITY_LABEL, type SeverityValue } from '@vacti/core';
import {
  createDb,
  runMigrations,
  scans,
  targets,
  scanProfiles,
  scanSchedules,
  vulnerabilities,
  leakcheckData,
} from '@vacti/db';
import { createQueue } from '@vacti/queue';
import { runScanPipeline, type ScanProfile } from '@vacti/recon';
import { refreshThreatIntel } from '@vacti/threat-intel';
import { sendProjectNotifications, getProjectSecret } from '@vacti/integrations';

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
          config: (p.config as ScanProfile['config']) ?? undefined,
          timeoutSec: p.timeoutSec ?? undefined,
        };
    }
    // Sub-scan: a per-scan tool subset overrides the profile's tools.
    if (scan.toolsOverride) {
      profile = { ...profile, tools: scan.toolsOverride as ScanProfile['tools'] };
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
          customHeaders: (target.customHeaders as Record<string, string> | null) ?? undefined,
          signal: controller.signal,
        },
        { db, onProgress: (stage, msg) => console.log(`[scan ${scanId}] ${stage}: ${msg}`) },
      );
    } finally {
      clearInterval(poll);
    }
    const [done] = await db.select().from(scans).where(eq(scans.id, scanId));
    if (done && done.status !== 'cancelled') {
      const counts = (done.counts ?? {}) as Record<string, number>;
      await sendProjectNotifications(db, done.projectId, {
        type: done.status === 'completed' ? 'scan.completed' : 'scan.failed',
        title: `Scan ${done.status}: ${target.domain}`,
        message: `${counts.endpoints ?? 0} endpoints · ${counts.ports ?? 0} ports · ${counts.vulnerabilities ?? 0} vulns`,
        severity: done.status === 'completed' ? 'success' : 'error',
        fields: { Status: done.status, Target: target.domain },
      });

      // Dedicated high-severity alert so subscribers can be paged on the findings that matter.
      if (done.status === 'completed') {
        const sev = await db
          .select()
          .from(vulnerabilities)
          .where(
            and(
              eq(vulnerabilities.scanId, scanId),
              inArray(vulnerabilities.severity, [Severity.Critical, Severity.High]),
            ),
          );
        if (sev.length) {
          const crit = sev.filter((v) => v.severity === Severity.Critical).length;
          const preview = sev
            .slice(0, 5)
            .map((v) => `${SEVERITY_LABEL[v.severity as SeverityValue].toUpperCase()} · ${v.name}`)
            .join('\n');
          await sendProjectNotifications(db, done.projectId, {
            type: 'vuln.found',
            title: `${sev.length} high/critical finding(s): ${target.domain}`,
            message: preview + (sev.length > 5 ? `\n…and ${sev.length - 5} more` : ''),
            severity: crit > 0 ? 'error' : 'warning',
            fields: { Target: target.domain, Critical: String(crit), High: String(sev.length - crit) },
          });
        }
      }
    }
  });

  await queue.work('ti-refresh', tiJobSchema, async ({ projectId }) => {
    console.log(`[worker] threat-intel refresh ${projectId}`);
    // Per-project vault keys override the environment defaults.
    const otxKey = (await getProjectSecret(db, projectId, 'otx', env.ENCRYPTION_KEY)) ?? env.OTX_API_KEY;
    const leakKey = (await getProjectSecret(db, projectId, 'leakcheck', env.ENCRYPTION_KEY)) ?? env.LEAKCHECK_API_KEY;
    const leaksBefore = await db
      .select({ n: count() })
      .from(leakcheckData)
      .where(eq(leakcheckData.projectId, projectId));
    await refreshThreatIntel({
      db,
      projectId,
      otxKey,
      leakKey,
      onProgress: (p, msg) => console.log(`[ti ${projectId}] ${p}% ${msg}`),
    });
    const leaksAfter = await db
      .select({ n: count() })
      .from(leakcheckData)
      .where(eq(leakcheckData.projectId, projectId));
    const newLeaks = Number(leaksAfter[0]?.n ?? 0) - Number(leaksBefore[0]?.n ?? 0);
    if (newLeaks > 0) {
      await sendProjectNotifications(db, projectId, {
        type: 'ti.refreshed',
        title: `${newLeaks} new leaked credential(s)`,
        message: `Threat-intel refresh surfaced ${newLeaks} newly leaked credential(s) for this project.`,
        severity: 'warning',
        fields: { 'New leaks': String(newLeaks) },
      });
    }
  });

  await queue.work('echo', z.object({ msg: z.string() }), async (p) => console.log(`[worker] echo: ${p.msg}`));

  // Scheduled scans — a once-a-minute tick evaluates scan_schedules (lightweight cron, no Celery-beat).
  await queue.work('schedule-tick', z.unknown(), async () => {
    const now = new Date();
    const minute = Math.floor(now.getTime() / 60000);
    const rows = await db.select().from(scanSchedules).where(eq(scanSchedules.enabled, true));
    for (const s of rows) {
      if (!cronMatches(s.cron, now)) continue;
      // Idempotent within a minute (the tick may fire slightly more than once).
      if (s.lastRunAt && Math.floor(s.lastRunAt.getTime() / 60000) === minute) continue;
      const [target] = await db.select().from(targets).where(eq(targets.id, s.targetId));
      if (!target) continue;
      const [scan] = await db
        .insert(scans)
        .values({ projectId: target.projectId, targetId: target.id, profileId: s.profileId ?? null })
        .returning();
      await queue.enqueue('scan', scanJobSchema, { scanId: scan!.id });
      await db.update(scanSchedules).set({ lastRunAt: now }).where(eq(scanSchedules.id, s.id));
      console.log(`[worker] scheduled scan ${scan!.id} for ${target.domain} (cron ${s.cron})`);
    }
  });
  await queue.schedule('schedule-tick', '* * * * *');

  console.log('[worker] started; consuming scan + ti-refresh + schedule-tick queues');

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
