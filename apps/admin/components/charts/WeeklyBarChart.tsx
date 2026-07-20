'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

export interface BarSpec {
  dataKey: string;
  fill?: string;
  name?: string;
  stackId?: string;
  radius?: [number, number, number, number];
  /** Only meaningful with dualAxis. */
  yAxisId?: 'left' | 'right';
}

export default function WeeklyBarChart({
  data,
  bars,
  xKey = 'name',
  height = 300,
  xTickFontSize = 13,
  allowDecimals = true,
  dualAxis = false,
  tooltipFormatter,
}: {
  data: ReadonlyArray<object>;
  bars: BarSpec[];
  xKey?: string;
  height?: number;
  xTickFontSize?: number;
  allowDecimals?: boolean;
  dualAxis?: boolean;
  tooltipFormatter?: (value: unknown) => [string, string];
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data as object[]}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey={xKey} tick={{ fontSize: xTickFontSize }} />
        {dualAxis ? (
          <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
        ) : (
          <YAxis tick={{ fontSize: 12 }} allowDecimals={allowDecimals} />
        )}
        {dualAxis && <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />}
        <Tooltip formatter={tooltipFormatter} />
        <Legend />
        {bars.map((b) => (
          <Bar
            key={b.dataKey}
            dataKey={b.dataKey}
            name={b.name}
            stackId={b.stackId}
            fill={b.fill}
            radius={b.radius}
            yAxisId={dualAxis ? b.yAxisId : undefined}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
