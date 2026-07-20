'use client';

/**
 * Dynamically-loaded chart components. recharts (+ its d3 dependencies) is
 * one of the largest deps in the bundle; loading charts through next/dynamic
 * keeps it out of every dashboard's first-load JS. Import chart components
 * from here — never from recharts directly in dashboard code.
 */

import dynamic from 'next/dynamic';

function ChartSkeleton({ height = 300 }: { height?: number }) {
  return <div style={{ height }} className="animate-pulse rounded-lg bg-gray-100" />;
}

export type { BarSpec } from './WeeklyBarChart';
export type { LineSpec } from './SimpleLineChart';

export const WeeklyBarChart = dynamic(() => import('./WeeklyBarChart'), {
  ssr: false,
  loading: () => <ChartSkeleton />,
});

export const SimpleLineChart = dynamic(() => import('./SimpleLineChart'), {
  ssr: false,
  loading: () => <ChartSkeleton />,
});

export const VerticalBarChart = dynamic(() => import('./VerticalBarChart'), {
  ssr: false,
  loading: () => <ChartSkeleton />,
});
