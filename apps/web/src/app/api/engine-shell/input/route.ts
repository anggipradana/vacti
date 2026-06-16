import { NextResponse, type NextRequest } from 'next/server';
import { sendInput, resize, getSession } from '@vacti/api';
import { userCan, Permission } from '@vacti/core';
import { getCurrentUser } from '../../../../lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Operator keystrokes / a terminal resize -> queued for the engine's PTY (via the engine's next pull). */
export async function POST(req: NextRequest): Promise<Response> {
  const user = await getCurrentUser();
  if (!user || !userCan(user, Permission.ModifySystemConfig))
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as {
    sessionId?: string;
    data?: string;
    cols?: number;
    rows?: number;
  };
  if (!body.sessionId || !getSession(body.sessionId))
    return NextResponse.json({ error: 'no session' }, { status: 404 });
  if (typeof body.cols === 'number' && typeof body.rows === 'number') resize(body.sessionId, body.cols, body.rows);
  if (typeof body.data === 'string') sendInput(body.sessionId, body.data);
  return NextResponse.json({ ok: true });
}
