import { Hono } from 'hono';
import { handle } from 'hono/vercel';
import { eq } from 'drizzle-orm';
import { hashToken } from '@vacti/auth';
import { apiTokens, users } from '@vacti/db';
import { getDb } from '../../../lib/db';

export const runtime = 'nodejs';

const app = new Hono().basePath('/api');

app.get('/health', (c) => c.json({ status: 'ok' }));

app.get('/whoami', async (c) => {
  const auth = c.req.header('authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : undefined;
  if (!token) return c.json({ error: 'missing bearer token' }, 401);
  const db = getDb();
  const [row] = await db
    .select()
    .from(apiTokens)
    .where(eq(apiTokens.tokenHash, hashToken(token)));
  if (!row) return c.json({ error: 'invalid token' }, 401);
  const [user] = await db.select().from(users).where(eq(users.id, row.userId));
  return c.json({ email: user?.email ?? null, tokenLabel: row.label });
});

export const GET = handle(app);
export const POST = handle(app);
