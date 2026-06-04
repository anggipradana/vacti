import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  createDb,
  runMigrations,
  projects,
  targets,
  scans,
  vulnerabilities,
  threatIntelStatus,
  otxThreatData,
  type Database,
} from '@vacti/db';
import { refreshThreatIntel } from './refresh';
import { computeProjectRisk } from './risk-aggregate';

const url = process.env.DATABASE_URL;

describe.skipIf(!url)('threat-intel integration', () => {
  let handle: { db: Database; close: () => Promise<void> };
  beforeAll(async () => {
    await runMigrations(url!);
    handle = createDb(url!);
  });
  afterAll(() => handle?.close());

  it('refresh completes gracefully without API keys, and risk reflects VA', async () => {
    const db = handle.db;
    const [p] = await db
      .insert(projects)
      .values({ slug: `ti${Date.now()}`, name: 'TI' })
      .returning();
    const [t] = await db.insert(targets).values({ projectId: p!.id, domain: 'example.com' }).returning();
    const [s] = await db.insert(scans).values({ projectId: p!.id, targetId: t!.id, status: 'completed' }).returning();
    await db.insert(vulnerabilities).values({ scanId: s!.id, templateId: 'x', name: 'Critical finding', severity: 4 });

    await refreshThreatIntel({ db, projectId: p!.id }); // no keys → graceful no-op data

    const [st] = await db.select().from(threatIntelStatus).where(eq(threatIntelStatus.projectId, p!.id));
    expect(st!.state).toBe('completed');
    const otx = await db.select().from(otxThreatData).where(eq(otxThreatData.projectId, p!.id));
    expect(otx).toEqual([]);

    const risk = await computeProjectRisk(db, p!.id);
    expect(risk.score).toBeGreaterThan(0);
    expect(['yellow', 'red', 'green']).toContain(risk.color);
  }, 30000);
});
