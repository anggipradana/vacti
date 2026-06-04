'use client';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useThemeColors } from './use-theme-colors';

export function TrendArea({ data }: { data: { label: string; value: number }[] }) {
  const c = useThemeColors(['accent', 'border', 'surface', 'fg', 'fg-subtle']);
  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <defs>
            <linearGradient id="trend" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={c.accent} stopOpacity={0.3} />
              <stop offset="100%" stopColor={c.accent} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={c.border} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: c['fg-subtle'], fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fill: c['fg-subtle'], fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
            width={36}
          />
          <Tooltip
            contentStyle={{
              background: c.surface,
              border: `1px solid ${c.border}`,
              borderRadius: 8,
              color: c.fg,
              fontSize: 12,
            }}
          />
          <Area type="monotone" dataKey="value" stroke={c.accent} strokeWidth={2} fill="url(#trend)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
