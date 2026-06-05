import { Check } from 'lucide-react';
import { REVIEW_TOGGLE, reviewToggleTarget, type ReviewToggleKind } from '@vacti/core';
import { SubmitButton } from './submit-button';

/**
 * One-click "reviewed" toggle for a finding (VA vuln, leak, news). Submits the given status server
 * action with the toggled target status — a single click marks the finding reviewed, clicking again
 * reverts it to the base status. The full status dropdown beside it still covers every other status.
 */
export function ReviewToggle({
  action,
  kind,
  id,
  status,
  scanId,
}: {
  action: (formData: FormData) => void | Promise<void>;
  kind: ReviewToggleKind;
  id: string;
  status: string;
  scanId?: string;
}) {
  const reviewed = status === REVIEW_TOGGLE[kind].reviewed;
  const label = REVIEW_TOGGLE[kind].label;
  return (
    <form action={action} className="shrink-0">
      <input type="hidden" name="id" value={id} />
      {scanId ? <input type="hidden" name="scanId" value={scanId} /> : null}
      <input type="hidden" name="status" value={reviewToggleTarget(kind, status)} />
      <SubmitButton
        size="sm"
        variant={reviewed ? 'secondary' : 'outline'}
        title={reviewed ? `Reviewed (${label}) — click to undo` : `Mark ${label.toLowerCase()} (one click)`}
        className="text-xs"
      >
        {reviewed ? <Check /> : null}
        {label}
      </SubmitButton>
    </form>
  );
}
