import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { Card } from './card';

export function StatCard({
  label,
  value,
  icon,
  hint,
  className,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <Card className={cn('p-5', className)}>
      <div className="flex items-center justify-between">
        <span className="text-sm text-fg-muted">{label}</span>
        {icon ? <span className="text-fg-subtle [&_svg]:size-4">{icon}</span> : null}
      </div>
      <div className="mt-2 text-3xl font-semibold tabular tracking-tight">{value}</div>
      {hint ? <div className="mt-1 text-xs text-fg-subtle">{hint}</div> : null}
    </Card>
  );
}
