'use client';

import { useMemo } from 'react';
import NumberStepper from './NumberStepper';

/* ─── Types ─── */
interface StepPhysicalData {
  height_cm: number | null;
  weight_kg: number | null;
}

interface StepPhysicalProps {
  data: StepPhysicalData;
  onChange: (data: StepPhysicalData) => void;
}

/* ─── BMI helpers ─── */
function calcBMI(heightCm: number, weightKg: number): number {
  const heightM = heightCm / 100;
  return weightKg / (heightM * heightM);
}

interface BMICategory {
  label: string;
  color: string;
}

function getBMICategory(bmi: number): BMICategory {
  if (bmi < 18.5) return { label: 'نحيف', color: 'text-yellow-500' };
  if (bmi < 25) return { label: 'طبيعي ✓', color: 'text-green-600' };
  if (bmi < 30) return { label: 'زيادة وزن', color: 'text-orange-500' };
  if (bmi < 35) return { label: 'سمنة درجة أولى', color: 'text-red-400' };
  return { label: 'سمنة مفرطة', color: 'text-red-600' };
}

export default function StepPhysical({ data, onChange }: StepPhysicalProps) {
  const bmi = useMemo(() => {
    if (data.height_cm && data.weight_kg) {
      return calcBMI(data.height_cm, data.weight_kg);
    }
    return null;
  }, [data.height_cm, data.weight_kg]);

  const bmiCategory = bmi !== null ? getBMICategory(bmi) : null;

  return (
    <div className="flex flex-col gap-8" dir="rtl">
      {/* ── Height ── */}
      <section className="flex flex-col items-center gap-2">
        <NumberStepper
          label="طولك (سم)"
          value={data.height_cm}
          onChange={(height_cm) => onChange({ ...data, height_cm })}
          min={100}
          max={220}
          step={1}
          unit="سم"
        />
      </section>

      {/* ── Weight ── */}
      <section className="flex flex-col items-center gap-2">
        <NumberStepper
          label="وزنك (كجم)"
          value={data.weight_kg}
          onChange={(weight_kg) => onChange({ ...data, weight_kg })}
          min={20}
          max={250}
          step={1}
          unit="كجم"
        />
      </section>

      {/* ── BMI Display ── */}
      <section
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          bmi !== null ? 'max-h-32 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        {bmi !== null && bmiCategory && (
          <div className="mx-auto flex flex-col items-center gap-1 rounded-2xl bg-gray-50 px-6 py-4">
            <span className="text-sm text-gray-500">مؤشر كتلة الجسم</span>
            <span className="text-3xl font-bold tabular-nums text-gray-900" dir="ltr">
              {bmi.toFixed(1)}
            </span>
            <span className={`text-sm font-semibold ${bmiCategory.color}`}>
              {bmiCategory.label}
            </span>
          </div>
        )}
      </section>
    </div>
  );
}
