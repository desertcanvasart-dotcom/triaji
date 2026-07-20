'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

/**
 * Horizontal-bars chart (recharts layout="vertical"), e.g. the widget
 * engagement funnel. Per-bar colors come from a `fill` field on each data row.
 */
export default function VerticalBarChart({
  data,
  dataKey = 'value',
  yKey = 'name',
  height = 300,
  yCategoryWidth = 120,
}: {
  data: ReadonlyArray<object>;
  dataKey?: string;
  yKey?: string;
  height?: number;
  yCategoryWidth?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data as object[]} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" />
        <YAxis type="category" dataKey={yKey} width={yCategoryWidth} tick={{ fontSize: 13 }} />
        <Tooltip />
        <Bar dataKey={dataKey} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
