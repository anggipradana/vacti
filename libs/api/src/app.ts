import { Hono } from 'hono';
import { z } from 'zod';
import { hashToken, hashPassword, generateApiToken } from '@vacti/auth';
import {
  isVulnStatus,
  isLeakStatus,
  isNewsStatus,
  hasPermission,
  roleFromUser,
  isRoleName,
  Role,
  Permission,
  isValidCron,
  type RoleName,
} from '@vacti/core';
import type { Context } from 'hono';
import { computeProjectRisk, isSector } from '@vacti/threat-intel';
import { diffScans, type ScanResultKeys } from '@vacti/recon';
import { dispatchWebhook, type Channel } from '@vacti/integrations';
import { openApiSpec, redocHtml } from './openapi';
import {
  apiTokens,
  users,
  projects,
  projectMembers,
  targets,
  scanProfiles,
  scans,
  scanActivity,
  subdomains,
  endpoints,
  ports as portsTable,
  vulnerabilities,
  manualIndicators,
  otxThreatData,
  leakcheckData,
  threatIntelStatus,
  threatNews,
  brandNews,
  webhooks,
  scanSchedules,
  searchAll,
  discoveredUrls,
  exposureFindings,
  ipResolutions,
  type Database,
} from '@vacti/db';
import { and, eq, desc, count as sqlCount, inArray } from 'drizzle-orm';

export interface ApiDeps {
  db: Database;
  /** Enqueue a scan job for the worker to process. Injected so the API stays queue-agnostic. */
  enqueueScan: (scanId: string) => Promise<void>;
  /** Enqueue a Threat-Intel refresh job for a project. */
  enqueueTiRefresh: (projectId: string) => Promise<void>;
}

type Vars = { userId: string; role: RoleName };

/** Permission gate for mutating routes. Returns a 403 Response when denied, else null. */
function guard(c: Context<{ Variables: Vars }>, permission: (typeof Permission)[keyof typeof Permission]) {
  return hasPermission(c.get('role'), permission) ? null : c.json({ error: 'forbidden' }, 403);
}

const createUserSchema = z.object({
  email: z.string().regex(/^[^@\s]+@[^@\s]+\.[^@\s]+$/),
  password: z.string().min(8),
  role: z.string().refine(isRoleName),
});
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
const createScanSchema = z.object({
  targetId: z.string().uuid(),
  profileId: z.string().uuid().optional(),
  mode: z.enum(['active', 'passive', 'full']).optional(),
  deepScan: z.boolean().optional(),
});

/**
 * API-first REST surface (Hono). Every recon operation is callable here for testing & tool
 * integration. Auth = Bearer API token. OpenAPI auto-gen is layered in the api-and-integrations epic.
 */
export function buildApi(deps: ApiDeps): Hono<{ Variables: Vars }> {
  const { db } = deps;
  const app = new Hono<{ Variables: Vars }>().basePath('/api');

  app.get('/health', (c) => c.json({ status: 'ok' }));
  app.get('/openapi.json', (c) => c.json(openApiSpec()));
  app.get('/docs', (c) => c.html(redocHtml()));

  // Bearer-token auth for everything except /health.
  app.use('/*', async (c, next) => {
    if (['/api/health', '/api/openapi.json', '/api/docs'].includes(c.req.path)) return next();
    const auth = c.req.header('authorization');
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : undefined;
    if (!token) return c.json({ error: 'missing bearer token' }, 401);
    const [row] = await db
      .select()
      .from(apiTokens)
      .where(eq(apiTokens.tokenHash, hashToken(token)));
    if (!row) return c.json({ error: 'invalid token' }, 401);
    const [user] = await db.select().from(users).where(eq(users.id, row.userId));
    c.set('userId', row.userId);
    c.set('role', roleFromUser(user));
    await next();
  });

  // Universal search across projects/targets/scans/subdomains/endpoints/vulns.
  app.get('/search', async (c) => {
    const q = c.req.query('q') ?? '';
    return c.json(await searchAll(db, q));
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
    const g = guard(c, Permission.ModifyTargets);
    if (g) return g;
    const parsed = createTargetSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return c.json({ error: parsed.error.issues }, 400);
    const [row] = await db
      .insert(targets)
      .values({ ...parsed.data, predefinedSubdomains: parsed.data.predefinedSubdomains ?? [] })
      .returning();
    return c.json({ target: row }, 201);
  });
  app.patch('/targets/:id', async (c) => {
    const g = guard(c, Permission.ModifyTargets);
    if (g) return g;
    const body = z
      .object({
        domain: z.string().trim().min(1),
        predefinedSubdomains: z.array(z.string()).optional(),
        customHeaders: z.record(z.string()).nullable().optional(),
      })
      .safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) return c.json({ error: body.error.issues }, 400);
    const [row] = await db
      .update(targets)
      .set({
        domain: body.data.domain,
        predefinedSubdomains: body.data.predefinedSubdomains ?? [],
        customHeaders: body.data.customHeaders ?? null,
      })
      .where(eq(targets.id, c.req.param('id')))
      .returning();
    if (!row) return c.json({ error: 'not found' }, 404);
    return c.json({ target: row });
  });

  // Scan profiles
  app.get('/profiles', async (c) => c.json({ profiles: await db.select().from(scanProfiles) }));
  app.post('/profiles', async (c) => {
    const g = guard(c, Permission.ModifyScanConfig);
    if (g) return g;
    const parsed = createProfileSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return c.json({ error: parsed.error.issues }, 400);
    const [row] = await db.insert(scanProfiles).values(parsed.data).returning();
    return c.json({ profile: row }, 201);
  });
  app.patch('/profiles/:id', async (c) => {
    const g = guard(c, Permission.ModifyScanConfig);
    if (g) return g;
    // Mirrors editProfileAction's field set: name + per-tool toggles, ports, severities, rate, config.
    const body = z
      .object({
        name: z.string().trim().min(1),
        tools: z
          .object({
            subfinder: z.boolean().optional(),
            httpx: z.boolean().optional(),
            naabu: z.boolean().optional(),
            nuclei: z.boolean().optional(),
            wordfence: z.boolean().optional(),
          })
          .optional(),
        ports: z.string().optional(),
        severities: z.array(z.string()).optional(),
        rate: z.number().nullable().optional(),
        config: z.record(z.unknown()).nullable().optional(),
      })
      .safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) return c.json({ error: body.error.issues }, 400);
    const set: Record<string, unknown> = { name: body.data.name };
    if (body.data.tools !== undefined) set.tools = body.data.tools;
    if (body.data.ports !== undefined) set.ports = body.data.ports.trim() || 'top-100';
    if (body.data.severities !== undefined)
      set.severities = body.data.severities.length ? body.data.severities : ['critical', 'high', 'medium', 'low'];
    if (body.data.rate !== undefined) set.rate = body.data.rate;
    if (body.data.config !== undefined) set.config = body.data.config;
    const [row] = await db
      .update(scanProfiles)
      .set(set)
      .where(eq(scanProfiles.id, c.req.param('id')))
      .returning();
    if (!row) return c.json({ error: 'not found' }, 404);
    return c.json({ profile: row });
  });
  app.delete('/profiles/:id', async (c) => {
    const g = guard(c, Permission.ModifyScanConfig);
    if (g) return g;
    await db.delete(scanProfiles).where(eq(scanProfiles.id, c.req.param('id')));
    return c.json({ ok: true });
  });

  // Scans
  app.post('/scans', async (c) => {
    const g = guard(c, Permission.InitiateScans);
    if (g) return g;
    const parsed = createScanSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return c.json({ error: parsed.error.issues }, 400);
    const [target] = await db.select().from(targets).where(eq(targets.id, parsed.data.targetId));
    if (!target) return c.json({ error: 'target not found' }, 404);
    const [scan] = await db
      .insert(scans)
      .values({
        projectId: target.projectId,
        targetId: target.id,
        profileId: parsed.data.profileId ?? null,
        mode: parsed.data.mode ?? 'active',
        deepScan: parsed.data.deepScan ?? false,
      })
      .returning();
    await deps.enqueueScan(scan!.id);
    return c.json({ scan }, 202);
  });
  app.get('/scans', async (c) => {
    const projectId = c.req.query('projectId');
    // Server-side pagination: ?limit (1..100, default 25) & ?offset.
    const limit = Math.min(100, Math.max(1, Number(c.req.query('limit') ?? 25) || 25));
    const offset = Math.max(0, Number(c.req.query('offset') ?? 0) || 0);
    const where = projectId ? eq(scans.projectId, projectId) : undefined;
    const base = db.select().from(scans);
    const rows = await (where ? base.where(where) : base).orderBy(desc(scans.createdAt)).limit(limit).offset(offset);
    const countBase = db.select({ n: sqlCount() }).from(scans);
    const totalRows = await (where ? countBase.where(where) : countBase);
    return c.json({ scans: rows, total: Number(totalRows[0]?.n ?? 0), limit, offset });
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

  // ── Projects ──
  app.post('/projects', async (c) => {
    const g = guard(c, Permission.ModifyTargets);
    if (g) return g;
    const body = z
      .object({ name: z.string().trim().min(1), slug: z.string().trim() })
      .safeParse(await c.req.json().catch(() => ({})));
    if (!body.success || !/^[a-z][a-z0-9-]*$/.test(body.data.slug)) return c.json({ error: 'invalid' }, 400);
    const [project] = await db.insert(projects).values({ name: body.data.name, slug: body.data.slug }).returning();
    await db.insert(projectMembers).values({ projectId: project!.id, userId: c.get('userId'), role: Role.SysAdmin });
    return c.json({ project }, 201);
  });
  app.patch('/projects/:id', async (c) => {
    const g = guard(c, Permission.ModifyTargets);
    if (g) return g;
    const body = z
      .object({ name: z.string().trim().min(1), sector: z.string(), slug: z.string().trim().optional() })
      .safeParse(await c.req.json().catch(() => ({})));
    if (!body.success || !isSector(body.data.sector)) return c.json({ error: 'invalid' }, 400);
    const set: { name: string; sector: string; updatedAt: Date; slug?: string } = {
      name: body.data.name,
      sector: body.data.sector,
      updatedAt: new Date(),
    };
    if (body.data.slug) {
      if (!/^[a-z][a-z0-9-]*$/.test(body.data.slug)) return c.json({ error: 'invalid' }, 400);
      set.slug = body.data.slug;
    }
    const [row] = await db
      .update(projects)
      .set(set)
      .where(eq(projects.id, c.req.param('id')))
      .returning();
    if (!row) return c.json({ error: 'not found' }, 404);
    return c.json({ project: row });
  });
  app.post('/projects/:id/default', async (c) => {
    const g = guard(c, Permission.ModifyTargets);
    if (g) return g;
    const id = c.req.param('id');
    // Single default: clear the flag everywhere, then set it on the chosen project.
    await db.update(projects).set({ isDefault: false }).where(eq(projects.isDefault, true));
    const [row] = await db.update(projects).set({ isDefault: true }).where(eq(projects.id, id)).returning();
    if (!row) return c.json({ error: 'not found' }, 404);
    return c.json({ project: row });
  });

  // ── Destructive CRUD (RBAC-guarded, cascade via FK) ──
  app.delete('/projects/:id', async (c) => {
    const g = guard(c, Permission.ModifyTargets);
    if (g) return g;
    await db.delete(projects).where(eq(projects.id, c.req.param('id')));
    return c.json({ ok: true });
  });
  app.delete('/targets/:id', async (c) => {
    const g = guard(c, Permission.ModifyTargets);
    if (g) return g;
    await db.delete(targets).where(eq(targets.id, c.req.param('id')));
    return c.json({ ok: true });
  });
  app.delete('/scans/:id', async (c) => {
    const g = guard(c, Permission.InitiateScans);
    if (g) return g;
    await db.delete(scans).where(eq(scans.id, c.req.param('id')));
    return c.json({ ok: true });
  });
  app.delete('/vulnerabilities/:id', async (c) => {
    const g = guard(c, Permission.ModifyScanResults);
    if (g) return g;
    await db.delete(vulnerabilities).where(eq(vulnerabilities.id, c.req.param('id')));
    return c.json({ ok: true });
  });
  app.delete('/leaks/:id', async (c) => {
    const g = guard(c, Permission.ModifyScanResults);
    if (g) return g;
    await db.delete(leakcheckData).where(eq(leakcheckData.id, c.req.param('id')));
    return c.json({ ok: true });
  });
  app.delete('/surface/findings/:id', async (c) => {
    const g = guard(c, Permission.ModifyScanResults);
    if (g) return g;
    await db.delete(exposureFindings).where(eq(exposureFindings.id, c.req.param('id')));
    return c.json({ ok: true });
  });
  // ── User management (SysAdmin-only; same invariants as the web actions) ──
  app.post('/users', async (c) => {
    const g = guard(c, Permission.ModifySystemConfig);
    if (g) return g;
    const parsed = createUserSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return c.json({ error: 'invalid' }, 400);
    const email = parsed.data.email.trim().toLowerCase();
    const { role } = parsed.data;
    const [existing] = await db.select().from(users).where(eq(users.email, email));
    if (existing) return c.json({ error: 'exists' }, 409);
    const [u] = await db
      .insert(users)
      .values({
        email,
        passwordHash: await hashPassword(parsed.data.password),
        role,
        isSysAdmin: role === Role.SysAdmin,
      })
      .returning();
    return c.json({ id: u!.id, email: u!.email, role });
  });
  app.delete('/users/:id', async (c) => {
    const g = guard(c, Permission.ModifySystemConfig);
    if (g) return g;
    const id = c.req.param('id');
    if (id === c.get('userId')) return c.json({ error: 'cannot delete self' }, 409);
    const [target] = await db.select().from(users).where(eq(users.id, id));
    if (!target) return c.json({ error: 'not found' }, 404);
    if (roleFromUser(target) === Role.SysAdmin) {
      const admins = (await db.select().from(users).where(eq(users.role, Role.SysAdmin))).length;
      if (admins <= 1) return c.json({ error: 'last sysadmin' }, 409);
    }
    await db.delete(users).where(eq(users.id, id));
    return c.json({ ok: true });
  });
  app.patch('/users/:id', async (c) => {
    const g = guard(c, Permission.ModifySystemConfig);
    if (g) return g;
    const id = c.req.param('id');
    const body = z.object({ role: z.string() }).safeParse(await c.req.json().catch(() => ({})));
    if (!body.success || !isRoleName(body.data.role)) return c.json({ error: 'invalid' }, 400);
    const role = body.data.role;
    // Don't let an admin demote themselves out of the last SysAdmin seat.
    if (id === c.get('userId') && role !== Role.SysAdmin) {
      const admins = (await db.select().from(users).where(eq(users.role, Role.SysAdmin))).length;
      if (admins <= 1) return c.json({ error: 'last sysadmin' }, 409);
    }
    const [row] = await db
      .update(users)
      .set({ role, isSysAdmin: role === Role.SysAdmin, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    if (!row) return c.json({ error: 'not found' }, 404);
    return c.json({ user: { id: row.id, email: row.email, role: row.role } });
  });
  app.post('/users/:id/reset-password', async (c) => {
    const g = guard(c, Permission.ModifySystemConfig);
    if (g) return g;
    const body = z.object({ password: z.string().min(8) }).safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) return c.json({ error: 'invalid' }, 400);
    const [row] = await db
      .update(users)
      .set({ passwordHash: await hashPassword(body.data.password), updatedAt: new Date() })
      .where(eq(users.id, c.req.param('id')))
      .returning();
    if (!row) return c.json({ error: 'not found' }, 404);
    return c.json({ ok: true });
  });

  // ── API tokens (scoped to the authed user) ──
  app.get('/tokens', async (c) => {
    const rows = await db
      .select({ id: apiTokens.id, label: apiTokens.label, createdAt: apiTokens.createdAt })
      .from(apiTokens)
      .where(eq(apiTokens.userId, c.get('userId')));
    return c.json({ tokens: rows });
  });
  app.post('/tokens', async (c) => {
    const body = z.object({ label: z.string().optional() }).safeParse(await c.req.json().catch(() => ({})));
    const label = body.success ? body.data.label?.trim() || 'token' : 'token';
    const { plaintext, hash } = generateApiToken();
    const [row] = await db
      .insert(apiTokens)
      .values({ userId: c.get('userId'), label, tokenHash: hash })
      .returning();
    // Plaintext is returned ONCE here and never stored — only the hash persists.
    return c.json({ token: plaintext, id: row!.id, label: row!.label }, 201);
  });
  app.delete('/tokens/:id', async (c) => {
    await db.delete(apiTokens).where(and(eq(apiTokens.id, c.req.param('id')), eq(apiTokens.userId, c.get('userId'))));
    return c.json({ ok: true });
  });

  // Attack-surface (passive recon) read endpoints — scoped to a project.
  app.get('/surface/urls', async (c) => {
    const projectId = c.req.query('projectId');
    if (!projectId) return c.json({ error: 'projectId required' }, 400);
    const limit = Math.min(500, Math.max(1, Number(c.req.query('limit') ?? 100) || 100));
    const offset = Math.max(0, Number(c.req.query('offset') ?? 0) || 0);
    const cat = c.req.query('category');
    const where = and(eq(discoveredUrls.projectId, projectId), cat ? eq(discoveredUrls.categorySlug, cat) : undefined);
    const rows = await db
      .select()
      .from(discoveredUrls)
      .where(where)
      .orderBy(desc(discoveredUrls.createdAt))
      .limit(limit)
      .offset(offset);
    const tot = await db.select({ n: sqlCount() }).from(discoveredUrls).where(where);
    return c.json({ urls: rows, total: Number(tot[0]?.n ?? 0), limit, offset });
  });
  app.get('/surface/findings', async (c) => {
    const projectId = c.req.query('projectId');
    if (!projectId) return c.json({ error: 'projectId required' }, 400);
    const type = c.req.query('type');
    const where = and(
      eq(exposureFindings.projectId, projectId),
      type ? eq(exposureFindings.findingType, type) : undefined,
    );
    const rows = await db
      .select()
      .from(exposureFindings)
      .where(where)
      .orderBy(desc(exposureFindings.createdAt))
      .limit(500);
    return c.json({ findings: rows });
  });
  app.post('/surface/findings/bulk/status', async (c) => {
    const g = guard(c, Permission.ModifyScanResults);
    if (g) return g;
    const body = z
      .object({ ids: z.array(z.string()), status: z.string() })
      .safeParse(await c.req.json().catch(() => ({})));
    if (!body.success || !body.data.ids.length || !isLeakStatus(body.data.status))
      return c.json({ error: 'invalid' }, 400);
    await db
      .update(exposureFindings)
      .set({ status: body.data.status })
      .where(inArray(exposureFindings.id, body.data.ids));
    return c.json({ ok: true });
  });
  app.post('/surface/findings/:id/status', async (c) => {
    const g = guard(c, Permission.ModifyScanResults);
    if (g) return g;
    const body = z.object({ status: z.string() }).safeParse(await c.req.json().catch(() => ({})));
    if (!body.success || !isLeakStatus(body.data.status)) return c.json({ error: 'invalid status' }, 400);
    const [row] = await db
      .update(exposureFindings)
      .set({ status: body.data.status })
      .where(eq(exposureFindings.id, c.req.param('id')))
      .returning();
    if (!row) return c.json({ error: 'not found' }, 404);
    return c.json({ finding: row });
  });
  app.post('/surface/findings/:id/note', async (c) => {
    const g = guard(c, Permission.ModifyScanResults);
    if (g) return g;
    const body = z.object({ note: z.string().optional() }).safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) return c.json({ error: body.error.issues }, 400);
    const [row] = await db
      .update(exposureFindings)
      .set({ analystNote: body.data.note?.trim() || null })
      .where(eq(exposureFindings.id, c.req.param('id')))
      .returning();
    if (!row) return c.json({ error: 'not found' }, 404);
    return c.json({ finding: row });
  });
  app.get('/surface/ips', async (c) => {
    const projectId = c.req.query('projectId');
    if (!projectId) return c.json({ error: 'projectId required' }, 400);
    const rows = await db
      .select()
      .from(ipResolutions)
      .where(eq(ipResolutions.projectId, projectId))
      .orderBy(desc(ipResolutions.latestResolvedAt));
    return c.json({ ips: rows });
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

  // Cancel a running/queued scan (cooperative: sets a flag the worker polls).
  app.post('/scans/:id/cancel', async (c) => {
    const g = guard(c, Permission.InitiateScans);
    if (g) return g;
    const id = c.req.param('id');
    const [scan] = await db.select().from(scans).where(eq(scans.id, id));
    if (!scan) return c.json({ error: 'not found' }, 404);
    if (['completed', 'failed', 'cancelled'].includes(scan.status)) return c.json({ scan });
    if (scan.status === 'queued') {
      const [row] = await db
        .update(scans)
        .set({ status: 'cancelled', cancelRequested: true, finishedAt: new Date() })
        .where(eq(scans.id, id))
        .returning();
      return c.json({ scan: row });
    }
    const [row] = await db.update(scans).set({ cancelRequested: true }).where(eq(scans.id, id)).returning();
    return c.json({ scan: row }, 202);
  });

  // Compare two scans (added/removed/unchanged per category).
  const scanKeys = async (scanId: string): Promise<ScanResultKeys> => {
    const [subs, eps, prt, vulns] = await Promise.all([
      db.select().from(subdomains).where(eq(subdomains.scanId, scanId)),
      db.select().from(endpoints).where(eq(endpoints.scanId, scanId)),
      db.select().from(portsTable).where(eq(portsTable.scanId, scanId)),
      db.select().from(vulnerabilities).where(eq(vulnerabilities.scanId, scanId)),
    ]);
    return {
      subdomains: subs.map((s) => s.host),
      endpoints: eps.map((e) => e.url),
      ports: prt.map((p) => `${p.ip}:${p.port}`),
      vulns: vulns.map((v) => `${v.templateId}@${v.matchedAt ?? v.url ?? ''}`),
    };
  };
  app.get('/scans/:id/diff', async (c) => {
    const id = c.req.param('id');
    const against = c.req.query('against');
    if (!against) return c.json({ error: 'against query param required' }, 400);
    const [a] = await db.select().from(scans).where(eq(scans.id, against));
    const [b] = await db.select().from(scans).where(eq(scans.id, id));
    if (!a || !b) return c.json({ error: 'not found' }, 404);
    const diff = diffScans(await scanKeys(against), await scanKeys(id));
    return c.json({ baseline: against, current: id, diff });
  });

  // ---- Scheduled scans ----
  app.get('/schedules', async (c) => c.json({ schedules: await db.select().from(scanSchedules) }));
  app.post('/schedules', async (c) => {
    const g = guard(c, Permission.InitiateScans);
    if (g) return g;
    const body = z
      .object({ targetId: z.string().uuid(), cron: z.string(), profileId: z.string().uuid().optional() })
      .safeParse(await c.req.json().catch(() => ({})));
    if (!body.success || !isValidCron(body.data.cron)) return c.json({ error: 'invalid schedule' }, 400);
    const [row] = await db.insert(scanSchedules).values(body.data).returning();
    return c.json({ schedule: row }, 201);
  });
  app.patch('/schedules/:id', async (c) => {
    const g = guard(c, Permission.InitiateScans);
    if (g) return g;
    const body = z
      .object({ cron: z.string(), profileId: z.string().uuid().nullable().optional(), enabled: z.boolean().optional() })
      .safeParse(await c.req.json().catch(() => ({})));
    if (!body.success || !isValidCron(body.data.cron)) return c.json({ error: 'invalid schedule' }, 400);
    const set: { cron: string; profileId: string | null; enabled?: boolean } = {
      cron: body.data.cron,
      profileId: body.data.profileId ?? null,
    };
    if (body.data.enabled !== undefined) set.enabled = body.data.enabled;
    const [row] = await db
      .update(scanSchedules)
      .set(set)
      .where(eq(scanSchedules.id, c.req.param('id')))
      .returning();
    if (!row) return c.json({ error: 'not found' }, 404);
    return c.json({ schedule: row });
  });
  app.post('/schedules/:id/toggle', async (c) => {
    const g = guard(c, Permission.InitiateScans);
    if (g) return g;
    const id = c.req.param('id');
    const [row] = await db.select().from(scanSchedules).where(eq(scanSchedules.id, id));
    if (!row) return c.json({ error: 'not found' }, 404);
    const [updated] = await db
      .update(scanSchedules)
      .set({ enabled: !row.enabled })
      .where(eq(scanSchedules.id, id))
      .returning();
    return c.json({ schedule: updated });
  });
  app.delete('/schedules/:id', async (c) => {
    const g = guard(c, Permission.InitiateScans);
    if (g) return g;
    await db.delete(scanSchedules).where(eq(scanSchedules.id, c.req.param('id')));
    return c.json({ status: 'deleted' });
  });

  // ---- Threat Intelligence ----
  app.get('/threat-intel', async (c) => {
    const projectId = c.req.query('projectId');
    if (!projectId) return c.json({ error: 'projectId required' }, 400);
    const [risk, otx, leaks, indicators, status] = await Promise.all([
      computeProjectRisk(db, projectId),
      db.select().from(otxThreatData).where(eq(otxThreatData.projectId, projectId)),
      db.select().from(leakcheckData).where(eq(leakcheckData.projectId, projectId)),
      db.select().from(manualIndicators).where(eq(manualIndicators.projectId, projectId)),
      db.select().from(threatIntelStatus).where(eq(threatIntelStatus.projectId, projectId)),
    ]);
    return c.json({ risk, otx, leaks, indicators, status: status[0] ?? null });
  });

  app.post('/threat-intel/refresh', async (c) => {
    const g = guard(c, Permission.InitiateScans);
    if (g) return g;
    const body = z.object({ projectId: z.string().uuid() }).safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) return c.json({ error: body.error.issues }, 400);
    await deps.enqueueTiRefresh(body.data.projectId);
    return c.json({ status: 'queued' }, 202);
  });

  // Brand-monitoring refresh. There is no brand-only job, so this reuses the ti-refresh enqueue.
  app.post('/threat-intel/brand-refresh', async (c) => {
    const g = guard(c, Permission.ModifyScanResults);
    if (g) return g;
    const body = z.object({ projectId: z.string().uuid() }).safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) return c.json({ error: body.error.issues }, 400);
    await deps.enqueueTiRefresh(body.data.projectId);
    return c.json({ status: 'queued' }, 202);
  });

  app.get('/indicators', async (c) => {
    const projectId = c.req.query('projectId');
    const rows = projectId
      ? await db.select().from(manualIndicators).where(eq(manualIndicators.projectId, projectId))
      : await db.select().from(manualIndicators);
    return c.json({ indicators: rows });
  });
  app.post('/indicators', async (c) => {
    const g = guard(c, Permission.ModifyScanResults);
    if (g) return g;
    const body = z
      .object({
        projectId: z.string().uuid(),
        type: z.enum(['domain', 'subdomain', 'ip']),
        value: z.string().min(1),
        note: z.string().optional(),
      })
      .safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) return c.json({ error: body.error.issues }, 400);
    const [row] = await db.insert(manualIndicators).values(body.data).returning();
    return c.json({ indicator: row }, 201);
  });
  app.patch('/indicators/:id', async (c) => {
    const g = guard(c, Permission.ModifyScanResults);
    if (g) return g;
    const body = z
      .object({
        type: z.enum(['domain', 'subdomain', 'ip']),
        value: z.string().trim().min(1),
        note: z.string().optional(),
      })
      .safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) return c.json({ error: body.error.issues }, 400);
    const [row] = await db
      .update(manualIndicators)
      .set({ type: body.data.type, value: body.data.value, note: body.data.note?.trim() || null })
      .where(eq(manualIndicators.id, c.req.param('id')))
      .returning();
    if (!row) return c.json({ error: 'not found' }, 404);
    return c.json({ indicator: row });
  });
  app.delete('/indicators/:id', async (c) => {
    const g = guard(c, Permission.ModifyScanResults);
    if (g) return g;
    await db.delete(manualIndicators).where(eq(manualIndicators.id, c.req.param('id')));
    return c.json({ status: 'deleted' });
  });

  // ── Sector news (per-sector threat headlines) ──
  app.get('/news', async (c) => {
    const sector = c.req.query('sector');
    const rows = sector
      ? await db.select().from(threatNews).where(eq(threatNews.sector, sector)).orderBy(desc(threatNews.publishedAt))
      : await db.select().from(threatNews).orderBy(desc(threatNews.publishedAt)).limit(500);
    return c.json({ news: rows });
  });
  app.post('/news/bulk/status', async (c) => {
    const g = guard(c, Permission.ModifyScanResults);
    if (g) return g;
    const body = z
      .object({ ids: z.array(z.string()), status: z.string() })
      .safeParse(await c.req.json().catch(() => ({})));
    if (!body.success || !body.data.ids.length || !isNewsStatus(body.data.status))
      return c.json({ error: 'invalid' }, 400);
    await db.update(threatNews).set({ status: body.data.status }).where(inArray(threatNews.id, body.data.ids));
    return c.json({ ok: true });
  });
  app.post('/news/:id/status', async (c) => {
    const g = guard(c, Permission.ModifyScanResults);
    if (g) return g;
    const body = z.object({ status: z.string() }).safeParse(await c.req.json().catch(() => ({})));
    if (!body.success || !isNewsStatus(body.data.status)) return c.json({ error: 'invalid status' }, 400);
    const [row] = await db
      .update(threatNews)
      .set({ status: body.data.status })
      .where(eq(threatNews.id, c.req.param('id')))
      .returning();
    if (!row) return c.json({ error: 'not found' }, 404);
    return c.json({ news: row });
  });

  // ── Brand news (per-project brand-monitoring headlines) ──
  app.get('/brand-news', async (c) => {
    const projectId = c.req.query('projectId');
    const rows = projectId
      ? await db.select().from(brandNews).where(eq(brandNews.projectId, projectId)).orderBy(desc(brandNews.publishedAt))
      : await db.select().from(brandNews).orderBy(desc(brandNews.publishedAt)).limit(500);
    return c.json({ news: rows });
  });
  app.post('/brand-news/bulk/status', async (c) => {
    const g = guard(c, Permission.ModifyScanResults);
    if (g) return g;
    const body = z
      .object({ ids: z.array(z.string()), status: z.string() })
      .safeParse(await c.req.json().catch(() => ({})));
    if (!body.success || !body.data.ids.length || !isNewsStatus(body.data.status))
      return c.json({ error: 'invalid' }, 400);
    await db.update(brandNews).set({ status: body.data.status }).where(inArray(brandNews.id, body.data.ids));
    return c.json({ ok: true });
  });
  app.post('/brand-news/:id/status', async (c) => {
    const g = guard(c, Permission.ModifyScanResults);
    if (g) return g;
    const body = z.object({ status: z.string() }).safeParse(await c.req.json().catch(() => ({})));
    if (!body.success || !isNewsStatus(body.data.status)) return c.json({ error: 'invalid status' }, 400);
    const [row] = await db
      .update(brandNews)
      .set({ status: body.data.status })
      .where(eq(brandNews.id, c.req.param('id')))
      .returning();
    if (!row) return c.json({ error: 'not found' }, 404);
    return c.json({ news: row });
  });

  // Finding triage status. NOTE: bulk routes are registered before `/:id/...` so the
  // static `bulk` segment is never captured as an `:id` param by the router.
  app.post('/vulnerabilities/bulk/status', async (c) => {
    const g = guard(c, Permission.ModifyScanResults);
    if (g) return g;
    const body = z
      .object({ ids: z.array(z.string()), status: z.string() })
      .safeParse(await c.req.json().catch(() => ({})));
    if (!body.success || !body.data.ids.length || !isVulnStatus(body.data.status))
      return c.json({ error: 'invalid' }, 400);
    await db
      .update(vulnerabilities)
      .set({ status: body.data.status, statusChangedAt: new Date() })
      .where(inArray(vulnerabilities.id, body.data.ids));
    return c.json({ ok: true });
  });
  app.post('/vulnerabilities/:id/status', async (c) => {
    const g = guard(c, Permission.ModifyScanResults);
    if (g) return g;
    const body = z
      .object({ status: z.string(), note: z.string().optional() })
      .safeParse(await c.req.json().catch(() => ({})));
    if (!body.success || !isVulnStatus(body.data.status)) return c.json({ error: 'invalid status' }, 400);
    const [row] = await db
      .update(vulnerabilities)
      .set({ status: body.data.status, statusNote: body.data.note ?? null, statusChangedAt: new Date() })
      .where(eq(vulnerabilities.id, c.req.param('id')))
      .returning();
    if (!row) return c.json({ error: 'not found' }, 404);
    return c.json({ vulnerability: row });
  });

  app.post('/vulnerabilities/:id/note', async (c) => {
    const g = guard(c, Permission.ModifyScanResults);
    if (g) return g;
    const body = z.object({ note: z.string().optional() }).safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) return c.json({ error: body.error.issues }, 400);
    const [row] = await db
      .update(vulnerabilities)
      .set({ analystNote: body.data.note?.trim() || null })
      .where(eq(vulnerabilities.id, c.req.param('id')))
      .returning();
    if (!row) return c.json({ error: 'not found' }, 404);
    return c.json({ vulnerability: row });
  });

  app.post('/leaks/bulk/status', async (c) => {
    const g = guard(c, Permission.ModifyScanResults);
    if (g) return g;
    const body = z
      .object({ ids: z.array(z.string()), status: z.string() })
      .safeParse(await c.req.json().catch(() => ({})));
    if (!body.success || !body.data.ids.length || !isLeakStatus(body.data.status))
      return c.json({ error: 'invalid' }, 400);
    await db
      .update(leakcheckData)
      .set({ status: body.data.status, checked: body.data.status !== 'new' })
      .where(inArray(leakcheckData.id, body.data.ids));
    return c.json({ ok: true });
  });
  app.post('/leaks/:id/status', async (c) => {
    const g = guard(c, Permission.ModifyScanResults);
    if (g) return g;
    const body = z.object({ status: z.string() }).safeParse(await c.req.json().catch(() => ({})));
    if (!body.success || !isLeakStatus(body.data.status)) return c.json({ error: 'invalid status' }, 400);
    const [row] = await db
      .update(leakcheckData)
      .set({ status: body.data.status, checked: body.data.status !== 'new' })
      .where(eq(leakcheckData.id, c.req.param('id')))
      .returning();
    if (!row) return c.json({ error: 'not found' }, 404);
    return c.json({ leak: row });
  });

  app.post('/leaks/:id/toggle', async (c) => {
    const g = guard(c, Permission.ModifyScanResults);
    if (g) return g;
    const id = c.req.param('id');
    const [row] = await db.select().from(leakcheckData).where(eq(leakcheckData.id, id));
    if (!row) return c.json({ error: 'not found' }, 404);
    const [updated] = await db
      .update(leakcheckData)
      .set({ checked: !row.checked })
      .where(eq(leakcheckData.id, id))
      .returning();
    return c.json({ leak: updated });
  });

  // ---- Webhooks / notifications ----
  app.get('/webhooks', async (c) => {
    const projectId = c.req.query('projectId');
    const rows = projectId
      ? await db.select().from(webhooks).where(eq(webhooks.projectId, projectId))
      : await db.select().from(webhooks);
    return c.json({ webhooks: rows });
  });
  app.post('/webhooks', async (c) => {
    const g = guard(c, Permission.ModifySystemConfig);
    if (g) return g;
    const body = z
      .object({
        projectId: z.string().uuid(),
        channel: z.enum(['discord', 'slack', 'telegram', 'google_chat', 'generic']),
        label: z.string().optional(),
        url: z.string().url().optional(),
        telegramToken: z.string().optional(),
        telegramChatId: z.string().optional(),
        events: z.array(z.string()).default([]),
        enabled: z.boolean().default(true),
      })
      .safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) return c.json({ error: body.error.issues }, 400);
    const [row] = await db.insert(webhooks).values(body.data).returning();
    return c.json({ webhook: row }, 201);
  });
  app.patch('/webhooks/:id', async (c) => {
    const g = guard(c, Permission.ModifySystemConfig);
    if (g) return g;
    const body = z
      .object({
        channel: z.enum(['discord', 'slack', 'telegram', 'google_chat', 'generic']),
        label: z.string().nullable().optional(),
        url: z.string().nullable().optional(),
        telegramToken: z.string().nullable().optional(),
        telegramChatId: z.string().nullable().optional(),
        events: z.array(z.string()).optional(),
        enabled: z.boolean().optional(),
      })
      .safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) return c.json({ error: body.error.issues }, 400);
    const norm = (s: string | null | undefined) => (s && s.trim() ? s.trim() : null);
    const set: Record<string, unknown> = {
      channel: body.data.channel,
      label: norm(body.data.label),
      url: norm(body.data.url),
      telegramToken: norm(body.data.telegramToken),
      telegramChatId: norm(body.data.telegramChatId),
      events: body.data.events ?? [],
    };
    if (body.data.enabled !== undefined) set.enabled = body.data.enabled;
    const [row] = await db
      .update(webhooks)
      .set(set)
      .where(eq(webhooks.id, c.req.param('id')))
      .returning();
    if (!row) return c.json({ error: 'not found' }, 404);
    return c.json({ webhook: row });
  });
  app.delete('/webhooks/:id', async (c) => {
    const g = guard(c, Permission.ModifySystemConfig);
    if (g) return g;
    await db.delete(webhooks).where(eq(webhooks.id, c.req.param('id')));
    return c.json({ status: 'deleted' });
  });
  app.post('/webhooks/:id/test', async (c) => {
    const g = guard(c, Permission.ModifySystemConfig);
    if (g) return g;
    const [w] = await db
      .select()
      .from(webhooks)
      .where(eq(webhooks.id, c.req.param('id')));
    if (!w) return c.json({ error: 'not found' }, 404);
    const result = await dispatchWebhook({
      url: w.url ?? '',
      channel: w.channel as Channel,
      event: {
        type: 'test',
        title: 'vacti test notification',
        message: 'Your webhook is configured correctly.',
        severity: 'info',
      },
      telegram:
        w.channel === 'telegram' ? { botToken: w.telegramToken ?? '', chatId: w.telegramChatId ?? '' } : undefined,
    });
    return c.json({ result });
  });

  return app;
}
