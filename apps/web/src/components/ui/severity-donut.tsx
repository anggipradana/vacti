'use client';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { useThemeColors } from './use-theme-colors';

const TOKENS = ['sev-critical', 'sev-high', 'sev-medium', 'sev-low', 'sev-info'];
const LABELS = ['Critical', 'High', 'Medium', 'Low', 'Info'];

export function SeverityDonut({ counts }: { counts: [number, number, number, number, number] }) {
  const colors = useThemeColors([...TOKENS, 'surface', 'border', 'fg']);
  const data = LABELS.map((name, i) => ({ name, value: counts[i] ?? 0, token: TOKENS[i]! })).filter((d) => d.value > 0);
  const total = counts.reduce((a, b) => a + b, 0);

  if (!total)
    return <div className="flex h-48 items-center justify-center text-sm text-fg-subtle">No findings yet</div>;

  return (
    <div className="relative h-48">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" innerRadius={56} outerRadius={80} paddingAngle={2} strokeWidth={0}>
            {data.map((d) => (
              <Cell key={d.name} fill={colors[d.token]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: 8,
              color: colors.fg,
              fontSize: 12,
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-semibold tabular">{total}</span>
        <span className="text-xs text-fg-subtle">findings</span>
      </div>
    </div>
  );
}
