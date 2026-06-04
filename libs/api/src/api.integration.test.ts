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
    app = buildApi({ db, enqueueScan: async (id) => void enqueued.push(id) });
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

  it('rejects an invalid target payload', async () => {
    const r = await app.request('/api/targets', {
      method: 'POST',
      headers: auth(),
      body: JSON.stringify({ domain: '' }),
    });
    expect(r.status).toBe(400);
  });
});
