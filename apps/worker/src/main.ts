import { loadEnv } from '@vacti/config';
import { runMigrations } from '@vacti/db';
import { createQueue } from '@vacti/queue';
import { z } from 'zod';

/** Echo job — placeholder proving the round-trip; real scan handlers land in the recon-engine epic. */
const echoSchema = z.object({ msg: z.string() });

async function main(): Promise<void> {
  const env = loadEnv();
  console.log('[worker] running migrations…');
  await runMigrations(env.DATABASE_URL);

  const queue = createQueue(env.DATABASE_URL);
  await queue.start();
  await queue.work('echo', echoSchema, async (payload) => {
    console.log(`[worker] echo: ${payload.msg}`);
  });
  console.log('[worker] started; queue is consuming');

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
