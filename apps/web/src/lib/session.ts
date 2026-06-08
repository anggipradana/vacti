import 'server-only';
import { cache } from 'react';
import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { eq } from 'drizzle-orm';
import { sessions, users } from '@vacti/db';
import { getDb } from './db';

const COOKIE = 'vacti_session';
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function createSession(userId: string): Promise<void> {
  const id = randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + TTL_MS);
  await getDb().insert(sessions).values({ id, userId, expiresAt });
  const jar = await cookies();
  jar.set(COOKIE, id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  });
}

// Per-request memoised: the shared layout + the page both call this on every navigation; cache()
// collapses those into a single DB round-trip per render (lighter, faster nav).
export const getCurrentUser = cache(async () => {
  const id = (await cookies()).get(COOKIE)?.value;
  if (!id) return null;
  const db = getDb();
  const [session] = await db.select().from(sessions).where(eq(sessions.id, id));
  if (!session || session.expiresAt < new Date()) return null;
  const [user] = await db.select().from(users).where(eq(users.id, session.userId));
  return user ?? null;
});

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const id = jar.get(COOKIE)?.value;
  if (id) await getDb().delete(sessions).where(eq(sessions.id, id));
  jar.delete(COOKIE);
}

/** Revoke every session for a user (sign out of all devices) and clear the current cookie. */
export async function destroyAllSessions(userId: string): Promise<void> {
  await getDb().delete(sessions).where(eq(sessions.userId, userId));
  (await cookies()).delete(COOKIE);
}

export async function userCount(): Promise<number> {
  const rows = await getDb().select().from(users);
  return rows.length;
}
