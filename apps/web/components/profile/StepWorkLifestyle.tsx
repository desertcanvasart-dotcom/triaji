'use client';

import SelectionChip from './SelectionChip';

/* ─── Constants ─── */
const WORK_TYPES = [
  { id: 'office', label: 'عمل مكتبي', icon: '🏢' },
  { id: 'manual_construction', label: 'عمل يدوي/إنشاءات', icon: '🔨' },
  { id: 'healthcare', label: 'قطاع طبي', icon: '🏥' },
  { id: 'education', label: 'تعليم', icon: '📚' },
  { id: 'transportation', label: 'نقل ومواصلات', icon: '🚌' },
  { id: 'agriculture', label: 'زراعة', icon: '🌾' },
  { id: 'retail_sales', label: 'تجارة/مبيعات', icon: '🛒' },
  { id: 'industrial_factory', label: 'صناعة/مصانع', icon: '🏭' },
  { id: 'domestic', label: 'أعمال منزلية', icon: '🏠' },
  { id: 'student', label: 'طالب', icon: '🎓' },
  { id: 'retired', label: 'متقاعد', icon: '🏖️' },
  { id: 'unemployed', label: 'غير عامل', icon: '❌' },
] as const;

const WORK_SCHEDULES = [
  { id: 'day', label: 'نهاري', icon: '☀️' },
  { id: 'night', label: 'ليلي', icon: '🌙' },
  { id: 'irregular', label: 'غير منتظم', icon: '🔄' },
] as const;

const ACTIVITY_LEVELS = [
  { id: 'low', label: 'خامل', desc: 'جلوس معظم اليوم', icon: '🛋️' },
  { id: 'moderate', label: 'معتدل', desc: 'نشاط خفيف أسبوعياً', icon: '🚶' },
  { id: 'high', label: 'نشيط', desc: 'رياضة منتظمة', icon: '🏃' },
] as const;

/* ─── Types ─── */
interface StepWorkLifestyleData {
  work_type: string | null;
  work_schedule: string | null;
  activity_level: string | null;
}

interface StepWorkLifestyleProps {
  data: StepWorkLifestyleData;
  onChange: (data: StepWorkLifestyleData) => void;
}

export default function StepWorkLifestyle({ data, onChange }: StepWorkLifestyleProps) {
  return (
    <div className="flex flex-col gap-8" dir="rtl">
      {/* ── Work Type ── */}
      <section className="flex flex-col gap-3">
        <span className="text-sm font-medium text-gray-600">طبيعة عملك</span>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {WORK_TYPES.map((wt) => (
            <SelectionChip
              key={wt.id}
              label={wt.label}
              icon={wt.icon}
              selected={data.work_type === wt.id}
              onToggle={() =>
                onChange({
                  ...data,
                  work_type: data.work_type === wt.id ? null : wt.id,
                })
              }
            />
          ))}
        </div>
      </section>

      {/* ── Work Schedule ── */}
      <section className="flex flex-col gap-3">
        <span className="text-sm font-medium text-gray-600">نوبتك</span>
        <div className="flex flex-wrap gap-2">
          {WORK_SCHEDULES.map((ws) => (
            <SelectionChip
              key={ws.id}
              label={ws.label}
              icon={ws.icon}
              selected={data.work_schedule === ws.id}
              onToggle={() =>
                onChange({
                  ...data,
                  work_schedule: data.work_schedule === ws.id ? null : ws.id,
                })
              }
            />
          ))}
        </div>
      </section>

      {/* ── Activity Level ── */}
      <section className="flex flex-col gap-3">
        <span className="text-sm font-medium text-gray-600">مستوى نشاطك البدني</span>
        <div className="flex flex-col gap-2 sm:flex-row">
          {ACTIVITY_LEVELS.map((al) => (
            <button
              key={al.id}
              type="button"
              onClick={() =>
                onChange({
                  ...data,
                  activity_level: data.activity_level === al.id ? null : al.id,
                })
              }
              className={`flex flex-1 flex-col items-center gap-1.5 rounded-2xl border-2 px-4 py-4 transition-all duration-200 ${
                data.activity_level === al.id
                  ? 'border-teal-700 bg-teal-700 text-white shadow-sm'
                  : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-300 hover:bg-gray-100'
              } cursor-pointer active:scale-[0.97]`}
            >
              <span className="text-2xl">{al.icon}</span>
              <span className="text-sm font-semibold">{al.label}</span>
              <span
                className={`text-xs ${
                  data.activity_level === al.id ? 'text-teal-100' : 'text-gray-400'
                }`}
              >
                {al.desc}
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
