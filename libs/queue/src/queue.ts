import PgBoss from 'pg-boss';
import type { z } from 'zod';

export const PGBOSS_SCHEMA = 'pgboss';

/** Validate a job payload against its Zod schema (pure — unit-testable without a DB). */
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
}

/** Create a typed pg-boss queue. Payloads are validated with Zod on enqueue and on receipt. */
export function createQueue(connectionString: string): Queue {
  const boss = new PgBoss({ connectionString, schema: PGBOSS_SCHEMA });

  return {
    start: async () => {
      await boss.start();
    },
    stop: async () => {
      await boss.stop({ graceful: true });
    },
    enqueue: (name, schema, payload) => boss.send(name, validatePayload(schema, payload) as object),
    work: (name, schema, handler) =>
      boss.work(name, async (jobs) => {
        for (const job of jobs) {
          await handler(validatePayload(schema, job.data));
        }
      }),
  };
}
