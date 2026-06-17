import { NextResponse, type NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { closeSession, getSession, terminateSession } from '@vacti/api';
import { userCan, Permission } from '@vacti/core';
import { pentestEngineShellSessions } from '@vacti/db';
import { getDb } from '../../../../lib/db';
import { getCurrentUser } from '../../../../lib/session';
import { recordAudit } from '../../../../lib/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Operator detaches or terminates a session. `terminate=true` KILLS the persistent tmux session on the
 * engine; otherwise it DETACHES (the session keeps running on the engine, reopen to reattach). Either way
 * the transcript-so-far is persisted on the audit row, and the row is only marked 'closed' on terminate.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const user = await getCurrentUser();
  if (!user || !userCan(user, Permission.ModifySystemConfig))
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { sessionId?: string; terminate?: boolean };
  if (!body.sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
  const sess = getSession(body.sessionId);
  const terminate = body.terminate === true;
  const transcript = terminate ? terminateSession(body.sessionId) : closeSession(body.sessionId);
  const db = getDb();
  await db
    .update(pentestEngineShellSessions)
    .set({
      // Detach leaves the session 'open' (it is still running on the engine); only terminate closes it.
      ...(terminate ? { status: 'closed', closedAt: new Date() } : {}),
      transcript: transcript.slice(-200_000) || null,
    })
    .where(eq(pentestEngineShellSessions.id, body.sessionId));
  if (sess)
    await recordAudit({
      actorId: user.id,
      action: terminate ? 'pentest.engine.shell.terminate' : 'pentest.engine.shell.detach',
      resource: `engine:${sess.engineId}`,
    });
  return NextResponse.json({ ok: true });
}
