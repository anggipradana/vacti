import { handle } from 'hono/vercel';
import { z } from 'zod';
import { buildApi } from '@vacti/api';
import { getDb } from '../../../lib/db';
import { getQueue } from '../../../lib/queue';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const scanJob = z.object({ scanId: z.string().uuid() });
const tiJob = z.object({ projectId: z.string().uuid() });

// Built lazily so `next build` never evaluates env / connects to the DB.
let handler: ReturnType<typeof handle> | undefined;
function getHandler(): ReturnType<typeof handle> {
  if (!handler) {
    const app = buildApi({
      db: getDb(),
      enqueueScan: async (scanId) => {
        const q = await getQueue();
        await q.enqueue('scan', scanJob, { scanId });
      },
      enqueueTiRefresh: async (projectId) => {
        const q = await getQueue();
        await q.enqueue('ti-refresh', tiJob, { projectId });
      },
    });
    handler = handle(app);
  }
  return handler;
}

export function GET(req: Request): Response | Promise<Response> {
  return getHandler()(req);
}
export function POST(req: Request): Response | Promise<Response> {
  return getHandler()(req);
}
