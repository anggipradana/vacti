import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { userCan, Permission } from '@vacti/core';
import { scans, targets } from '@vacti/db';
import { getDb } from '../../../../lib/db';
import { getCurrentUser } from '../../../../lib/session';
import { getQueue } from '../../../../lib/queue';
import { recordAudit } from '../../../../lib/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const scanJob = z.object({ scanId: z.string().uuid() });

/**
 * Session-authed JSON endpoint to start a scan, called by the New-scan dialog via plain fetch: the
 * server action's redirect response gets dropped on the scans page in production, which left the
 * button spinning while the scan silently started. POST {targetId, mode?, profileId?, deepScan?}
 * -> { ok, scanId }; the client navigates with window.location (a full load, never dropped).
 */
export async function POST(req: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  if (!userCan(user, Permission.InitiateScans)) {
    return Response.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    targetId?: string;
    profileId?: string;
    mode?: string;
    deepScan?: boolean;
  };
  const targetId = body.targetId ?? '';
  const profileId = (body.profileId ?? '').trim() || null;
  const mode = body.mode === 'passive' || body.mode === 'full' ? body.mode : 'active';
  const deepScan = body.deepScan === true;
  const db = getDb();
  const [target] = await db.select().from(targets).where(eq(targets.id, targetId));
  if (!target) return Response.json({ ok: false, error: 'no_target' }, { status: 400 });
  const [scan] = await db
    .insert(scans)
    .values({ projectId: target.projectId, targetId: target.id, profileId, mode, deepScan })
    .returning();
  await recordAudit({
    actorId: user.id,
    action: 'scan.start',
    resource: `scan:${scan!.id}`,
    projectId: target.projectId,
    metadata: { targetId },
  });
  const q = await getQueue();
  await q.enqueue('scan', scanJob, { scanId: scan!.id });
  return Response.json({ ok: true, scanId: scan!.id });
}
