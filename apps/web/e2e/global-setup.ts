import { execSync } from 'node:child_process';
import { Pool } from 'pg';

/** Apply migrations and reset the e2e database so the first-run admin flow is deterministic. */
export default async function globalSetup(): Promise<void> {
  const url = process.env.DATABASE_URL ?? 'postgres://vacti:vacti@localhost:5432/vacti_e2e';
  execSync('npx drizzle-kit migrate', { stdio: 'inherit', env: { ...process.env, DATABASE_URL: url } });
  const pool = new Pool({ connectionString: url });
  await pool.query('TRUNCATE users, sessions, api_tokens, projects, project_members RESTART IDENTITY CASCADE');
  await pool.end();
}
