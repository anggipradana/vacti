import { createDb } from './client';
import { runMigrations } from './migrate';
import { scanProfiles } from './recon-schema';

/** Default global scan profiles (projectId = null) — selectable presets in the UI/API. */
const DEFAULT_PROFILES = [
  {
    name: 'Quick',
    tools: { subfinder: true, httpx: true, naabu: false, nuclei: true, wordfence: false },
    ports: 'top-100',
    severities: ['critical', 'high'],
    timeoutSec: 300,
  },
  {
    name: 'Standard',
    tools: { subfinder: true, httpx: true, naabu: true, nuclei: true, wordfence: true },
    ports: 'top-100',
    severities: ['critical', 'high', 'medium', 'low'],
    timeoutSec: 600,
  },
  {
    name: 'Deep',
    tools: { subfinder: true, httpx: true, naabu: true, nuclei: true, wordfence: true },
    ports: 'top-1000',
    severities: ['critical', 'high', 'medium', 'low', 'info'],
    timeoutSec: 1800,
  },
];

/** Idempotent seed: inserts the default global profiles if not already present (by name). */
export async function seed(connectionString: string): Promise<void> {
  await runMigrations(connectionString);
  const { db, close } = createDb(connectionString);
  try {
    const existing = await db.select().from(scanProfiles);
    const names = new Set(existing.filter((p) => p.projectId === null).map((p) => p.name));
    const toInsert = DEFAULT_PROFILES.filter((p) => !names.has(p.name)).map((p) => ({ ...p, projectId: null }));
    if (toInsert.length) {
      await db.insert(scanProfiles).values(toInsert);
      console.log(
        `[seed] inserted ${toInsert.length} default scan profile(s): ${toInsert.map((p) => p.name).join(', ')}`,
      );
    } else {
      console.log('[seed] default scan profiles already present — nothing to do');
    }
  } finally {
    await close();
  }
}

// Allow running directly: `DATABASE_URL=… tsx libs/db/src/seed.ts`.
if (process.argv[1] && process.argv[1].endsWith('seed.ts')) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('[seed] DATABASE_URL is required');
    process.exit(1);
  }
  seed(url)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[seed] failed:', err);
      process.exit(1);
    });
}
