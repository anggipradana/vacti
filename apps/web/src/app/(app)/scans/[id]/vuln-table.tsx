'use client';

import * as React from 'react';
import { VULN_STATUS_LABEL, type SeverityValue } from '@vacti/core';
import { Table, THead, TBody, TR, TH, TD } from '../../../../components/ui/table';
import { Button } from '../../../../components/ui/button';
import { ActionForm, ActionSubmit } from '../../../../components/ui/action-form';
import { Input } from '../../../../components/ui/input';
import { Textarea } from '../../../../components/ui/textarea';
import { Select } from '../../../../components/ui/select';
import { SeverityBadge } from '../../../../components/ui/severity-badge';
import { VulnStatusBadge } from '../../../../components/ui/finding-status';
import { AutoSubmitSelect } from '../../../../components/ui/auto-submit-select';
// (Badge intentionally not imported - read-only status uses VulnStatusBadge.)
import {
  setVulnStatusAction,
  setVulnNoteAction,
  bulkSetVulnStatusByIdsAction,
  deleteVulnAction,
} from '../../../../lib/status-actions';

export interface VulnRow {
  id: string;
  name: string;
  matchedAt: string | null;
  severity: number;
  status: string;
  description: string | null;
  remediation: string | null;
  cvss: number | null;
  cveIds: string[];
  references: string[];
  isAiEnriched: boolean;
  aiDescription: string | null;
  aiImpact: string | null;
  aiRemediation: string | null;
  request: string | null;
  response: string | null;
  analystNote: string | null;
}

const PAGE_SIZE = 50;
const STATUS_OPTIONS = Object.entries(VULN_STATUS_LABEL);

/**
 * Findings table with a text search, status filter, and checkbox multi-select for bulk status
 * changes - plus per-row instant status change (AutoSubmitSelect), AI enrich and delete.
 */
export function VulnTable({ vulns, scanId, canTriage }: { vulns: VulnRow[]; scanId: string; canTriage: boolean }) {
  const [query, setQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [page, setPage] = React.useState(1);

  // AI enrichment runs via a plain fetch (reliable on this heavy page, unlike a server action whose
  // response gets dropped) and shows the result inline - a spinner on the button, no page reload.
  type Enrichment = { description: string; impact: string; remediation: string };
  const [enriched, setEnriched] = React.useState<Record<string, Enrichment>>({});
  const [enriching, setEnriching] = React.useState<string | null>(null);
  const [enrichMsg, setEnrichMsg] = React.useState<Record<string, string>>({});
  const runEnrich = async (id: string) => {
    setEnriching(id);
    setEnrichMsg((m) => ({ ...m, [id]: '' }));
    try {
      const res = await fetch('/api/internal/enrich-vuln', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = (await res.json()) as { ok?: boolean; enrichment?: Enrichment; error?: string };
      if (data.ok && data.enrichment) {
        setEnriched((e) => ({ ...e, [id]: data.enrichment! }));
      } else {
        setEnrichMsg((m) => ({
          ...m,
          [id]: data.error === 'no_ai_provider' ? 'Set an AI provider + key first' : 'AI failed, try again',
        }));
      }
    } catch {
      setEnrichMsg((m) => ({ ...m, [id]: 'Request failed' }));
    } finally {
      setEnriching(null);
    }
  };

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return vulns.filter((v) => {
      if (statusFilter !== 'all' && v.status !== statusFilter) return false;
      if (!q) return true;
      return `${v.name} ${v.matchedAt ?? ''} ${v.cveIds.join(' ')}`.toLowerCase().includes(q);
    });
  }, [vulns, query, statusFilter]);

  // Keep the page in range as the filter narrows.
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const shown = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const shownIds = shown.map((v) => v.id);
  const allShownSelected = shownIds.length > 0 && shownIds.every((id) => selected.has(id));
  const selectedIds = [...selected];

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAllShown = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (allShownSelected) shownIds.forEach((id) => next.delete(id));
      else shownIds.forEach((id) => next.add(id));
      return next;
    });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          placeholder="Search findings (name, location, CVE)…"
          className="h-8 w-72 text-xs"
          aria-label="Search findings"
        />
        <Select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="h-8 w-40 text-xs"
          aria-label="Filter findings by status"
        >
          <option value="all">All statuses</option>
          {STATUS_OPTIONS.map(([val, label]) => (
            <option key={val} value={val}>
              {label}
            </option>
          ))}
        </Select>
        <span className="text-xs text-fg-subtle">
          {filtered.length} of {vulns.length}
        </span>
      </div>

      {/* Bulk action bar - appears when rows are selected. */}
      {canTriage && selected.size > 0 ? (
        <ActionForm
          action={bulkSetVulnStatusByIdsAction}
          className="flex flex-wrap items-center gap-2 rounded-md border border-accent/30 bg-accent/5 px-3 py-2"
        >
          <input type="hidden" name="scanId" value={scanId} />
          {selectedIds.map((id) => (
            <input key={id} type="hidden" name="ids" value={id} />
          ))}
          <span className="text-xs font-medium">{selected.size} selected</span>
          <Select name="status" defaultValue="in_progress" className="h-8 w-40 text-xs" aria-label="Bulk set status">
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
        <p className="text-sm text-fg-subtle">No findings match your search/filter.</p>
      ) : (
        <Table>
          <THead>
            <TR>
              {canTriage ? (
                <TH className="w-8">
                  <input
                    type="checkbox"
                    checked={allShownSelected}
                    onChange={toggleAllShown}
                    aria-label="Select all shown"
                  />
                </TH>
              ) : null}
              <TH>Severity</TH>
              <TH>Finding</TH>
              <TH>Status</TH>
              {canTriage ? <TH>Actions</TH> : null}
            </TR>
          </THead>
          <TBody>
            {shown.map((v) => (
              <TR key={v.id}>
                {canTriage ? (
                  <TD>
                    <input
                      type="checkbox"
                      checked={selected.has(v.id)}
                      onChange={() => toggle(v.id)}
                      aria-label={`Select ${v.name}`}
                    />
                  </TD>
                ) : null}
                <TD>
                  <SeverityBadge severity={v.severity as SeverityValue} />
                </TD>
                <TD>
                  <div className="font-medium">{v.name}</div>
                  <div className="font-mono text-xs text-fg-subtle">{v.matchedAt}</div>
                  {v.description ||
                  v.remediation ||
                  v.cvss != null ||
                  (v.cveIds?.length ?? 0) > 0 ||
                  (v.references?.length ?? 0) > 0 ? (
                    <details className="mt-1 max-w-md text-xs text-fg-muted">
                      <summary className="cursor-pointer text-accent">Details (template)</summary>
                      {v.description ? (
                        <p className="mt-1">
                          <strong>Description:</strong> {v.description}
                        </p>
                      ) : null}
                      {v.remediation ? (
                        <p className="mt-1">
                          <strong>Remediation:</strong> {v.remediation}
                        </p>
                      ) : null}
                      {v.cvss != null || (v.cveIds?.length ?? 0) > 0 ? (
                        <p className="mt-1">
                          {v.cvss != null ? <strong>CVSS {v.cvss}</strong> : null}
                          {v.cvss != null && (v.cveIds?.length ?? 0) > 0 ? ' · ' : null}
                          {v.cveIds?.join(', ')}
                        </p>
                      ) : null}
                      {v.references?.length ? (
                        <div className="mt-1">
                          <strong>References:</strong>
                          <ul className="ml-4 list-disc">
                            {v.references.slice(0, 8).map((r) => (
                              <li key={r} className="break-all">
                                <a
                                  href={r}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-accent hover:underline"
                                >
                                  {r}
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </details>
                  ) : null}
                  {enrichMsg[v.id] ? <p className="mt-1 max-w-md text-xs text-danger">{enrichMsg[v.id]}</p> : null}
                  {(() => {
                    const ai =
                      enriched[v.id] ??
                      (v.isAiEnriched
                        ? { description: v.aiDescription, impact: v.aiImpact, remediation: v.aiRemediation }
                        : null);
                    if (!ai) return null;
                    return (
                      <details className="mt-1 max-w-md text-xs text-fg-muted" open={Boolean(enriched[v.id])}>
                        <summary className="cursor-pointer text-accent">AI analysis</summary>
                        {ai.description ? (
                          <p className="mt-1">
                            <strong>Description:</strong> {ai.description}
                          </p>
                        ) : null}
                        {ai.impact ? (
                          <p className="mt-1">
                            <strong>Impact:</strong> {ai.impact}
                          </p>
                        ) : null}
                        {ai.remediation ? (
                          <p className="mt-1">
                            <strong>Remediation:</strong> {ai.remediation}
                          </p>
                        ) : null}
                      </details>
                    );
                  })()}
                  {v.request || v.response ? (
                    <details className="mt-1 max-w-md text-xs text-fg-muted">
                      <summary className="cursor-pointer text-accent">Request / Response</summary>
                      {v.request ? (
                        <div className="mt-1">
                          <div className="font-semibold text-fg-subtle">Request</div>
                          <pre className="mt-0.5 max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-bg-subtle p-2 font-mono text-[11px] leading-snug">
                            {v.request}
                          </pre>
                        </div>
                      ) : null}
                      {v.response ? (
                        <div className="mt-1">
                          <div className="font-semibold text-fg-subtle">Response</div>
                          <pre className="mt-0.5 max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-bg-subtle p-2 font-mono text-[11px] leading-snug">
                            {v.response}
                          </pre>
                        </div>
                      ) : null}
                    </details>
                  ) : null}
                  {/* Analyst note - visible to all; editable by triagers. */}
                  {v.analystNote ? (
                    <p className="mt-1 max-w-md rounded-md border border-border bg-surface-2 p-1.5 text-xs">
                      <strong>Note:</strong> {v.analystNote}
                    </p>
                  ) : null}
                  {canTriage ? (
                    <details className="mt-1 max-w-md text-xs text-fg-muted">
                      <summary className="cursor-pointer text-accent">
                        {v.analystNote ? 'Edit note' : 'Add note'}
                      </summary>
                      <ActionForm action={setVulnNoteAction} className="mt-1 space-y-1">
                        <input type="hidden" name="id" value={v.id} />
                        <input type="hidden" name="scanId" value={scanId} />
                        <Textarea
                          name="note"
                          defaultValue={v.analystNote ?? ''}
                          rows={2}
                          placeholder="Investigation context, false-positive reason, …"
                          className="text-xs"
                        />
                        <ActionSubmit size="sm" variant="outline">
                          Save note
                        </ActionSubmit>
                      </ActionForm>
                    </details>
                  ) : null}
                </TD>
                <TD>
                  {canTriage ? (
                    <form action={setVulnStatusAction} className="flex items-center gap-1.5">
                      <input type="hidden" name="id" value={v.id} />
                      <input type="hidden" name="scanId" value={scanId} />
                      <AutoSubmitSelect
                        key={v.status}
                        name="status"
                        defaultValue={v.status}
                        className="h-8 w-36 text-xs"
                        aria-label="Change status"
                      >
                        {STATUS_OPTIONS.map(([val, label]) => (
                          <option key={val} value={val}>
                            {label}
                          </option>
                        ))}
                      </AutoSubmitSelect>
                    </form>
                  ) : (
                    <VulnStatusBadge status={v.status} />
                  )}
                </TD>
                {canTriage ? (
                  <TD>
                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        loading={enriching === v.id}
                        onClick={() => runEnrich(v.id)}
                      >
                        AI
                      </Button>
                      <ActionForm action={deleteVulnAction} confirm="Delete this finding?">
                        <input type="hidden" name="id" value={v.id} />
                        <input type="hidden" name="scanId" value={scanId} />
                        <ActionSubmit size="sm" variant="ghost" className="text-danger hover:bg-danger/10">
                          Delete
                        </ActionSubmit>
                      </ActionForm>
                    </div>
                  </TD>
                ) : null}
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-between text-xs text-fg-subtle">
          <span>
            Page {safePage} of {totalPages} · {filtered.length} findings
          </span>
          <div className="flex gap-1.5">
            <Button size="sm" variant="outline" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>
              Prev
            </Button>
            <Button size="sm" variant="outline" disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)}>
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
