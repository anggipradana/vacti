import { userCan, Permission } from '@vacti/core';
import { getCurrentUser } from '../../../../lib/session';
import { triageNewsForProject } from '../../../../lib/news-triage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Session-authed JSON endpoint: AI-triage untriaged news (sector or brand) for a project. Called by
 * the /threat page via plain fetch - the AI call takes 10-30s, which the heavy page's ActionForm
 * would reload through before it finished. POST { projectId, kind } -> { ok, dismissed, candidates }.
 */
export async function POST(req: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  if (!userCan(user, Permission.ModifyScanResults)) {
    return Response.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as { projectId?: string; kind?: string };
  const projectId = body.projectId ?? '';
  const kind = body.kind === 'sector' ? 'sector' : 'brand';
  if (!projectId) return Response.json({ ok: false, error: 'missing projectId' }, { status: 400 });
  return Response.json(await triageNewsForProject(projectId, kind, user.id));
}
