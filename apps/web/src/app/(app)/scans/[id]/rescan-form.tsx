'use client';

import * as React from 'react';
import { Button } from '../../../../components/ui/button';
import { Checkbox } from '../../../../components/ui/checkbox';

const STAGES = ['subfinder', 'httpx', 'naabu', 'nuclei', 'wordfence'];

/**
 * Rescan trigger via plain fetch + window.location: the old server action redirected to the new
 * scan, and that redirect is dropped on this heavy page (the same bug as the New-scan dialog). For
 * an active scan the tool checkboxes allow a sub-scan; a passive rescan re-runs OSINT only.
 */
export function RescanForm({ scanId, passive }: { scanId: string; passive: boolean }) {
  const [starting, setStarting] = React.useState(false);
  const [err, setErr] = React.useState('');

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (starting) return;
    setStarting(true);
    setErr('');
    const tools = passive ? [] : Array.from(new FormData(e.currentTarget).getAll('tools')).map(String);
    try {
      const res = await fetch('/api/internal/rescan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: scanId, tools }),
      });
      const data = (await res.json()) as { ok?: boolean; scanId?: string };
      if (data.ok && data.scanId) {
        window.location.assign(`/scans/${data.scanId}`);
        return;
      }
      setErr('Could not start the rescan, try again.');
      setStarting(false);
    } catch {
      setErr('Request failed, try again.');
      setStarting(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
      {passive ? (
        <span className="text-xs font-medium text-fg-subtle">Re-run passive recon for this target:</span>
      ) : (
        <>
          <span className="text-xs font-medium text-fg-subtle">Rescan (uncheck tools for a sub-scan):</span>
          {STAGES.map((t) => (
            <label key={t} className="flex items-center gap-1 text-xs">
              <Checkbox name="tools" value={t} defaultChecked /> {t}
            </label>
          ))}
        </>
      )}
      <Button type="submit" size="sm" loading={starting}>
        {starting ? 'Starting...' : 'Rescan'}
      </Button>
      {err ? <span className="text-xs text-danger">{err}</span> : null}
    </form>
  );
}
