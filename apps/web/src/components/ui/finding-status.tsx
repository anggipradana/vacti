import { VULN_STATUS_LABEL, VULN_ACTIVE_STATUSES, type VulnStatusValue } from '@vacti/core';
import { cn } from '../../lib/cn';

const RESOLVED = new Set(['resolved']);
const active = new Set<string>(VULN_ACTIVE_STATUSES);

export function VulnStatusBadge({ status }: { status: string }) {
  const tone = active.has(status)
    ? 'border-high/30 bg-high/10 text-high'
    : RESOLVED.has(status)
      ? 'border-success/30 bg-success/10 text-success'
      : 'border-border bg-surface-2 text-fg-muted';
  return (
    <span className={cn('inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium', tone)}>
      {VULN_STATUS_LABEL[status as VulnStatusValue] ?? status}
    </span>
  );
}
