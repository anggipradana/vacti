import { Hono } from 'hono';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { hashToken } from '@vacti/auth';
import {
  apiTokens,
  users,
  targets,
  scanProfiles,
  scans,
  scanActivity,
  subdomains,
  endpoints,
  ports as portsTable,
  vulnerabilities,
  type Database,
} from '@vacti/db';

export interface ApiDeps {
  db: Database;
  /** Enqueue a scan job for the worker to process. Injected so the API stays queue-agnostic. */
  enqueueScan: (scanId: string) => Promise<void>;
}

type Vars = { userId: string };

const createTargetSchema = z.object({
  projectId: z.string().uuid(),
  domain: z.string().min(1),
  predefinedSubdomains: z.array(z.string()).optional(),
});
const createProfileSchema = z.object({
  projectId: z.string().uuid().optional(),
  name: z.string().min(1),
  tools: z.object({
    subfinder: z.boolean().optional(),
    httpx: z.boolean().optional(),
    naabu: z.boolean().optional(),
    nuclei: z.boolean().optional(),
    wordfence: z.boolean().optional(),
  }),
  ports: z.string().default('top-100'),
  severities: z.array(z.string()).default(['critical', 'high', 'medium', 'low']),
});
const createScanSchema = z.object({ targetId: z.string().uuid(), profileId: z.string().uuid().optional() });

/**
 * API-first REST surface (Hono). Every recon operation is callable here for testing & tool
 * integration. Auth = Bearer API token. OpenAPI auto-gen is layered in the api-and-integrations epic.
 */
export function buildApi(deps: ApiDeps): Hono<{ Variables: Vars }> {
  const { db } = deps;
  const app = new Hono<{ Variables: Vars }>().basePath('/api');

  app.get('/health', (c) => c.json({ status: 'ok' }));

  // Bearer-token auth for everything except /health.
  app.use('/*', async (c, next) => {
    if (c.req.path === '/api/health') return next();
    const auth = c.req.header('authorization');
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : undefined;
    if (!token) return c.json({ error: 'missing bearer token' }, 401);
    const [row] = await db
      .select()
      .from(apiTokens)
      .where(eq(apiTokens.tokenHash, hashToken(token)));
    if (!row) return c.json({ error: 'invalid token' }, 401);
    c.set('userId', row.userId);
    await next();
  });

  app.get('/whoami', async (c) => {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, c.get('userId')));
    return c.json({ userId: c.get('userId'), email: user?.email ?? null });
  });

  // Targets
  app.get('/targets', async (c) => {
    const projectId = c.req.query('projectId');
    const rows = projectId
      ? await db.select().from(targets).where(eq(targets.projectId, projectId))
      : await db.select().from(targets);
    return c.json({ targets: rows });
  });
  app.post('/targets', async (c) => {
    const parsed = createTargetSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return c.json({ error: parsed.error.issues }, 400);
    const [row] = await db
      .insert(targets)
      .values({ ...parsed.data, predefinedSubdomains: parsed.data.predefinedSubdomains ?? [] })
      .returning();
    return c.json({ target: row }, 201);
  });

  // Scan profiles
  app.get('/profiles', async (c) => c.json({ profiles: await db.select().from(scanProfiles) }));
  app.post('/profiles', async (c) => {
    const parsed = createProfileSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return c.json({ error: parsed.error.issues }, 400);
    const [row] = await db.insert(scanProfiles).values(parsed.data).returning();
    return c.json({ profile: row }, 201);
  });

  // Scans
  app.post('/scans', async (c) => {
    const parsed = createScanSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return c.json({ error: parsed.error.issues }, 400);
    const [target] = await db.select().from(targets).where(eq(targets.id, parsed.data.targetId));
    if (!target) return c.json({ error: 'target not found' }, 404);
    const [scan] = await db
      .insert(scans)
      .values({ projectId: target.projectId, targetId: target.id, profileId: parsed.data.profileId ?? null })
      .returning();
    await deps.enqueueScan(scan!.id);
    return c.json({ scan }, 202);
  });
  app.get('/scans', async (c) => {
    const projectId = c.req.query('projectId');
    const rows = projectId
      ? await db.select().from(scans).where(eq(scans.projectId, projectId)).orderBy(desc(scans.createdAt))
      : await db.select().from(scans).orderBy(desc(scans.createdAt));
    return c.json({ scans: rows });
  });
  app.get('/scans/:id', async (c) => {
    const id = c.req.param('id');
    const [scan] = await db.select().from(scans).where(eq(scans.id, id));
    if (!scan) return c.json({ error: 'not found' }, 404);
    const activity = await db
      .select()
      .from(scanActivity)
      .where(eq(scanActivity.scanId, id))
      .orderBy(scanActivity.createdAt);
    return c.json({ scan, activity });
  });
  app.get('/scans/:id/results', async (c) => {
    const id = c.req.param('id');
    const [scan] = await db.select().from(scans).where(eq(scans.id, id));
    if (!scan) return c.json({ error: 'not found' }, 404);
    const [subs, eps, prt, vulns] = await Promise.all([
      db.select().from(subdomains).where(eq(subdomains.scanId, id)),
      db.select().from(endpoints).where(eq(endpoints.scanId, id)),
      db.select().from(portsTable).where(eq(portsTable.scanId, id)),
      db.select().from(vulnerabilities).where(eq(vulnerabilities.scanId, id)),
    ]);
    return c.json({ subdomains: subs, endpoints: eps, ports: prt, vulnerabilities: vulns });
  });

  // SSE progress — streams scan activity, polling the DB.
  app.get('/scans/:id/events', (c) => {
    const id = c.req.param('id');
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let lastCount = 0;
        for (let i = 0; i < 600; i++) {
          const acts = await db
            .select()
            .from(scanActivity)
            .where(eq(scanActivity.scanId, id))
            .orderBy(scanActivity.createdAt);
          for (const a of acts.slice(lastCount)) {
            controller.enqueue(encoder.encode(`event: activity\ndata: ${JSON.stringify(a)}\n\n`));
          }
          lastCount = acts.length;
          const [scan] = await db.select().from(scans).where(eq(scans.id, id));
          if (scan && ['completed', 'failed', 'cancelled'].includes(scan.status)) {
            controller.enqueue(encoder.encode(`event: done\ndata: ${JSON.stringify({ status: scan.status })}\n\n`));
            break;
          }
          await new Promise((r) => setTimeout(r, 1000));
        }
        controller.close();
      },
    });
    return new Response(stream, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
    });
  });

  return app;
}
