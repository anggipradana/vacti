import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { generateApiToken } from '@vacti/auth';
import { createDb, runMigrations, users, apiTokens, projects, type Database } from '@vacti/db';
import { buildApi } from './app';

const url = process.env.DATABASE_URL;

describe.skipIf(!url)('@vacti/api', () => {
  let handle: { db: Database; close: () => Promise<void> };
  let app: ReturnType<typeof buildApi>;
  let token = '';
  let projectId = '';
  const enqueued: string[] = [];

  beforeAll(async () => {
    await runMigrations(url!);
    handle = createDb(url!);
    const db = handle.db;
    const [u] = await db
      .insert(users)
      .values({ email: `api${Date.now()}@x.com`, passwordHash: 'x' })
      .returning();
    const t = generateApiToken();
    token = t.plaintext;
    await db.insert(apiTokens).values({ userId: u!.id, label: 'test', tokenHash: t.hash });
    const [p] = await db
      .insert(projects)
      .values({ slug: `api${Date.now()}`, name: 'API' })
      .returning();
    projectId = p!.id;
    app = buildApi({ db, enqueueScan: async (id) => void enqueued.push(id), enqueueTiRefresh: async () => {} });
  });
  afterAll(() => handle?.close());

  const auth = () => ({ Authorization: `Bearer ${token}`, 'content-type': 'application/json' });

  it('exposes a public health endpoint', async () => {
    expect((await app.request('/api/health')).status).toBe(200);
  });

  it('requires a bearer token', async () => {
    expect((await app.request('/api/whoami')).status).toBe(401);
  });

  it('accepts a valid token', async () => {
    const r = await app.request('/api/whoami', { headers: auth() });
    expect(r.status).toBe(200);
  });

  it('creates a target then a scan (queued + enqueued) and reads it back', async () => {
    const tr = await app.request('/api/targets', {
      method: 'POST',
      headers: auth(),
      body: JSON.stringify({ projectId, domain: 'example.com', predefinedSubdomains: ['a.example.com'] }),
    });
    expect(tr.status).toBe(201);
    const { target } = (await tr.json()) as { target: { id: string } };

    const sr = await app.request('/api/scans', {
      method: 'POST',
      headers: auth(),
      body: JSON.stringify({ targetId: target.id }),
    });
    expect(sr.status).toBe(202);
    const { scan } = (await sr.json()) as { scan: { id: string; status: string } };
    expect(scan.status).toBe('queued');
    expect(enqueued).toContain(scan.id);

    expect((await app.request(`/api/scans/${scan.id}`, { headers: auth() })).status).toBe(200);
    const results = await app.request(`/api/scans/${scan.id}/results`, { headers: auth() });
    expect(results.status).toBe(200);
    expect((await results.json()).endpoints).toEqual([]);
  });

  it('cancels a queued scan (sets cancelled) and is idempotent on terminal scans', async () => {
    const tr = await app.request('/api/targets', {
      method: 'POST',
      headers: auth(),
      body: JSON.stringify({ projectId, domain: 'cancel.com' }),
    });
    const { target } = (await tr.json()) as { target: { id: string } };
    const sr = await app.request('/api/scans', {
      method: 'POST',
      headers: auth(),
      body: JSON.stringify({ targetId: target.id }),
    });
    const { scan } = (await sr.json()) as { scan: { id: string } };
    const cancel = await app.request(`/api/scans/${scan.id}/cancel`, { method: 'POST', headers: auth() });
    expect(cancel.status).toBe(200);
    expect((await cancel.json()).scan.status).toBe('cancelled');
    // Idempotent: cancelling an already-cancelled scan is a no-op 200.
    const again = await app.request(`/api/scans/${scan.id}/cancel`, { method: 'POST', headers: auth() });
    expect(again.status).toBe(200);
  });

  it('paginates the scans list (limit/offset/total)', async () => {
    const r = await app.request('/api/scans?limit=1&offset=0', { headers: auth() });
    expect(r.status).toBe(200);
    const body = (await r.json()) as { scans: unknown[]; total: number; limit: number; offset: number };
    expect(body.limit).toBe(1);
    expect(body.scans.length).toBeLessThanOrEqual(1);
    expect(typeof body.total).toBe('number');
  });

  it('search returns categorised hits', async () => {
    const r = await app.request('/api/search?q=example', { headers: auth() });
    expect(r.status).toBe(200);
    const body = (await r.json()) as { hits: { kind: string }[] };
    expect(Array.isArray(body.hits)).toBe(true);
  });

  it('rejects an invalid target payload', async () => {
    const r = await app.request('/api/targets', {
      method: 'POST',
      headers: auth(),
      body: JSON.stringify({ domain: '' }),
    });
    expect(r.status).toBe(400);
  });

  describe('RBAC enforcement', () => {
    // Mint a token for a given role and return an auth header factory.
    const tokenFor = async (role: string) => {
      const db = handle.db;
      const [u] = await db
        .insert(users)
        .values({ email: `${role}${Date.now()}@x.com`, passwordHash: 'x', role })
        .returning();
      const t = generateApiToken();
      await db.insert(apiTokens).values({ userId: u!.id, label: role, tokenHash: t.hash });
      return () => ({ Authorization: `Bearer ${t.plaintext}`, 'content-type': 'application/json' });
    };

    it('Auditor can read but not mutate', async () => {
      const aud = await tokenFor('Auditor');
      expect((await app.request('/api/scans', { headers: aud() })).status).toBe(200); // read OK
      const post = await app.request('/api/scans', {
        method: 'POST',
        headers: aud(),
        body: JSON.stringify({ targetId: '00000000-0000-0000-0000-000000000000' }),
      });
      expect(post.status).toBe(403); // initiate_scans denied
      const tg = await app.request('/api/targets', {
        method: 'POST',
        headers: aud(),
        body: JSON.stringify({ projectId, domain: 'denied.com' }),
      });
      expect(tg.status).toBe(403); // modify_targets denied
    });

    it('PenetrationTester is denied system config (webhooks)', async () => {
      const pt = await tokenFor('PenetrationTester');
      const wh = await app.request('/api/webhooks', {
        method: 'POST',
        headers: pt(),
        body: JSON.stringify({ projectId, channel: 'generic', url: 'https://example.com/hook' }),
      });
      expect(wh.status).toBe(403);
    });

    it('SysAdmin can do system config', async () => {
      const sa = await tokenFor('SysAdmin');
      const wh = await app.request('/api/webhooks', {
        method: 'POST',
        headers: sa(),
        body: JSON.stringify({ projectId, channel: 'generic', url: 'https://example.com/hook' }),
      });
      expect(wh.status).toBe(201);
    });
  });
});
