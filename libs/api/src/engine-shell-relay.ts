/**
 * In-memory relay for interactive remote shell / Claude Code sessions to an OUTBOUND-ONLY engine.
 *
 * The live PTY runs ON the engine. The engine cannot be connected TO (no inbound port), so it INITIATES
 * the relay: it long-polls `pull` for control + the operator's keystrokes and POSTs PTY `output` back.
 * The operator's browser streams that output over SSE and POSTs keystrokes. vacti is the meeting point.
 *
 *   browser --(SSE output / POST input)--> vacti relay <--(long-poll pull / POST output)-- engine PTY
 *
 * Single app instance holds the registry; it is pinned to globalThis so Next.js route-bundle duplication
 * can never split it into two registries (engine route + browser route must share the same sessions).
 * Sessions are ephemeral (lost on app restart, which also drops the engine's PTYs - acceptable for an
 * interactive console). The DB row (pentest_engine_shell_sessions) is the durable audit trail.
 */

export type ShellKind = 'shell' | 'claude';

/** A frame the engine pulls: start a PTY, feed it input, resize it, or kill it. */
export type EngineFrame =
  | { type: 'start'; sessionId: string; kind: ShellKind; cols: number; rows: number }
  | { type: 'input'; sessionId: string; data: string }
  | { type: 'resize'; sessionId: string; cols: number; rows: number }
  | { type: 'close'; sessionId: string };

interface Session {
  id: string;
  engineId: string;
  kind: ShellKind;
  openedBy: string;
  closed: boolean;
  /** PTY output chunks fanned out to the browser's SSE writer(s). */
  browserSinks: Set<(chunk: string) => void>;
  /** Best-effort transcript (capped) for the audit row. */
  transcript: string;
}

interface Registry {
  sessions: Map<string, Session>;
  /** Per-engine queue of frames waiting for that engine's next `pull`. */
  engineQueues: Map<string, EngineFrame[]>;
  /** Per-engine resolver for a parked long-poll (woken when a frame is enqueued). */
  engineWaiters: Map<string, (frames: EngineFrame[]) => void>;
}

const g = globalThis as unknown as { __vactiEngineShellRelay?: Registry };
const reg: Registry = (g.__vactiEngineShellRelay ??= {
  sessions: new Map(),
  engineQueues: new Map(),
  engineWaiters: new Map(),
});

const TRANSCRIPT_CAP = 256 * 1024; // keep the last ~256KB for the audit row

function enqueue(engineId: string, frame: EngineFrame): void {
  const waiter = reg.engineWaiters.get(engineId);
  if (waiter) {
    reg.engineWaiters.delete(engineId);
    waiter([frame]);
    return;
  }
  const q = reg.engineQueues.get(engineId) ?? [];
  q.push(frame);
  reg.engineQueues.set(engineId, q);
}

/** Operator opens a session: register it + tell the engine to start a PTY. Returns the session id. */
export function openSession(opts: {
  sessionId: string;
  engineId: string;
  kind: ShellKind;
  openedBy: string;
  cols?: number;
  rows?: number;
}): void {
  const s: Session = {
    id: opts.sessionId,
    engineId: opts.engineId,
    kind: opts.kind,
    openedBy: opts.openedBy,
    closed: false,
    browserSinks: new Set(),
    transcript: '',
  };
  reg.sessions.set(opts.sessionId, s);
  enqueue(opts.engineId, {
    type: 'start',
    sessionId: opts.sessionId,
    kind: opts.kind,
    cols: opts.cols ?? 120,
    rows: opts.rows ?? 30,
  });
}

export function getSession(
  sessionId: string,
): { engineId: string; kind: ShellKind; openedBy: string; closed: boolean } | null {
  const s = reg.sessions.get(sessionId);
  return s ? { engineId: s.engineId, kind: s.kind, openedBy: s.openedBy, closed: s.closed } : null;
}

/** Browser -> engine: operator keystrokes. */
export function sendInput(sessionId: string, data: string): boolean {
  const s = reg.sessions.get(sessionId);
  if (!s || s.closed) return false;
  enqueue(s.engineId, { type: 'input', sessionId, data });
  return true;
}

export function resize(sessionId: string, cols: number, rows: number): boolean {
  const s = reg.sessions.get(sessionId);
  if (!s || s.closed) return false;
  enqueue(s.engineId, { type: 'resize', sessionId, cols, rows });
  return true;
}

/** Engine -> browser: PTY output. Fans out to every attached SSE writer + appends the transcript. */
export function pushOutput(sessionId: string, data: string): void {
  const s = reg.sessions.get(sessionId);
  if (!s) return;
  s.transcript = (s.transcript + data).slice(-TRANSCRIPT_CAP);
  for (const sink of s.browserSinks) {
    try {
      sink(data);
    } catch {
      /* a dead sink is removed when its stream cancels */
    }
  }
}

/** Browser attaches an SSE writer; returns a detach function. */
export function attachBrowser(sessionId: string, sink: (chunk: string) => void): () => void {
  const s = reg.sessions.get(sessionId);
  if (!s) return () => {};
  s.browserSinks.add(sink);
  return () => s.browserSinks.delete(sink);
}

/** Close a session: stop the PTY on the engine + drop it. Returns the captured transcript for the audit row. */
export function closeSession(sessionId: string): string {
  const s = reg.sessions.get(sessionId);
  if (!s) return '';
  s.closed = true;
  enqueue(s.engineId, { type: 'close', sessionId });
  const transcript = s.transcript;
  // Keep the row briefly so a late output post does not recreate sinks; drop after a tick.
  reg.sessions.delete(sessionId);
  return transcript;
}

/**
 * Engine long-poll: resolve immediately with any queued frames, else PARK until the next frame (or the
 * timeout fires, returning [] so the engine re-polls - keeps the connection fresh through proxies).
 */
export function pullFrames(engineId: string, timeoutMs = 25_000): Promise<EngineFrame[]> {
  const q = reg.engineQueues.get(engineId);
  if (q && q.length) {
    reg.engineQueues.delete(engineId);
    return Promise.resolve(q);
  }
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      if (reg.engineWaiters.get(engineId) === wake) reg.engineWaiters.delete(engineId);
      resolve([]);
    }, timeoutMs);
    const wake = (frames: EngineFrame[]) => {
      clearTimeout(timer);
      resolve(frames);
    };
    reg.engineWaiters.set(engineId, wake);
  });
}
