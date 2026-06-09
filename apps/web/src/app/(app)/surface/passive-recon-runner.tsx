'use client';

import * as React from 'react';
import { Button } from '../../../components/ui/button';

type ScanProgress = { id: string; status: string; stage: string | null };

/**
 * Runs passive recon (VirusTotal + Wayback + URLScan) for the project and shows progress IN PLACE on
 * the Attack Surface page - via plain fetch + polling (reliable on this heavy page), so it never
 * jumps to the VA Scans dashboard. On completion it reloads once to render the freshly discovered
 * IPs / URLs (a soft refresh does not re-apply the flight on this page).
 */
export function PassiveReconRunner({ projectId }: { projectId: string }) {
  const [state, setState] = React.useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [stage, setStage] = React.useState('');
  const [msg, setMsg] = React.useState('');
  const timer = React.useRef<number | null>(null);

  React.useEffect(
    () => () => {
      if (timer.current) window.clearInterval(timer.current);
    },
    [],
  );

  const start = async () => {
    setState('running');
    setMsg('');
    setStage('queued');
    let ids: string[] = [];
    try {
      const res = await fetch('/api/internal/passive-recon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });
      const data = (await res.json()) as { ok?: boolean; scanIds?: string[]; error?: string };
      if (!data.ok) {
        setState('error');
        setMsg(data.error === 'no_targets' ? 'Add a target first' : 'Could not start');
        return;
      }
      ids = data.scanIds ?? [];
      if (ids.length === 0) {
        setState('done');
        setMsg('Nothing to run');
        return;
      }
    } catch {
      setState('error');
      setMsg('Could not start');
      return;
    }

    const poll = async () => {
      try {
        const res = await fetch(`/api/internal/scan-progress?ids=${encodeURIComponent(ids.join(','))}`, {
          cache: 'no-store',
        });
        const data = (await res.json()) as { ok?: boolean; scans?: ScanProgress[]; done?: boolean };
        const running = (data.scans ?? []).find((s) => s.status === 'running');
        setStage(running?.stage || data.scans?.[0]?.status || 'running');
        if (data.done) {
          if (timer.current) window.clearInterval(timer.current);
          setState('done');
          setMsg('Done, loading results...');
          window.setTimeout(() => window.location.reload(), 1200);
        }
      } catch {
        /* transient; keep polling */
      }
    };
    void poll();
    timer.current = window.setInterval(poll, 2500) as unknown as number;
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        size="sm"
        loading={state === 'running'}
        disabled={state === 'running'}
        onClick={start}
        data-testid="run-passive-recon"
      >
        {state === 'running' ? 'Running...' : 'Run passive recon'}
      </Button>
      {state === 'running' ? (
        <span className="flex items-center gap-2 text-xs text-fg-muted">
          <span className="inline-block h-1 w-24 overflow-hidden rounded-full bg-surface-3">
            <span className="block h-full w-1/2 animate-pulse rounded-full bg-accent" />
          </span>
          {stage ? `stage: ${stage}` : 'queued...'}
        </span>
      ) : null}
      {state === 'done' ? <span className="text-xs text-success">{msg || 'Done'}</span> : null}
      {state === 'error' ? <span className="text-xs text-danger">{msg}</span> : null}
    </div>
  );
}
