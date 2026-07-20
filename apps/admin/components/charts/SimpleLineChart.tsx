'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

export interface LineSpec {
  dataKey: string;
  stroke: string;
  name?: string;
  strokeWidth?: number;
  dot?: boolean | { r: number; fill: string };
}

export default function SimpleLineChart({
  data,
  lines,
  xKey = 'date',
  height = 300,
  xTickFontSize = 12,
  allowDecimals = true,
  legend = false,
  xTickFormatter,
}: {
  data: ReadonlyArray<object>;
  lines: LineSpec[];
  xKey?: string;
  height?: number;
  xTickFontSize?: number;
  allowDecimals?: boolean;
  legend?: boolean;
  xTickFormatter?: (value: string) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data as object[]}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey={xKey}
          tick={{ fontSize: xTickFontSize }}
          tickFormatter={xTickFormatter}
        />
        <YAxis tick={{ fontSize: 12 }} allowDecimals={allowDecimals} />
        <Tooltip />
        {legend && <Legend />}
        {lines.map((l) => (
          <Line
            key={l.dataKey}
            type="monotone"
            dataKey={l.dataKey}
            name={l.name}
            stroke={l.stroke}
            strokeWidth={l.strokeWidth ?? 2}
            dot={l.dot ?? false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
