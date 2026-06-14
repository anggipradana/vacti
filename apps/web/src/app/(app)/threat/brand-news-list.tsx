'use client';

import * as React from 'react';
import { Sparkles } from 'lucide-react';
import { NEWS_STATUS_LABEL } from '@vacti/core';
import { Input } from '../../../components/ui/input';
import { Select } from '../../../components/ui/select';
import { Button } from '../../../components/ui/button';
import { ActionForm, ActionSubmit } from '../../../components/ui/action-form';
import { Badge } from '../../../components/ui/badge';
import { NewsStatusBadge } from '../../../components/ui/finding-status';
import { AutoSubmitSelect } from '../../../components/ui/auto-submit-select';
import { setBrandNewsStatusAction, bulkSetBrandNewsStatusByIdsAction } from '../../../lib/threat-actions';

export interface BrandNewsItem {
  id: string;
  title: string;
  link: string;
  source: string | null;
  publishedAt: string | null;
  security: boolean;
  status: string;
  aiSentiment: string | null;
  aiSentimentReason: string | null;
  sentimentFeedback: string | null;
}

const SENTIMENT_BADGE: Record<string, 'danger' | 'success' | 'neutral'> = {
  negative: 'danger',
  positive: 'success',
  neutral: 'neutral',
};

/**
 * Per-headline AI sentiment toward the brand (reputation lens): click to get a verdict
 * (negative/positive/neutral + reason) via plain fetch, then mark whether the AI was right (a
 * feedback signal). All in-place, no page reload (the threat page is a heavy page).
 */
function BrandSentiment({ item, canTriage }: { item: BrandNewsItem; canTriage: boolean }) {
  const [sentiment, setSentiment] = React.useState<string | null>(item.aiSentiment);
  const [reason, setReason] = React.useState<string | null>(item.aiSentimentReason);
  const [feedback, setFeedback] = React.useState<string | null>(item.sentimentFeedback);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState('');

  const generate = async () => {
    if (loading) return;
    setLoading(true);
    setErr('');
    try {
      const res = await fetch('/api/internal/brand-sentiment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id }),
      });
      const data = (await res.json()) as { ok?: boolean; sentiment?: string; reason?: string; error?: string };
      if (data.ok && data.sentiment) {
        setSentiment(data.sentiment);
        setReason(data.reason ?? null);
        setFeedback(null);
      } else {
        setErr(data.error === 'no_ai_provider' ? 'Set an AI provider first' : 'AI failed');
      }
    } catch {
      setErr('Request failed');
    } finally {
      setLoading(false);
    }
  };

  const mark = async (value: 'correct' | 'incorrect') => {
    const next = feedback === value ? null : value; // toggle off if re-clicked
    setFeedback(next);
    try {
      await fetch('/api/internal/brand-sentiment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, feedback: next ?? 'clear' }),
      });
    } catch {
      /* best-effort; the local state already reflects the click */
    }
  };

  if (!sentiment) {
    if (!canTriage) return null;
    return (
      <div className="mt-1.5 flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 gap-1 px-2 text-xs text-accent"
          loading={loading}
          onClick={generate}
        >
          {loading ? null : <Sparkles className="size-3.5" />}
          {loading ? 'Analyzing sentiment…' : 'AI sentiment'}
        </Button>
        {err ? <span className="text-xs text-danger">{err}</span> : null}
      </div>
    );
  }

  return (
    <div className="mt-1 flex flex-wrap items-center gap-2">
      <Badge variant={SENTIMENT_BADGE[sentiment] ?? 'neutral'} title={reason ?? undefined}>
        {sentiment}
      </Badge>
      {reason ? <span className="max-w-[28rem] truncate text-xs text-fg-subtle">{reason}</span> : null}
      {canTriage ? (
        <span className="flex items-center gap-1 text-xs text-fg-subtle">
          <span>Correct?</span>
          <button
            type="button"
            onClick={() => mark('correct')}
            aria-label="AI sentiment is correct"
            className={`rounded px-1.5 py-0.5 ${feedback === 'correct' ? 'bg-success/20 text-success' : 'hover:bg-surface-2'}`}
          >
            ✓
          </button>
          <button
            type="button"
            onClick={() => mark('incorrect')}
            aria-label="AI sentiment is wrong"
            className={`rounded px-1.5 py-0.5 ${feedback === 'incorrect' ? 'bg-danger/20 text-danger' : 'hover:bg-surface-2'}`}
          >
            ✗
          </button>
          <button
            type="button"
            onClick={generate}
            disabled={loading}
            className="ml-1 hover:text-fg-muted"
            aria-label="Regenerate sentiment"
          >
            {loading ? '…' : '↻'}
          </button>
        </span>
      ) : null}
    </div>
  );
}

const STATUS_OPTIONS = Object.entries(NEWS_STATUS_LABEL);

/**
 * Brand monitoring headline list with a text search, client status filter, and checkbox multi-select
 * for bulk status changes (canTriage only) - plus per-row instant status change (AutoSubmitSelect).
 * Header controls (server-side filter, Search now, bulk-by-filter, AI triage) live in the page.
 */
export function BrandNewsList({ items, canTriage }: { items: BrandNewsItem[]; canTriage: boolean }) {
  const [query, setQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((n) => {
      if (statusFilter !== 'all' && n.status !== statusFilter) return false;
      if (!q) return true;
      return `${n.title} ${n.source ?? ''}`.toLowerCase().includes(q);
    });
  }, [items, query, statusFilter]);

  const filteredIds = filtered.map((n) => n.id);
  const allFilteredSelected = filteredIds.length > 0 && filteredIds.every((id) => selected.has(id));
  const selectedIds = [...selected];

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAllFiltered = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) filteredIds.forEach((id) => next.delete(id));
      else filteredIds.forEach((id) => next.add(id));
      return next;
    });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {canTriage ? (
          <label className="flex items-center gap-1.5 text-xs text-fg-subtle">
            <input
              type="checkbox"
              checked={allFilteredSelected}
              onChange={toggleAllFiltered}
              aria-label="Select all shown headlines"
            />
            Select all
          </label>
        ) : null}
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search headlines (title, source)…"
          className="h-8 w-64 text-xs"
          aria-label="Search brand news"
        />
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-8 w-36 text-xs"
          aria-label="Filter brand news by status"
        >
          <option value="all">All statuses</option>
          {STATUS_OPTIONS.map(([val, label]) => (
            <option key={val} value={val}>
              {label}
            </option>
          ))}
        </Select>
        <span className="text-xs text-fg-subtle">
          {filtered.length} of {items.length}
        </span>
      </div>

      {/* Bulk action bar - appears when rows are selected. */}
      {canTriage && selected.size > 0 ? (
        <ActionForm
          action={bulkSetBrandNewsStatusByIdsAction}
          className="flex flex-wrap items-center gap-2 rounded-md border border-accent/30 bg-accent/5 px-3 py-2"
        >
          {selectedIds.map((id) => (
            <input key={id} type="hidden" name="ids" value={id} />
          ))}
          <span className="text-xs font-medium">{selected.size} selected</span>
          <Select name="status" defaultValue="reviewed" className="h-8 w-36 text-xs" aria-label="Bulk set status">
            {STATUS_OPTIONS.map(([val, label]) => (
              <option key={val} value={val}>
                Set: {label}
              </option>
            ))}
          </Select>
          <ActionSubmit size="sm" variant="primary">
            Apply to selected
          </ActionSubmit>
          <Button type="button" size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </ActionForm>
      ) : null}

      {filtered.length === 0 ? (
        <p className="py-2 text-sm text-fg-muted">No headlines match your search/filter.</p>
      ) : (
        <ul className="divide-y divide-border">
          {filtered.map((n) => (
            <li key={n.id} className="flex items-start justify-between gap-3 py-2.5">
              <div className="flex min-w-0 items-start gap-2">
                {canTriage ? (
                  <input
                    type="checkbox"
                    checked={selected.has(n.id)}
                    onChange={() => toggle(n.id)}
                    className="mt-0.5"
                    aria-label={`Select ${n.title}`}
                  />
                ) : null}
                <div className="min-w-0">
                  <a
                    href={n.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-accent hover:underline"
                  >
                    {n.title}
                  </a>
                  <div className="mt-0.5 text-xs text-fg-subtle">
                    {n.source}
                    {n.publishedAt ? ` · ${new Date(n.publishedAt).toISOString().slice(0, 10)}` : ''}
                    {n.security ? ' · security' : ''}
                  </div>
                  <BrandSentiment item={n} canTriage={canTriage} />
                </div>
              </div>
              {canTriage ? (
                <div className="flex shrink-0 items-center gap-1.5">
                  <NewsStatusBadge status={n.status} />
                  <ActionForm action={setBrandNewsStatusAction} className="flex items-center gap-1.5">
                    <input type="hidden" name="id" value={n.id} />
                    <AutoSubmitSelect
                      key={n.status}
                      name="status"
                      defaultValue={n.status}
                      className="h-8 w-36 text-xs"
                      aria-label="Change status"
                    >
                      {STATUS_OPTIONS.map(([val, label]) => (
                        <option key={val} value={val}>
                          {label}
                        </option>
                      ))}
                    </AutoSubmitSelect>
                  </ActionForm>
                </div>
              ) : (
                <Badge variant="neutral" className="shrink-0">
                  {NEWS_STATUS_LABEL[n.status as keyof typeof NEWS_STATUS_LABEL] ?? n.status}
                </Badge>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
