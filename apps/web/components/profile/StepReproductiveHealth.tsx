'use client';

import SelectionChip from './SelectionChip';
import NumberStepper from './NumberStepper';

/* ── Types ────────────────────────────────────────────────────── */

export type PregnancyStatus =
  | 'not_pregnant'
  | 'pregnant'
  | 'breastfeeding'
  | 'trying_to_conceive';

export type MenstrualRegularity = 'regular' | 'irregular' | 'absent';

export type MenopauseStatus =
  | 'pre_menopause'
  | 'peri_menopause'
  | 'post_menopause'
  | 'not_applicable';

export interface ReproductiveHealthData {
  pregnancy_status?: PregnancyStatus;
  previous_pregnancies?: number | null;
  menstrual_regularity?: MenstrualRegularity;
  menopause_status?: MenopauseStatus;
}

interface StepReproductiveHealthProps {
  data: ReproductiveHealthData;
  onChange: (data: ReproductiveHealthData) => void;
}

/* ── Option definitions ───────────────────────────────────────── */

const PREGNANCY_OPTIONS: {
  value: PregnancyStatus;
  label: string;
  icon: string;
}[] = [
  { value: 'not_pregnant', label: 'لست حاملاً', icon: '✓' },
  { value: 'pregnant', label: 'حامل', icon: '🤱' },
  { value: 'breastfeeding', label: 'مرضعة', icon: '🍼' },
  { value: 'trying_to_conceive', label: 'حاولي الحمل', icon: '🌸' },
];

const MENSTRUAL_OPTIONS: {
  value: MenstrualRegularity;
  label: string;
  icon?: string;
}[] = [
  { value: 'regular', label: 'منتظمة', icon: '✓' },
  { value: 'irregular', label: 'غير منتظمة' },
  { value: 'absent', label: 'منقطعة' },
];

const MENOPAUSE_OPTIONS: {
  value: MenopauseStatus;
  label: string;
}[] = [
  { value: 'pre_menopause', label: 'قبل سن اليأس' },
  { value: 'peri_menopause', label: 'في مرحلة الانتقال' },
  { value: 'post_menopause', label: 'بعد سن اليأس' },
  { value: 'not_applicable', label: 'لا ينطبق' },
];

/* ── Section Wrapper ──────────────────────────────────────────── */

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-semibold text-gray-700">{title}</p>
      {children}
    </div>
  );
}

/* ── Main Component ───────────────────────────────────────────── */

export default function StepReproductiveHealth({
  data,
  onChange,
}: StepReproductiveHealthProps) {
  function update(partial: Partial<ReproductiveHealthData>) {
    onChange({ ...data, ...partial });
  }

  const hideMenstrual =
    data.pregnancy_status === 'pregnant' ||
    data.menopause_status === 'post_menopause';

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div>
        <h3 className="text-base font-bold text-gray-900">
          بعض الأسئلة عن صحتك الإنجابية
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          تساعدنا نفهم حالتك بشكل أفضل
        </p>
      </div>

      {/* ═══ حالتك الحالية ═══ */}
      <Section title="حالتك الحالية">
        <div className="grid grid-cols-2 gap-3">
          {PREGNANCY_OPTIONS.map((opt) => (
            <SelectionChip
              key={opt.value}
              label={`${opt.label} ${opt.icon}`}
              selected={data.pregnancy_status === opt.value}
              onToggle={() => {
                update({
                  pregnancy_status:
                    data.pregnancy_status === opt.value ? undefined : opt.value,
                });
              }}
            />
          ))}
        </div>
      </Section>

      {/* ═══ عدد الحمل السابقة ═══ */}
      <Section title="كام مرة حملتي قبل كده؟ (بما فيها الولادات والإجهاض)">
        <NumberStepper
          label="عدد الحمل السابقة"
          value={data.previous_pregnancies ?? null}
          onChange={(val) => update({ previous_pregnancies: val })}
          min={0}
          max={10}
          step={1}
        />
      </Section>

      {/* ═══ انتظام الدورة ═══ */}
      {!hideMenstrual && (
        <Section title="انتظام الدورة">
          <div className="flex flex-wrap gap-2">
            {MENSTRUAL_OPTIONS.map((opt) => (
              <SelectionChip
                key={opt.value}
                label={opt.icon ? `${opt.label} ${opt.icon}` : opt.label}
                selected={data.menstrual_regularity === opt.value}
                onToggle={() => {
                  update({
                    menstrual_regularity:
                      data.menstrual_regularity === opt.value
                        ? undefined
                        : opt.value,
                  });
                }}
              />
            ))}
          </div>
        </Section>
      )}

      {/* ═══ سن اليأس ═══ */}
      <Section title="سن اليأس">
        <div className="flex flex-wrap gap-2">
          {MENOPAUSE_OPTIONS.map((opt) => (
            <SelectionChip
              key={opt.value}
              label={opt.label}
              selected={data.menopause_status === opt.value}
              onToggle={() => {
                update({
                  menopause_status:
                    data.menopause_status === opt.value ? undefined : opt.value,
                });
              }}
            />
          ))}
        </div>
      </Section>
    </div>
  );
}
