import { Check, Loader2, Minus, X } from 'lucide-react';
import { cn } from '../../lib/cn';

export type StageState = 'pending' | 'running' | 'completed' | 'skipped' | 'failed';

const icon = (s: StageState) => {
  if (s === 'completed') return <Check className="size-3.5" />;
  if (s === 'running') return <Loader2 className="size-3.5 animate-spin" />;
  if (s === 'failed') return <X className="size-3.5" />;
  if (s === 'skipped') return <Minus className="size-3.5" />;
  return <span className="size-1.5 rounded-full bg-current" />;
};

const tone = (s: StageState) =>
  s === 'completed'
    ? 'border-success/40 bg-success/10 text-success'
    : s === 'running'
      ? 'border-accent/40 bg-accent/10 text-accent'
      : s === 'failed'
        ? 'border-danger/40 bg-danger/10 text-danger'
        : 'border-border bg-surface-2 text-fg-subtle';

export function StageStepper({ stages }: { stages: { label: string; state: StageState }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {stages.map((st, i) => (
        <div key={st.label} className="flex items-center gap-2">
          <div
            className={cn('flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium', tone(st.state))}
          >
            <span className="flex size-4 items-center justify-center">{icon(st.state)}</span>
            {st.label}
          </div>
          {i < stages.length - 1 ? <div className="h-px w-4 bg-border" /> : null}
        </div>
      ))}
    </div>
  );
}
