'use client';

import { useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceDot,
} from 'recharts';
import { t, type Lang } from '@triaji/shared/i18n';
import type { GrowthMeasurement, WhoGrowthReference } from '@triaji/shared/types/paediatric';

interface GrowthChartProps {
  patientId: string;
  sex: 'male' | 'female';
  dateOfBirth: string;
  measure: 'weight' | 'height' | 'head_circ';
  measurements: GrowthMeasurement[];
  reference: WhoGrowthReference[];
  lang: Lang;
}

interface ChartDataPoint {
  ageMonths: number;
  p3: number | null;
  p15: number | null;
  p50: number | null;
  p85: number | null;
  p97: number | null;
  actual: number | null;
}

const MEASURE_LABELS: Record<string, { ar: string; en: string }> = {
  weight: { ar: 'الوزن (كجم)', en: 'Weight (kg)' },
  height: { ar: 'الطول (سم)', en: 'Height (cm)' },
  head_circ: { ar: 'محيط الرأس (سم)', en: 'Head circ. (cm)' },
};

export default function GrowthChart({
  measure,
  measurements,
  reference,
  lang,
}: GrowthChartProps) {
  const isRtl = lang === 'ar';

  const chartData = useMemo(() => {
    // Filter reference data for this measure
    const measureKey = measure === 'head_circ' ? 'head_circ' : measure;
    const refFiltered = reference.filter((r) => r.measure === measureKey);

    // Create a map of age_months -> reference
    const refMap = new Map<number, WhoGrowthReference>();
    refFiltered.forEach((r) => refMap.set(r.age_months, r));

    // Create a map of age_months -> actual measurement
    const actualMap = new Map<number, number>();
    measurements.forEach((m) => {
      const val =
        measure === 'weight'
          ? m.weight_kg
          : measure === 'height'
            ? m.height_cm
            : m.head_circ_cm;
      if (val !== null && val !== undefined) {
        actualMap.set(m.age_months, val);
      }
    });

    // Combine into chart data
    const allMonths = new Set([...refMap.keys(), ...actualMap.keys()]);
    const data: ChartDataPoint[] = [];

    for (const month of Array.from(allMonths).sort((a, b) => a - b)) {
      const ref = refMap.get(month);
      data.push({
        ageMonths: month,
        p3: ref?.p3 ?? null,
        p15: ref?.p15 ?? null,
        p50: ref?.p50 ?? null,
        p85: ref?.p85 ?? null,
        p97: ref?.p97 ?? null,
        actual: actualMap.get(month) ?? null,
      });
    }

    return data;
  }, [measure, measurements, reference]);

  // Find the most recent measurement for highlighting
  const latestMeasurement = useMemo(() => {
    const withValues = measurements.filter((m) => {
      const val =
        measure === 'weight'
          ? m.weight_kg
          : measure === 'height'
            ? m.height_cm
            : m.head_circ_cm;
      return val !== null && val !== undefined;
    });
    return withValues.length > 0 ? withValues[withValues.length - 1] : null;
  }, [measurements, measure]);

  const latestValue = latestMeasurement
    ? measure === 'weight'
      ? latestMeasurement.weight_kg
      : measure === 'height'
        ? latestMeasurement.height_cm
        : latestMeasurement.head_circ_cm
    : null;

  const yLabel = MEASURE_LABELS[measure]?.[lang] ?? '';

  return (
    <div dir="ltr" className="w-full">
      <h3 className={`mb-2 text-sm font-medium text-gray-600 ${isRtl ? 'text-right' : 'text-left'}`}>
        {yLabel}
      </h3>
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={chartData} margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="ageMonths"
            label={{
              value: lang === 'ar' ? 'العمر (شهور)' : 'Age (months)',
              position: 'bottom',
              offset: 0,
              style: { fontSize: 12, fill: '#6b7280' },
            }}
            tick={{ fontSize: 11, fill: '#9ca3af' }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            label={{
              value: yLabel,
              angle: -90,
              position: 'insideLeft',
              style: { fontSize: 12, fill: '#6b7280' },
            }}
          />
          <Tooltip
            contentStyle={{ fontSize: 12, direction: isRtl ? 'rtl' : 'ltr' }}
            formatter={(value: number, name: string) => {
              const nameMap: Record<string, string> = {
                p3: 'P3',
                p15: 'P15',
                p50: 'P50',
                p85: 'P85',
                p97: 'P97',
                actual: lang === 'ar' ? 'القياس' : 'Actual',
              };
              return [value?.toFixed(1) ?? '-', nameMap[name] ?? name];
            }}
            labelFormatter={(label) =>
              `${lang === 'ar' ? 'العمر' : 'Age'}: ${label} ${lang === 'ar' ? 'شهر' : 'mo'}`
            }
          />

          {/* Red zone: below P3 */}
          <Area
            dataKey="p3"
            stroke="none"
            fill="#fecaca"
            fillOpacity={0.3}
            type="monotone"
            connectNulls
            isAnimationActive={false}
          />

          {/* Yellow zone: P3-P15 */}
          <Area
            dataKey="p15"
            stroke="none"
            fill="#fef08a"
            fillOpacity={0.3}
            type="monotone"
            connectNulls
            isAnimationActive={false}
          />

          {/* Green zone: P15-P85 */}
          <Area
            dataKey="p85"
            stroke="none"
            fill="#bbf7d0"
            fillOpacity={0.35}
            type="monotone"
            connectNulls
            isAnimationActive={false}
          />

          {/* Yellow zone: P85-P97 */}
          <Area
            dataKey="p97"
            stroke="none"
            fill="#fef08a"
            fillOpacity={0.3}
            type="monotone"
            connectNulls
            isAnimationActive={false}
          />

          {/* Reference lines */}
          <Line dataKey="p3" stroke="#f87171" strokeDasharray="4 2" strokeWidth={1} dot={false} connectNulls isAnimationActive={false} />
          <Line dataKey="p50" stroke="#6b7280" strokeDasharray="6 3" strokeWidth={1} dot={false} connectNulls isAnimationActive={false} />
          <Line dataKey="p97" stroke="#f87171" strokeDasharray="4 2" strokeWidth={1} dot={false} connectNulls isAnimationActive={false} />

          {/* Child's actual measurements */}
          <Line
            dataKey="actual"
            stroke="#0d9488"
            strokeWidth={2.5}
            dot={{ fill: '#0d9488', r: 4 }}
            connectNulls
            isAnimationActive={false}
          />

          {/* Highlight latest measurement */}
          {latestMeasurement && latestValue !== null && (
            <ReferenceDot
              x={latestMeasurement.age_months}
              y={latestValue}
              r={7}
              fill="#0d9488"
              stroke="#fff"
              strokeWidth={2}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className={`mt-2 flex flex-wrap gap-4 text-xs text-gray-500 ${isRtl ? 'justify-end' : 'justify-start'}`}>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-4 rounded bg-green-200" />
          {t('paediatric.normalRange', lang)} (P15–P85)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-4 rounded bg-yellow-200" />
          P3–P15 / P85–P97
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-4 bg-red-400" />
          P3 / P97
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-4 bg-teal-600" />
          {lang === 'ar' ? 'القياس الفعلي' : 'Actual'}
        </span>
      </div>
    </div>
  );
}
