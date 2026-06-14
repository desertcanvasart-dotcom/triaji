'use client';

import { useState } from 'react';
import SelectionChip from './SelectionChip';
import MedicationRow, { type MedicationEntry } from './MedicationRow';
import NumberStepper from './NumberStepper';

/* ── Types ────────────────────────────────────────────────────── */

export interface CatalogOption {
  code: string;
  name_ar: string;
  name_en: string;
  category: string;
  sort_order: number;
}

export interface AllergyEntry {
  code: string;
  notes_ar?: string;
}

export interface ChronicConditionEntry {
  code: string;
  notes_ar?: string;
  diagnosed_year?: number;
}

export interface SurgeryEntry {
  code: string;
  year_approximate?: number;
  notes_ar?: string;
}

export interface MedicalHistoryData {
  allergies: AllergyEntry[];
  chronic_conditions: ChronicConditionEntry[];
  medications: MedicationEntry[];
  surgeries: SurgeryEntry[];
}

interface StepMedicalHistoryProps {
  data: MedicalHistoryData;
  onChange: (data: MedicalHistoryData) => void;
  catalogs: {
    allergyOptions: CatalogOption[];
    conditionOptions: CatalogOption[];
    surgeryOptions: CatalogOption[];
  };
}

/* ── Helpers ──────────────────────────────────────────────────── */

const ALLERGY_CATEGORY_META: Record<string, { icon: string; label: string }> = {
  medication: { icon: '🏥', label: 'أدوية' },
  food: { icon: '🥜', label: 'طعام' },
  environmental: { icon: '🌿', label: 'بيئية' },
  other: { icon: '➕', label: 'أخرى' },
};

function groupByCategory(options: CatalogOption[]): Map<string, CatalogOption[]> {
  const map = new Map<string, CatalogOption[]>();
  for (const opt of [...options].sort((a, b) => a.sort_order - b.sort_order)) {
    const group = map.get(opt.category) ?? [];
    group.push(opt);
    map.set(opt.category, group);
  }
  return map;
}

const inputBase =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700';

const EMPTY_MEDICATION: MedicationEntry = {
  drug_name_ar: '',
  dose: '',
  frequency_ar: '',
  for_condition_ar: '',
};

const MAX_MEDICATIONS = 15;

/* ── Toggle Banner ────────────────────────────────────────────── */

function NoneToggle({
  label,
  active,
  onToggle,
}: {
  label: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      onClick={onToggle}
      className={`
        flex items-center gap-3 w-full rounded-xl border-2 px-4 py-3 text-sm font-medium transition-all
        ${
          active
            ? 'border-teal-700 bg-teal-50 text-teal-800'
            : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300'
        }
      `}
    >
      <span
        className={`
          flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors
          ${active ? 'border-teal-700 bg-teal-700' : 'border-gray-300 bg-white'}
        `}
      >
        {active && (
          <svg viewBox="0 0 12 12" className="h-3 w-3 text-white" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M2.5 6l2.5 2.5 4.5-5" />
          </svg>
        )}
      </span>
      <span>{label}</span>
    </button>
  );
}

/* ── Section Wrapper ──────────────────────────────────────────── */

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-base font-bold text-gray-900">{title}</h3>
        <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

/* ── Main Component ───────────────────────────────────────────── */

export default function StepMedicalHistory({
  data,
  onChange,
  catalogs,
}: StepMedicalHistoryProps) {
  /* ─ convenience updaters ─ */
  function updateAllergies(allergies: AllergyEntry[]) {
    onChange({ ...data, allergies });
  }
  function updateConditions(chronic_conditions: ChronicConditionEntry[]) {
    onChange({ ...data, chronic_conditions });
  }
  function updateMedications(medications: MedicationEntry[]) {
    onChange({ ...data, medications });
  }
  function updateSurgeries(surgeries: SurgeryEntry[]) {
    onChange({ ...data, surgeries });
  }

  /* ─ "none" toggles ─ */
  const [noAllergies, setNoAllergies] = useState(data.allergies.length === 0);
  const [noConditions, setNoConditions] = useState(data.chronic_conditions.length === 0);
  const [noMedications, setNoMedications] = useState(data.medications.length === 0);
  const [noSurgeries, setNoSurgeries] = useState(data.surgeries.length === 0);

  /* ─ grouped allergy options ─ */
  const allergyGroups = groupByCategory(catalogs.allergyOptions);

  return (
    <div className="flex flex-col gap-10">
      {/* ════════════ الحساسية ════════════ */}
      <Section title="الحساسية" subtitle="هل عندك حساسية من أي حاجة؟">
        <NoneToggle
          label="لا يوجد"
          active={noAllergies}
          onToggle={() => {
            const next = !noAllergies;
            setNoAllergies(next);
            if (next) updateAllergies([]);
          }}
        />

        {!noAllergies && (
          <div className="flex flex-col gap-5">
            {Array.from(allergyGroups.entries()).map(([category, options]) => {
              const meta = ALLERGY_CATEGORY_META[category] ?? {
                icon: '➕',
                label: category,
              };

              return (
                <div key={category} className="flex flex-col gap-2">
                  <p className="text-xs font-semibold text-gray-500">
                    {meta.icon} {meta.label}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {options.map((opt) => {
                      const selected = data.allergies.some(
                        (a) => a.code === opt.code
                      );

                      return (
                        <SelectionChip
                          key={opt.code}
                          label={opt.name_ar}
                          selected={selected}
                          onToggle={() => {
                            if (selected) {
                              updateAllergies(
                                data.allergies.filter((a) => a.code !== opt.code)
                              );
                            } else {
                              updateAllergies([
                                ...data.allergies,
                                { code: opt.code },
                              ]);
                            }
                          }}
                        />
                      );
                    })}
                  </div>

                  {/* "other" text input */}
                  {options.some(
                    (opt) =>
                      opt.code === 'other' &&
                      data.allergies.some((a) => a.code === 'other')
                  ) && (
                    <input
                      type="text"
                      value={
                        data.allergies.find((a) => a.code === 'other')
                          ?.notes_ar ?? ''
                      }
                      onChange={(e) => {
                        updateAllergies(
                          data.allergies.map((a) =>
                            a.code === 'other'
                              ? { ...a, notes_ar: e.target.value }
                              : a
                          )
                        );
                      }}
                      placeholder="حدد نوع الحساسية..."
                      className={inputBase}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* ════════════ أمراض مزمنة ════════════ */}
      <Section title="أمراض مزمنة أخرى" subtitle="هل عندك أي من الأمراض دي؟">
        <NoneToggle
          label="لا يوجد"
          active={noConditions}
          onToggle={() => {
            const next = !noConditions;
            setNoConditions(next);
            if (next) updateConditions([]);
          }}
        />

        {!noConditions && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              {[...catalogs.conditionOptions]
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((opt) => {
                  const selected = data.chronic_conditions.some(
                    (c) => c.code === opt.code
                  );

                  return (
                    <SelectionChip
                      key={opt.code}
                      label={opt.name_ar}
                      selected={selected}
                      onToggle={() => {
                        if (selected) {
                          updateConditions(
                            data.chronic_conditions.filter(
                              (c) => c.code !== opt.code
                            )
                          );
                        } else {
                          updateConditions([
                            ...data.chronic_conditions,
                            { code: opt.code },
                          ]);
                        }
                      }}
                    />
                  );
                })}
            </div>

            {/* Notes input for 'other' or 'cancer' */}
            {data.chronic_conditions
              .filter((c) => c.code === 'other' || c.code === 'cancer')
              .map((entry) => (
                <input
                  key={entry.code}
                  type="text"
                  value={entry.notes_ar ?? ''}
                  onChange={(e) => {
                    updateConditions(
                      data.chronic_conditions.map((c) =>
                        c.code === entry.code
                          ? { ...c, notes_ar: e.target.value }
                          : c
                      )
                    );
                  }}
                  placeholder={
                    entry.code === 'cancer'
                      ? 'حدد نوع السرطان...'
                      : 'حدد المرض...'
                  }
                  className={inputBase}
                />
              ))}
          </div>
        )}
      </Section>

      {/* ════════════ الأدوية الحالية ════════════ */}
      <Section title="الأدوية الحالية" subtitle="هل بتاخد أي أدوية حالياً؟">
        <NoneToggle
          label="لا أتناول أي أدوية"
          active={noMedications}
          onToggle={() => {
            const next = !noMedications;
            setNoMedications(next);
            if (next) updateMedications([]);
          }}
        />

        {!noMedications && (
          <div className="flex flex-col gap-3">
            {data.medications.map((med, idx) => (
              <MedicationRow
                key={idx}
                medication={med}
                onChange={(updated) => {
                  const next = [...data.medications];
                  next[idx] = updated;
                  updateMedications(next);
                }}
                onRemove={() => {
                  updateMedications(data.medications.filter((_, i) => i !== idx));
                }}
              />
            ))}

            {data.medications.length < MAX_MEDICATIONS && (
              <button
                type="button"
                onClick={() =>
                  updateMedications([...data.medications, { ...EMPTY_MEDICATION }])
                }
                className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 px-4 py-3 text-sm font-medium text-gray-500 transition-colors hover:border-teal-700 hover:text-teal-700 active:bg-teal-50"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-5 w-5"
                >
                  <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                </svg>
                إضافة دواء
              </button>
            )}

            {data.medications.length >= MAX_MEDICATIONS && (
              <p className="text-center text-xs text-gray-400">
                الحد الأقصى {MAX_MEDICATIONS} أدوية
              </p>
            )}
          </div>
        )}
      </Section>

      {/* ════════════ عمليات سابقة ════════════ */}
      <Section title="عمليات سابقة" subtitle="هل سبق وعملت عمليات جراحية؟">
        <NoneToggle
          label="لا"
          active={noSurgeries}
          onToggle={() => {
            const next = !noSurgeries;
            setNoSurgeries(next);
            if (next) updateSurgeries([]);
          }}
        />

        {!noSurgeries && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              {[...catalogs.surgeryOptions]
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((opt) => {
                  const selected = data.surgeries.some(
                    (s) => s.code === opt.code
                  );

                  return (
                    <SelectionChip
                      key={opt.code}
                      label={opt.name_ar}
                      selected={selected}
                      onToggle={() => {
                        if (selected) {
                          updateSurgeries(
                            data.surgeries.filter((s) => s.code !== opt.code)
                          );
                        } else {
                          updateSurgeries([
                            ...data.surgeries,
                            { code: opt.code },
                          ]);
                        }
                      }}
                    />
                  );
                })}
            </div>

            {/* Year stepper + notes for selected surgeries */}
            {data.surgeries.map((entry) => {
              const opt = catalogs.surgeryOptions.find(
                (o) => o.code === entry.code
              );
              if (!opt) return null;

              return (
                <div
                  key={entry.code}
                  className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4"
                >
                  <p className="text-sm font-medium text-gray-700">
                    {opt.name_ar}
                  </p>

                  <NumberStepper
                    label="سنة العملية (تقريبي)"
                    value={entry.year_approximate ?? null}
                    onChange={(val) => {
                      updateSurgeries(
                        data.surgeries.map((s) =>
                          s.code === entry.code
                            ? { ...s, year_approximate: val ?? undefined }
                            : s
                        )
                      );
                    }}
                    min={1950}
                    max={2026}
                    step={1}
                  />

                  {entry.code === 'other' && (
                    <input
                      type="text"
                      value={entry.notes_ar ?? ''}
                      onChange={(e) => {
                        updateSurgeries(
                          data.surgeries.map((s) =>
                            s.code === 'other'
                              ? { ...s, notes_ar: e.target.value }
                              : s
                          )
                        );
                      }}
                      placeholder="حدد نوع العملية..."
                      className={inputBase}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Section>
    </div>
  );
}
