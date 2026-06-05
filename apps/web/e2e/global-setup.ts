import { execSync } from 'node:child_process';
import { Pool } from 'pg';

/** Apply migrations, reset the e2e database, and seed default scan profiles for a deterministic run. */
export default async function globalSetup(): Promise<void> {
  const url = process.env.DATABASE_URL ?? 'postgres://vacti:vacti@localhost:5432/vacti_e2e';
  const env = { ...process.env, DATABASE_URL: url };
  execSync('npx drizzle-kit migrate', { stdio: 'inherit', env });
  const pool = new Pool({ connectionString: url });
  // Truncating users + projects CASCADE clears all user- and project-scoped data (sessions, tokens,
  // members, audit, targets, scans, activity, results, schedules, notes, webhooks, ai/report settings,
  // TI data, vault keys). Global scan_profiles (projectId null) are reset separately, then re-seeded.
  await pool.query('TRUNCATE users, projects RESTART IDENTITY CASCADE');
  await pool.query('TRUNCATE scan_profiles RESTART IDENTITY CASCADE');
  await pool.end();
  execSync('tsx libs/db/src/seed.ts', { stdio: 'inherit', env });
}
