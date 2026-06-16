import { NextResponse, type NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { openSession, type ShellKind } from '@vacti/api';
import { userCan, Permission } from '@vacti/core';
import { pentestEngines, pentestEngineShellSessions } from '@vacti/db';
import { getDb } from '../../../../lib/db';
import { getCurrentUser } from '../../../../lib/session';
import { recordAudit } from '../../../../lib/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Operator opens an interactive remote session to an engine. RBAC: ModifySystemConfig (a remote shell /
 * autonomous Claude on the engine is a powerful, audited capability). Creates the audit row + registers
 * the relay session (which tells the engine, on its next pull, to spawn the PTY). Returns the session id.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const user = await getCurrentUser();
  if (!user || !userCan(user, Permission.ModifySystemConfig))
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as {
    engineId?: string;
    kind?: string;
    cols?: number;
    rows?: number;
  };
  const kind: ShellKind = body.kind === 'claude' ? 'claude' : 'shell';
  if (!body.engineId) return NextResponse.json({ error: 'engineId required' }, { status: 400 });

  const db = getDb();
  const [eng] = await db.select().from(pentestEngines).where(eq(pentestEngines.id, body.engineId)).limit(1);
  if (!eng) return NextResponse.json({ error: 'engine not found' }, { status: 404 });

  const sessionId = randomUUID();
  await db
    .insert(pentestEngineShellSessions)
    .values({ id: sessionId, engineId: eng.engineId, kind, openedBy: user.id });
  openSession({ sessionId, engineId: eng.engineId, kind, openedBy: user.id, cols: body.cols, rows: body.rows });
  await recordAudit({
    actorId: user.id,
    action: 'pentest.engine.shell.open',
    resource: `engine:${eng.engineId}:${kind}`,
  });
  return NextResponse.json({ sessionId });
}
