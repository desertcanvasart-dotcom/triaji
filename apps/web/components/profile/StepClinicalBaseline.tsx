'use client';

import NumberStepper from './NumberStepper';
import SelectionChip from './SelectionChip';

/* ─── Types ─── */
interface StepClinicalBaselineData {
  smoking_status: 'never' | 'current' | 'former' | null;
  cigarettes_per_day: number | null;
  smoking_years: number | null;
  blood_pressure: 'none' | 'controlled' | 'uncontrolled' | 'unknown' | null;
  bp_on_medication: boolean | null;
  diabetes_type: 'none' | 'type1' | 'type2' | 'unknown' | null;
  diabetes_control: 'controlled' | 'uncontrolled' | 'unknown' | null;
  diabetes_treatment: 'tablets' | 'insulin' | 'both' | null;
  heart_condition: 'none' | 'known' | 'unknown' | null;
  previous_heart_attack: boolean | null;
  heart_surgery: boolean | null;
  kidney_disease: 'none' | 'known' | 'unknown' | null;
  liver_disease: 'none' | 'known' | 'unknown' | null;
}

interface StepClinicalBaselineProps {
  data: StepClinicalBaselineData;
  onChange: (data: StepClinicalBaselineData) => void;
}

/* ─── Animated sub-question wrapper ─── */
function SubQuestion({
  visible,
  children,
}: {
  visible: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`overflow-hidden transition-all duration-300 ease-in-out ${
        visible ? 'max-h-96 opacity-100 mt-3' : 'max-h-0 opacity-0 mt-0'
      }`}
    >
      <div className="rounded-xl bg-gray-50 p-4 flex flex-col gap-4">{children}</div>
    </div>
  );
}

/* ─── Yes/No toggle ─── */
function YesNoToggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | null;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-gray-700">{label}</span>
      <div className="flex gap-2">
        <SelectionChip
          label="نعم"
          selected={value === true}
          onToggle={() => onChange(true)}
        />
        <SelectionChip
          label="لا"
          selected={value === false}
          onToggle={() => onChange(false)}
        />
      </div>
    </div>
  );
}

/* ─── Section divider ─── */
function SectionDivider() {
  return <div className="border-t border-gray-100" />;
}

/* ─── Main component ─── */
export default function StepClinicalBaseline({
  data,
  onChange,
}: StepClinicalBaselineProps) {
  const showSmokingDetails =
    data.smoking_status === 'current' || data.smoking_status === 'former';
  const showBPMedication =
    data.blood_pressure === 'controlled' || data.blood_pressure === 'uncontrolled';
  const showDiabetesDetails =
    data.diabetes_type === 'type1' || data.diabetes_type === 'type2';
  const showHeartDetails = data.heart_condition === 'known';

  return (
    <div className="flex flex-col gap-6" dir="rtl">
      {/* ── التدخين ── */}
      <section className="flex flex-col gap-3">
        <span className="text-sm font-medium text-gray-600">التدخين</span>
        <div className="flex flex-wrap gap-2">
          <SelectionChip
            label="لا أدخن ✓"
            selected={data.smoking_status === 'never'}
            onToggle={() =>
              onChange({
                ...data,
                smoking_status: data.smoking_status === 'never' ? null : 'never',
                cigarettes_per_day: null,
                smoking_years: null,
              })
            }
          />
          <SelectionChip
            label="أدخن حالياً"
            icon="🚬"
            selected={data.smoking_status === 'current'}
            onToggle={() =>
              onChange({
                ...data,
                smoking_status: data.smoking_status === 'current' ? null : 'current',
                cigarettes_per_day: null,
                smoking_years: null,
              })
            }
          />
          <SelectionChip
            label="أقلعت سابقاً"
            selected={data.smoking_status === 'former'}
            onToggle={() =>
              onChange({
                ...data,
                smoking_status: data.smoking_status === 'former' ? null : 'former',
                cigarettes_per_day: null,
                smoking_years: null,
              })
            }
          />
        </div>

        <SubQuestion visible={showSmokingDetails}>
          <NumberStepper
            label="عدد السجائر يومياً"
            value={data.cigarettes_per_day}
            onChange={(v) => onChange({ ...data, cigarettes_per_day: v })}
            min={1}
            max={60}
            step={1}
          />
          <NumberStepper
            label="سنوات التدخين"
            value={data.smoking_years}
            onChange={(v) => onChange({ ...data, smoking_years: v })}
            min={1}
            max={50}
            step={1}
          />
        </SubQuestion>
      </section>

      <SectionDivider />

      {/* ── ضغط الدم ── */}
      <section className="flex flex-col gap-3">
        <span className="text-sm font-medium text-gray-600">ضغط الدم</span>
        <div className="flex flex-wrap gap-2">
          <SelectionChip
            label="لا يوجد ✓"
            selected={data.blood_pressure === 'none'}
            onToggle={() =>
              onChange({
                ...data,
                blood_pressure: data.blood_pressure === 'none' ? null : 'none',
                bp_on_medication: null,
              })
            }
          />
          <SelectionChip
            label="نعم — مضبوط"
            selected={data.blood_pressure === 'controlled'}
            onToggle={() =>
              onChange({
                ...data,
                blood_pressure:
                  data.blood_pressure === 'controlled' ? null : 'controlled',
                bp_on_medication: null,
              })
            }
          />
          <SelectionChip
            label="نعم — غير مضبوط"
            selected={data.blood_pressure === 'uncontrolled'}
            onToggle={() =>
              onChange({
                ...data,
                blood_pressure:
                  data.blood_pressure === 'uncontrolled' ? null : 'uncontrolled',
                bp_on_medication: null,
              })
            }
          />
          <SelectionChip
            label="مش عارف"
            selected={data.blood_pressure === 'unknown'}
            onToggle={() =>
              onChange({
                ...data,
                blood_pressure: data.blood_pressure === 'unknown' ? null : 'unknown',
                bp_on_medication: null,
              })
            }
          />
        </div>

        <SubQuestion visible={showBPMedication}>
          <YesNoToggle
            label="بتاخد علاج للضغط؟"
            value={data.bp_on_medication}
            onChange={(v) => onChange({ ...data, bp_on_medication: v })}
          />
        </SubQuestion>
      </section>

      <SectionDivider />

      {/* ── سكر الدم ── */}
      <section className="flex flex-col gap-3">
        <span className="text-sm font-medium text-gray-600">سكر الدم</span>
        <div className="flex flex-wrap gap-2">
          <SelectionChip
            label="لا يوجد ✓"
            selected={data.diabetes_type === 'none'}
            onToggle={() =>
              onChange({
                ...data,
                diabetes_type: data.diabetes_type === 'none' ? null : 'none',
                diabetes_control: null,
                diabetes_treatment: null,
              })
            }
          />
          <SelectionChip
            label="النوع الأول"
            selected={data.diabetes_type === 'type1'}
            onToggle={() =>
              onChange({
                ...data,
                diabetes_type: data.diabetes_type === 'type1' ? null : 'type1',
                diabetes_control: null,
                diabetes_treatment: null,
              })
            }
          />
          <SelectionChip
            label="النوع الثاني"
            selected={data.diabetes_type === 'type2'}
            onToggle={() =>
              onChange({
                ...data,
                diabetes_type: data.diabetes_type === 'type2' ? null : 'type2',
                diabetes_control: null,
                diabetes_treatment: null,
              })
            }
          />
          <SelectionChip
            label="مش عارف"
            selected={data.diabetes_type === 'unknown'}
            onToggle={() =>
              onChange({
                ...data,
                diabetes_type: data.diabetes_type === 'unknown' ? null : 'unknown',
                diabetes_control: null,
                diabetes_treatment: null,
              })
            }
          />
        </div>

        <SubQuestion visible={showDiabetesDetails}>
          <div className="flex flex-col gap-3">
            <span className="text-xs font-medium text-gray-500">التحكم</span>
            <div className="flex flex-wrap gap-2">
              <SelectionChip
                label="مضبوط"
                selected={data.diabetes_control === 'controlled'}
                onToggle={() =>
                  onChange({
                    ...data,
                    diabetes_control:
                      data.diabetes_control === 'controlled' ? null : 'controlled',
                  })
                }
              />
              <SelectionChip
                label="غير مضبوط"
                selected={data.diabetes_control === 'uncontrolled'}
                onToggle={() =>
                  onChange({
                    ...data,
                    diabetes_control:
                      data.diabetes_control === 'uncontrolled'
                        ? null
                        : 'uncontrolled',
                  })
                }
              />
              <SelectionChip
                label="مش عارف"
                selected={data.diabetes_control === 'unknown'}
                onToggle={() =>
                  onChange({
                    ...data,
                    diabetes_control:
                      data.diabetes_control === 'unknown' ? null : 'unknown',
                  })
                }
              />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <span className="text-xs font-medium text-gray-500">العلاج</span>
            <div className="flex flex-wrap gap-2">
              <SelectionChip
                label="أقراص"
                selected={data.diabetes_treatment === 'tablets'}
                onToggle={() =>
                  onChange({
                    ...data,
                    diabetes_treatment:
                      data.diabetes_treatment === 'tablets' ? null : 'tablets',
                  })
                }
              />
              <SelectionChip
                label="أنسولين"
                selected={data.diabetes_treatment === 'insulin'}
                onToggle={() =>
                  onChange({
                    ...data,
                    diabetes_treatment:
                      data.diabetes_treatment === 'insulin' ? null : 'insulin',
                  })
                }
              />
              <SelectionChip
                label="كلاهما"
                selected={data.diabetes_treatment === 'both'}
                onToggle={() =>
                  onChange({
                    ...data,
                    diabetes_treatment:
                      data.diabetes_treatment === 'both' ? null : 'both',
                  })
                }
              />
            </div>
          </div>
        </SubQuestion>
      </section>

      <SectionDivider />

      {/* ── أمراض القلب ── */}
      <section className="flex flex-col gap-3">
        <span className="text-sm font-medium text-gray-600">أمراض القلب</span>
        <div className="flex flex-wrap gap-2">
          <SelectionChip
            label="لا يوجد ✓"
            selected={data.heart_condition === 'none'}
            onToggle={() =>
              onChange({
                ...data,
                heart_condition: data.heart_condition === 'none' ? null : 'none',
                previous_heart_attack: null,
                heart_surgery: null,
              })
            }
          />
          <SelectionChip
            label="نعم — عندي مشكلة قلب"
            selected={data.heart_condition === 'known'}
            onToggle={() =>
              onChange({
                ...data,
                heart_condition: data.heart_condition === 'known' ? null : 'known',
                previous_heart_attack: null,
                heart_surgery: null,
              })
            }
          />
          <SelectionChip
            label="مش عارف"
            selected={data.heart_condition === 'unknown'}
            onToggle={() =>
              onChange({
                ...data,
                heart_condition:
                  data.heart_condition === 'unknown' ? null : 'unknown',
                previous_heart_attack: null,
                heart_surgery: null,
              })
            }
          />
        </div>

        <SubQuestion visible={showHeartDetails}>
          <YesNoToggle
            label="سبق ونزلت نوبة قلبية؟"
            value={data.previous_heart_attack}
            onChange={(v) => onChange({ ...data, previous_heart_attack: v })}
          />
          <YesNoToggle
            label="سبق وعملت عملية قلب؟"
            value={data.heart_surgery}
            onChange={(v) => onChange({ ...data, heart_surgery: v })}
          />
        </SubQuestion>
      </section>

      <SectionDivider />

      {/* ── أمراض الكلى ── */}
      <section className="flex flex-col gap-3">
        <span className="text-sm font-medium text-gray-600">أمراض الكلى</span>
        <div className="flex flex-wrap gap-2">
          <SelectionChip
            label="لا يوجد ✓"
            selected={data.kidney_disease === 'none'}
            onToggle={() =>
              onChange({
                ...data,
                kidney_disease: data.kidney_disease === 'none' ? null : 'none',
              })
            }
          />
          <SelectionChip
            label="نعم"
            selected={data.kidney_disease === 'known'}
            onToggle={() =>
              onChange({
                ...data,
                kidney_disease: data.kidney_disease === 'known' ? null : 'known',
              })
            }
          />
          <SelectionChip
            label="مش عارف"
            selected={data.kidney_disease === 'unknown'}
            onToggle={() =>
              onChange({
                ...data,
                kidney_disease:
                  data.kidney_disease === 'unknown' ? null : 'unknown',
              })
            }
          />
        </div>
      </section>

      <SectionDivider />

      {/* ── أمراض الكبد ── */}
      <section className="flex flex-col gap-3">
        <span className="text-sm font-medium text-gray-600">أمراض الكبد</span>
        <div className="flex flex-wrap gap-2">
          <SelectionChip
            label="لا يوجد ✓"
            selected={data.liver_disease === 'none'}
            onToggle={() =>
              onChange({
                ...data,
                liver_disease: data.liver_disease === 'none' ? null : 'none',
              })
            }
          />
          <SelectionChip
            label="نعم"
            selected={data.liver_disease === 'known'}
            onToggle={() =>
              onChange({
                ...data,
                liver_disease: data.liver_disease === 'known' ? null : 'known',
              })
            }
          />
          <SelectionChip
            label="مش عارف"
            selected={data.liver_disease === 'unknown'}
            onToggle={() =>
              onChange({
                ...data,
                liver_disease:
                  data.liver_disease === 'unknown' ? null : 'unknown',
              })
            }
          />
        </div>
      </section>
    </div>
  );
}
