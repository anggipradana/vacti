import { NextResponse, type NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { closeSession, getSession } from '@vacti/api';
import { userCan, Permission } from '@vacti/core';
import { pentestEngineShellSessions } from '@vacti/db';
import { getDb } from '../../../../lib/db';
import { getCurrentUser } from '../../../../lib/session';
import { recordAudit } from '../../../../lib/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Operator closes the session: kill the engine PTY + persist the transcript on the audit row. */
export async function POST(req: NextRequest): Promise<Response> {
  const user = await getCurrentUser();
  if (!user || !userCan(user, Permission.ModifySystemConfig))
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { sessionId?: string };
  if (!body.sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
  const sess = getSession(body.sessionId);
  const transcript = closeSession(body.sessionId);
  const db = getDb();
  await db
    .update(pentestEngineShellSessions)
    .set({ status: 'closed', closedAt: new Date(), transcript: transcript.slice(-200_000) || null })
    .where(eq(pentestEngineShellSessions.id, body.sessionId));
  if (sess)
    await recordAudit({ actorId: user.id, action: 'pentest.engine.shell.close', resource: `engine:${sess.engineId}` });
  return NextResponse.json({ ok: true });
}
