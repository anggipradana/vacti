'use client';

import * as React from 'react';
import { Button } from '../../../../components/ui/button';

const ERROR_TEXT: Record<string, string> = {
  no_ai_provider: 'Set an AI provider + key first (Settings > Integrations).',
  no_completed_scan: 'No completed VA scan yet for this project - run a scan first.',
  ai_failed: 'AI generation failed, try again.',
};

/**
 * Generate the AI executive summary via plain fetch and fill the VA branding form's textareas in
 * place (no reload): the AI call takes 10-30s and a server action's response gets dropped on this
 * page, which read as "nothing happened". The summary is already persisted server-side; syncing the
 * fields also prevents a later Save of the stale (empty) textareas from clobbering it.
 */
export function ExecSummaryButton({ projectId }: { projectId: string }) {
  const [loading, setLoading] = React.useState(false);
  const [msg, setMsg] = React.useState('');
  const [failed, setFailed] = React.useState(false);

  const generate = async () => {
    setLoading(true);
    setMsg('');
    setFailed(false);
    try {
      const res = await fetch('/api/internal/exec-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });
      const data = (await res.json()) as { ok?: boolean; en?: string; id?: string; error?: string };
      if (data.ok) {
        const en = document.getElementById('va-exec-en') as HTMLTextAreaElement | null;
        const idTa = document.getElementById('va-exec-id') as HTMLTextAreaElement | null;
        const show = document.getElementById('va-exec-show') as HTMLInputElement | null;
        if (en && typeof data.en === 'string') en.value = data.en;
        if (idTa && typeof data.id === 'string') idTa.value = data.id;
        if (show) show.checked = true;
        setMsg('Generated and saved (from the latest completed VA scan). Review and edit above if needed.');
      } else {
        setFailed(true);
        setMsg(ERROR_TEXT[data.error ?? ''] ?? 'Generation failed, try again.');
      }
    } catch {
      setFailed(true);
      setMsg('Request failed, try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-3 border-t border-border pt-3">
      <Button type="button" variant="outline" size="sm" loading={loading} onClick={generate}>
        {loading ? 'Generating (10-30s)...' : 'Generate executive summary with AI'}
      </Button>
      <p className={`mt-1 text-xs ${failed ? 'text-danger' : msg ? 'text-success' : 'text-fg-subtle'}`}>
        {msg || 'Uses the latest completed VA scan + the configured AI provider; fills both EN/ID.'}
      </p>
    </div>
  );
}
