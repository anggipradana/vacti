import { cn } from '../../lib/cn';

/** Semicircular risk gauge (pure SVG, server-safe). Colour band by score. */
export function RiskGauge({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, score));
  const band = clamped <= 30 ? 'text-risk-green' : clamped <= 70 ? 'text-risk-amber' : 'text-risk-red';
  const r = 52;
  const circ = Math.PI * r; // half circle length
  const offset = circ * (1 - clamped / 100);
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 120 70" className="w-40">
        <path
          d="M8 64 A52 52 0 0 1 112 64"
          fill="none"
          className="stroke-border"
          strokeWidth={10}
          strokeLinecap="round"
        />
        <path
          d="M8 64 A52 52 0 0 1 112 64"
          fill="none"
          className={cn('stroke-current', band)}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="-mt-4 text-center">
        <div className={cn('text-2xl font-semibold tabular', band)}>{clamped}</div>
        <div className="text-xs text-fg-subtle">risk score</div>
      </div>
    </div>
  );
}
