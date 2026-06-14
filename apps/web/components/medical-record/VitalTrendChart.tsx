'use client';

import { useMemo } from 'react';
import { t, type Lang } from '@triaji/shared/i18n';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Legend,
} from 'recharts';

export interface VitalTrendPoint {
  date: string;
  value: number;
  source: 'clinic_visit' | 'lab_result' | 'patient_self';
}

interface VitalTrendChartProps {
  vitalType: string;
  title: string;
  unit: string;
  data: VitalTrendPoint[];
  referenceMin?: number;
  referenceMax?: number;
  lang: Lang;
}

function formatChartDate(dateStr: string, lang: Lang): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', {
    month: 'short',
    day: 'numeric',
  });
}

interface TooltipPayload {
  payload: {
    date: string;
    clinicValue?: number;
    selfValue?: number;
  };
}

function CustomTooltip({
  active,
  payload,
  lang,
  unit,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  lang: Lang;
  unit: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const first = payload[0];
  if (!first) return null;
  const entry = first.payload;
  const date = new Date(entry.date).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-gray-700 mb-1">{date}</p>
      {entry.clinicValue != null && (
        <p className="text-teal-600">
          {t('vitals.loggedByDoctor', lang)}: {entry.clinicValue} {unit}
        </p>
      )}
      {entry.selfValue != null && (
        <p className="text-gray-500">
          {t('vitals.selfReported', lang)}: {entry.selfValue} {unit}
        </p>
      )}
    </div>
  );
}

export default function VitalTrendChart({
  title,
  unit,
  data,
  referenceMin,
  referenceMax,
  lang,
}: VitalTrendChartProps) {
  const isRtl = lang === 'ar';

  const chartData = useMemo(() => {
    const grouped: Record<string, { clinicValue?: number; selfValue?: number }> = {};
    for (const p of data) {
      if (!grouped[p.date]) grouped[p.date] = {};
      const entry = grouped[p.date]!;
      if (p.source === 'patient_self') {
        entry.selfValue = p.value;
      } else {
        entry.clinicValue = p.value;
      }
    }
    return Object.entries(grouped)
      .map(([date, vals]) => ({ date, ...vals }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [data]);

  if (data.length === 0) {
    return null;
  }

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="bg-white border border-gray-200 rounded-xl p-4">
      <h4 className="text-sm font-bold text-gray-900 mb-3">
        {title} <span className="text-gray-400 font-normal">({unit})</span>
      </h4>
      <div style={{ direction: 'ltr' }}>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="date"
              tickFormatter={(d) => formatChartDate(d, lang)}
              tick={{ fontSize: 11, fill: '#9ca3af' }}
            />
            <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} width={40} />
            <Tooltip content={<CustomTooltip lang={lang} unit={unit} />} />
            <Legend
              formatter={(value: string) => {
                if (value === 'clinicValue') return t('vitals.loggedByDoctor', lang);
                if (value === 'selfValue') return t('vitals.selfReported', lang);
                return value;
              }}
              wrapperStyle={{ fontSize: 11 }}
            />

            {referenceMin != null && (
              <ReferenceLine
                y={referenceMin}
                stroke="#ef4444"
                strokeDasharray="4 4"
                strokeOpacity={0.5}
              />
            )}
            {referenceMax != null && (
              <ReferenceLine
                y={referenceMax}
                stroke="#ef4444"
                strokeDasharray="4 4"
                strokeOpacity={0.5}
              />
            )}

            <Line
              type="monotone"
              dataKey="clinicValue"
              stroke="#0d9488"
              strokeWidth={2}
              dot={{ r: 4, fill: '#0d9488' }}
              connectNulls
              name="clinicValue"
            />
            <Line
              type="monotone"
              dataKey="selfValue"
              stroke="#9ca3af"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ r: 3, fill: '#9ca3af' }}
              connectNulls
              name="selfValue"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {(referenceMin != null || referenceMax != null) && (
        <p className="text-xs text-gray-400 mt-1">
          {t('vitals.referenceRange', lang)}: {referenceMin ?? '—'}–{referenceMax ?? '—'} {unit}
        </p>
      )}
    </div>
  );
}
