import PgBoss from 'pg-boss';
import type { z } from 'zod';

export const PGBOSS_SCHEMA = 'pgboss';

/** Validate a job payload against its Zod schema (pure - unit-testable without a DB). */
export function validatePayload<T>(schema: z.ZodType<T>, data: unknown): T {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw new Error(`Invalid job payload: ${parsed.error.issues.map((i) => i.message).join(', ')}`);
  }
  return parsed.data;
}

export interface Queue {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  enqueue: <T>(name: string, schema: z.ZodType<T>, payload: T) => Promise<string | null>;
  work: <T>(name: string, schema: z.ZodType<T>, handler: (payload: T) => Promise<void>) => Promise<string>;
  /** Register a recurring job on `name` using a 5-field cron (pg-boss native scheduler). */
  schedule: (name: string, cron: string) => Promise<void>;
}

/** Create a typed pg-boss queue. Payloads are validated with Zod on enqueue and on receipt. */
export function createQueue(connectionString: string): Queue {
  const boss = new PgBoss({ connectionString, schema: PGBOSS_SCHEMA });
  const ensured = new Set<string>();

  // pg-boss v10 requires queues to exist before send/work. Idempotent + cached per process.
  const ensureQueue = async (name: string): Promise<void> => {
    if (ensured.has(name)) return;
    try {
      await boss.createQueue(name);
    } catch {
      // Queue already exists - safe to ignore.
    }
    ensured.add(name);
  };

  return {
    start: async () => {
      await boss.start();
    },
    stop: async () => {
      await boss.stop({ graceful: true });
    },
    enqueue: async (name, schema, payload) => {
      await ensureQueue(name);
      return boss.send(name, validatePayload(schema, payload) as object);
    },
    work: async (name, schema, handler) => {
      await ensureQueue(name);
      return boss.work(name, async (jobs) => {
        for (const job of jobs) {
          await handler(validatePayload(schema, job.data));
        }
      });
    },
    schedule: async (name, cron) => {
      await ensureQueue(name);
      await boss.schedule(name, cron);
    },
  };
}
