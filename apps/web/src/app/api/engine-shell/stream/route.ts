import { type NextRequest } from 'next/server';
import { attachBrowser, getSession } from '@vacti/api';
import { userCan, Permission } from '@vacti/core';
import { getCurrentUser } from '../../../../lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * SSE stream of the engine PTY output to the browser terminal. Each frame is `data: <base64>` so raw
 * control bytes / newlines survive the line-based SSE transport; the client base64-decodes into xterm.js.
 * A keepalive comment every 15s keeps the stream open through proxies (cloudflared/nginx).
 */
export async function GET(req: NextRequest): Promise<Response> {
  const user = await getCurrentUser();
  if (!user || !userCan(user, Permission.ModifySystemConfig)) return new Response('forbidden', { status: 403 });
  const sessionId = new URL(req.url).searchParams.get('session');
  if (!sessionId || !getSession(sessionId)) return new Response('no session', { status: 404 });

  const encoder = new TextEncoder();
  let detach = () => {};
  let keepalive: ReturnType<typeof setInterval> | undefined;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const safeEnqueue = (s: string) => {
        try {
          controller.enqueue(encoder.encode(s));
        } catch {
          /* stream closed */
        }
      };
      detach = attachBrowser(sessionId, (chunk) =>
        safeEnqueue(`data: ${Buffer.from(chunk, 'utf8').toString('base64')}\n\n`),
      );
      safeEnqueue(': connected\n\n');
      keepalive = setInterval(() => safeEnqueue(': ka\n\n'), 15_000);
    },
    cancel() {
      detach();
      if (keepalive) clearInterval(keepalive);
    },
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
