import { inArray } from 'drizzle-orm';
import { scans } from '@vacti/db';
import { getDb } from '../../../../lib/db';
import { getCurrentUser } from '../../../../lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TERMINAL = new Set(['completed', 'failed', 'cancelled']);

/**
 * Session-authed progress poll for one or more scans (used by the Attack Surface passive-recon
 * progress bar). GET ?ids=id1,id2 -> { scans: [{id,status,stage}], done }.
 */
export async function GET(req: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  const ids = (new URL(req.url).searchParams.get('ids') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (ids.length === 0) return Response.json({ ok: true, scans: [], done: true });

  const rows = await getDb()
    .select({ id: scans.id, status: scans.status, stage: scans.stage })
    .from(scans)
    .where(inArray(scans.id, ids));
  const done = rows.length > 0 && rows.every((r) => TERMINAL.has(r.status));
  return Response.json({ ok: true, scans: rows, done });
}
