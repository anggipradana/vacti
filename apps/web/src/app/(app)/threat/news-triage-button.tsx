'use client';

import * as React from 'react';
import { Button } from '../../../components/ui/button';

const ERR: Record<string, string> = {
  no_ai_provider: 'Set an AI provider + key first',
  no_candidates: 'Nothing new to triage',
  ai_failed: 'AI failed, try again',
};

/**
 * AI news-triage trigger via plain fetch: the AI call takes 10-30s, so a server action would be
 * reloaded through by the heavy /threat page before it returned (the result then looked like a
 * no-op). This awaits the result, then reloads once so the dismissed headlines drop out of view.
 */
export function NewsTriageButton({ projectId, kind }: { projectId: string; kind: 'sector' | 'brand' }) {
  const [loading, setLoading] = React.useState(false);
  const [msg, setMsg] = React.useState('');

  const run = async () => {
    if (loading) return;
    setLoading(true);
    setMsg('');
    try {
      const res = await fetch('/api/internal/news-triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, kind }),
      });
      const data = (await res.json()) as { ok?: boolean; dismissed?: number; error?: string };
      if (data.ok) {
        window.location.reload();
        return; // keep the spinner during reload
      }
      setMsg(ERR[data.error ?? ''] ?? 'Triage failed');
      setLoading(false);
    } catch {
      setMsg('Request failed');
      setLoading(false);
    }
  };

  return (
    <span className="inline-flex items-center gap-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        loading={loading}
        onClick={run}
        title="Auto-mark off-topic headlines as Irrelevant (learns from your past triage)"
      >
        {loading ? 'Analyzing…' : 'AI: filter irrelevant'}
      </Button>
      {msg ? <span className="text-xs text-fg-subtle">{msg}</span> : null}
    </span>
  );
}
