'use client';

import { useState, useCallback, useRef } from 'react';
import InteractionAlert from './InteractionAlert';
import InteractionBadge from './InteractionBadge';
import PaediatricDoseCalculator, { type CopyDosePayload } from './PaediatricDoseCalculator';
import type { CheckResult, InteractionOverride } from '@triaji/shared/types';

// ─── Types ───────────────────────────────────────────────────────────────────

interface MedicationRow {
  id: string;
  drugNameAr: string;
  drugNameEn: string;
  dose: string;
  route: 'oral' | 'injection' | 'topical' | 'inhaled';
  frequencyAr: string;
  frequencyEn: string;
  durationAr: string;
  durationEn: string;
  instructionsAr: string;
  instructionsEn: string;
}

interface PrescriptionFormData {
  diagnosisAr: string;
  diagnosisEn: string;
  medications: MedicationRow[];
  pharmacistNotes: string;
  followUpValue: number;
  followUpUnit: 'day' | 'week' | 'month';
  overrides?: InteractionOverride[];
}

interface PrescriptionFormProps {
  onPreview: (data: PrescriptionFormData) => void;
  onSubmit: (data: PrescriptionFormData) => Promise<void>;
  loading: boolean;
  patientId?: string;
  doctorAccountId?: string;
  /** Existing patient medications from patient_medications table */
  patientMedications?: { drugNameAr: string; drugNameEn: string | null }[];
  lang?: 'ar' | 'en';
  /** Paediatric patient info — if provided, shows dose calculator */
  isPaediatric?: boolean;
  patientWeightKg?: number;
  patientAgeMonths?: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ROUTE_OPTIONS: { value: MedicationRow['route']; labelAr: string }[] = [
  { value: 'oral', labelAr: 'فموي' },
  { value: 'injection', labelAr: 'حقن' },
  { value: 'topical', labelAr: 'موضعي' },
  { value: 'inhaled', labelAr: 'استنشاق' },
];

const FOLLOW_UP_UNITS: { value: PrescriptionFormData['followUpUnit']; labelAr: string }[] = [
  { value: 'day', labelAr: 'يوم' },
  { value: 'week', labelAr: 'أسبوع' },
  { value: 'month', labelAr: 'شهر' },
];

function createEmptyMedication(): MedicationRow {
  return {
    id: crypto.randomUUID(),
    drugNameAr: '',
    drugNameEn: '',
    dose: '',
    route: 'oral',
    frequencyAr: '',
    frequencyEn: '',
    durationAr: '',
    durationEn: '',
    instructionsAr: '',
    instructionsEn: '',
  };
}

const inputClass =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-[Cairo] focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500';
const labelClass = 'block text-sm font-medium text-gray-700 font-[Cairo] mb-1';

// ─── Strings ────────────────────────────────────────────────────────────────

const STRINGS = {
  checkingInteractions: { ar: 'جاري فحص التفاعلات الدوائية...', en: 'Checking drug interactions...' },
  checkFailed: { ar: 'تعذر التحقق من التفاعلات — راجع مرجعاً دوائياً', en: 'Interaction check unavailable — consult a drug reference' },
  noInteractions: { ar: 'لا توجد تفاعلات دوائية معروفة', en: 'No known drug interactions' },
  saveBlocked: {
    ar: 'لا يمكن الحفظ: يوجد تفاعل دوائي خطير بدون سبب للمتابعة',
    en: 'Cannot save: serious drug interaction without override reason',
  },
} as const;

// ─── Component ──────────────────────────────────────────────────────────────

export default function PrescriptionForm({
  onPreview,
  onSubmit,
  loading,
  patientId,
  doctorAccountId,
  patientMedications = [],
  lang = 'ar',
  isPaediatric = false,
  patientWeightKg,
  patientAgeMonths,
}: PrescriptionFormProps) {
  const [open, setOpen] = useState(false);
  const [showDoseCalc, setShowDoseCalc] = useState(false);
  const [diagnosisAr, setDiagnosisAr] = useState('');
  const [diagnosisEn, setDiagnosisEn] = useState('');
  const [medications, setMedications] = useState<MedicationRow[]>([createEmptyMedication()]);
  const [pharmacistNotes, setPharmacistNotes] = useState('');
  const [followUpValue, setFollowUpValue] = useState(0);
  const [followUpUnit, setFollowUpUnit] = useState<PrescriptionFormData['followUpUnit']>('day');

  // ── Interaction State ──────────────────────────────────────────────────────
  const [interactionResults, setInteractionResults] = useState<Record<string, CheckResult>>({});
  const [interactionLoading, setInteractionLoading] = useState<Record<string, boolean>>({});
  const [interactionErrors, setInteractionErrors] = useState<Record<string, boolean>>({});
  const [overrides, setOverrides] = useState<Record<string, { drugA: string; drugB: string; severity: string; reason: string }>>({});
  const [acknowledgements, setAcknowledgements] = useState<Record<string, boolean>>({});
  const checkAbortControllers = useRef<Record<string, AbortController>>({});

  // ── Helpers ────────────────────────────────────────────────────────────────

  const getFormData = useCallback((): PrescriptionFormData => {
    // Collect overrides into InteractionOverride[]
    const overrideList: InteractionOverride[] = Object.values(overrides).map((o) => ({
      drugA: o.drugA,
      drugB: o.drugB,
      severity: o.severity as InteractionOverride['severity'],
      overrideReasonAr: o.reason,
    }));

    return {
      diagnosisAr,
      diagnosisEn,
      medications,
      pharmacistNotes,
      followUpValue,
      followUpUnit,
      overrides: overrideList.length > 0 ? overrideList : undefined,
    };
  }, [diagnosisAr, diagnosisEn, medications, pharmacistNotes, followUpValue, followUpUnit, overrides]);

  // ── Check if save is blocked ──────────────────────────────────────────────

  const hasMedWithUnresolvedBlocker = useCallback((): boolean => {
    for (const med of medications) {
      const result = interactionResults[med.id];
      if (!result?.hasBlocker) continue;

      // Check if all blocking interactions for this med have overrides
      const blockers = result.interactions.filter(
        (i) => i.severity === 'contraindicated' || i.severity === 'major'
      );

      for (const blocker of blockers) {
        const key = `${med.id}:${blocker.drugA}-${blocker.drugB}`;
        if (!overrides[key]) return true;
      }
    }
    return false;
  }, [medications, interactionResults, overrides]);

  // ── Interaction Check ──────────────────────────────────────────────────────

  const checkInteractions = useCallback(
    async (medId: string, drugNameAr: string, drugNameEn: string) => {
      if (!drugNameAr && !drugNameEn) return;
      if (!patientId || !doctorAccountId) return;

      // Abort any previous check for this row
      if (checkAbortControllers.current[medId]) {
        checkAbortControllers.current[medId].abort();
      }
      const controller = new AbortController();
      checkAbortControllers.current[medId] = controller;

      // Build existingDrugs: patient_medications + other drugs in current prescription
      const existingDrugs = [
        ...patientMedications.map((m) => ({
          nameAr: m.drugNameAr,
          nameEn: m.drugNameEn,
        })),
        ...medications
          .filter((m) => m.id !== medId && (m.drugNameAr || m.drugNameEn))
          .map((m) => ({
            nameAr: m.drugNameAr,
            nameEn: m.drugNameEn || null,
          })),
      ];

      if (existingDrugs.length === 0) return;

      setInteractionLoading((prev) => ({ ...prev, [medId]: true }));
      setInteractionErrors((prev) => ({ ...prev, [medId]: false }));

      try {
        const res = await fetch('/api/interactions/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            newDrug: { nameAr: drugNameAr, nameEn: drugNameEn || null },
            existingDrugs,
            patientId,
            doctorAccountId,
          }),
          signal: controller.signal,
        });

        if (!res.ok) throw new Error('Check failed');
        const result: CheckResult = await res.json();
        setInteractionResults((prev) => ({ ...prev, [medId]: result }));
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
        setInteractionErrors((prev) => ({ ...prev, [medId]: true }));
      } finally {
        setInteractionLoading((prev) => ({ ...prev, [medId]: false }));
      }
    },
    [patientId, doctorAccountId, patientMedications, medications]
  );

  // ── Medication CRUD ───────────────────────────────────────────────────────

  const updateMedication = (id: string, field: keyof MedicationRow, value: string) => {
    setMedications((prev) =>
      prev.map((m) => (m.id === id ? { ...m, [field]: value } : m))
    );
  };

  const removeMedication = (id: string) => {
    setMedications((prev) => prev.filter((m) => m.id !== id));
    // Clean up interaction state for removed row
    setInteractionResults((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setInteractionLoading((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setInteractionErrors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    // Clean up overrides for this med
    setOverrides((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        if (key.startsWith(`${id}:`)) delete next[key];
      }
      return next;
    });
    setAcknowledgements((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        if (key.startsWith(`${id}:`)) delete next[key];
      }
      return next;
    });
  };

  const addMedication = () => {
    setMedications((prev) => [...prev, createEmptyMedication()]);
  };

  // ── Drug name blur handler ────────────────────────────────────────────────

  const handleDrugBlur = (med: MedicationRow) => {
    if (med.drugNameAr || med.drugNameEn) {
      checkInteractions(med.id, med.drugNameAr, med.drugNameEn);
    }
  };

  // ── Interaction callbacks ─────────────────────────────────────────────────

  const handleRemoveDrug = (medId: string, _drugName: string) => {
    removeMedication(medId);
  };

  const handleOverride = (medId: string, drugA: string, drugB: string, severity: string, reason: string) => {
    const key = `${medId}:${drugA}-${drugB}`;
    setOverrides((prev) => ({
      ...prev,
      [key]: { drugA, drugB, severity, reason },
    }));
  };

  const handleAcknowledge = (medId: string, drugName: string) => {
    const key = `${medId}:${drugName}`;
    setAcknowledgements((prev) => ({ ...prev, [key]: true }));
  };

  // ── Submit / Preview ──────────────────────────────────────────────────────

  const handlePreview = () => {
    onPreview(getFormData());
  };

  const handleSubmit = async () => {
    await onSubmit(getFormData());
  };

  const saveBlocked = hasMedWithUnresolvedBlocker();

  // ── Dose calculator copy handler ────────────────────────────────────────

  const handleCopyFromDoseCalc = useCallback((payload: CopyDosePayload) => {
    // Find the first empty medication row, or add a new one
    const emptyRow = medications.find((m) => !m.drugNameAr && !m.drugNameEn);
    if (emptyRow) {
      setMedications((prev) =>
        prev.map((m) =>
          m.id === emptyRow.id
            ? {
                ...m,
                drugNameAr: payload.drugNameAr,
                drugNameEn: payload.drugNameEn,
                dose: payload.dose,
                frequencyAr: payload.frequencyAr,
                frequencyEn: payload.frequencyEn,
              }
            : m
        )
      );
    } else {
      setMedications((prev) => [
        ...prev,
        {
          ...createEmptyMedication(),
          drugNameAr: payload.drugNameAr,
          drugNameEn: payload.drugNameEn,
          dose: payload.dose,
          frequencyAr: payload.frequencyAr,
          frequencyEn: payload.frequencyEn,
        },
      ]);
    }
    setShowDoseCalc(false);
  }, [medications]);

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden" dir="rtl">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between px-5 py-4 text-right font-[Cairo] font-semibold text-base transition-colors ${
          open ? 'bg-white text-teal-700' : 'bg-gray-50 text-gray-800 hover:bg-gray-100'
        }`}
      >
        <span>{open ? '--- إغلاق' : '+++ كتابة روشتة'}</span>
      </button>

      {open && (
        <div className="p-5 space-y-6 bg-white">
          {/* Paediatric dose calculator button */}
          {isPaediatric && patientWeightKg && patientAgeMonths && (
            <div>
              <button
                type="button"
                onClick={() => setShowDoseCalc(!showDoseCalc)}
                className="flex items-center gap-2 text-sm font-semibold text-teal-700 bg-teal-50 border border-teal-200 rounded-lg px-4 py-2.5 hover:bg-teal-100 transition-colors font-[Cairo] w-full justify-center"
              >
                <span>🧮</span>
                <span>{lang === 'ar' ? 'حاسبة جرعة الأطفال' : 'Paediatric Dose Calculator'}</span>
              </button>

              {showDoseCalc && (
                <div className="mt-3">
                  <PaediatricDoseCalculator
                    weightKg={patientWeightKg}
                    ageMonths={patientAgeMonths}
                    lang={lang}
                    onCopyToPrescription={handleCopyFromDoseCalc}
                  />
                </div>
              )}
            </div>
          )}

          {/* Diagnosis */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>التشخيص بالعربي</label>
              <input
                type="text"
                dir="rtl"
                className={inputClass}
                placeholder="مثال: التهاب اللوزتين الحاد"
                value={diagnosisAr}
                onChange={(e) => setDiagnosisAr(e.target.value)}
              />
            </div>
            <div>
              <label className={`${labelClass} text-left`}>Diagnosis in English</label>
              <input
                type="text"
                dir="ltr"
                className={`${inputClass} text-left`}
                placeholder="e.g. Acute tonsillitis"
                value={diagnosisEn}
                onChange={(e) => setDiagnosisEn(e.target.value)}
              />
            </div>
          </div>

          {/* Medications */}
          <div className="space-y-4">
            <h3 className="font-[Cairo] font-semibold text-gray-800">الأدوية</h3>
            {medications.map((med, index) => {
              const result = interactionResults[med.id];
              const isChecking = interactionLoading[med.id];
              const hasError = interactionErrors[med.id];
              const highestSeverity = result?.highestSeverity;

              return (
                <div key={med.id}>
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 space-y-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-[Cairo] font-medium text-gray-500">
                          دواء #{index + 1}
                        </span>
                        {/* Interaction badge next to drug number */}
                        {highestSeverity && (
                          <InteractionBadge
                            severity={highestSeverity}
                            drugPair={
                              result?.interactions[0]
                                ? `${result.interactions[0].drugA} + ${result.interactions[0].drugB}`
                                : ''
                            }
                            lang={lang}
                          />
                        )}
                        {isChecking && (
                          <span className="text-xs text-teal-600 font-[Cairo] animate-pulse">
                            {STRINGS.checkingInteractions[lang]}
                          </span>
                        )}
                        {hasError && (
                          <span className="text-xs text-amber-600 font-[Cairo]">
                            {STRINGS.checkFailed[lang]}
                          </span>
                        )}
                      </div>
                      {medications.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeMedication(med.id)}
                          className="text-red-500 text-sm font-[Cairo] hover:text-red-700"
                        >
                          حذف
                        </button>
                      )}
                    </div>

                    {/* Drug name */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className={labelClass}>اسم الدواء بالعربي *</label>
                        <input
                          type="text"
                          dir="rtl"
                          required
                          className={inputClass}
                          value={med.drugNameAr}
                          onChange={(e) => updateMedication(med.id, 'drugNameAr', e.target.value)}
                          onBlur={() => handleDrugBlur(med)}
                        />
                      </div>
                      <div>
                        <label className={`${labelClass} text-left`}>Drug name in English</label>
                        <input
                          type="text"
                          dir="ltr"
                          className={`${inputClass} text-left`}
                          value={med.drugNameEn}
                          onChange={(e) => updateMedication(med.id, 'drugNameEn', e.target.value)}
                          onBlur={() => handleDrugBlur(med)}
                        />
                      </div>
                    </div>

                    {/* Dose + Route */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className={labelClass}>الجرعة / Dose *</label>
                        <input
                          type="text"
                          dir="rtl"
                          required
                          className={inputClass}
                          placeholder="مثال: 500 مجم"
                          value={med.dose}
                          onChange={(e) => updateMedication(med.id, 'dose', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>طريقة الاستخدام / Route</label>
                        <select
                          className={inputClass}
                          value={med.route}
                          onChange={(e) =>
                            updateMedication(med.id, 'route', e.target.value)
                          }
                        >
                          {ROUTE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.labelAr}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Frequency */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className={labelClass}>عدد المرات بالعربي *</label>
                        <input
                          type="text"
                          dir="rtl"
                          required
                          className={inputClass}
                          placeholder="مثال: 3 مرات يوميًا"
                          value={med.frequencyAr}
                          onChange={(e) => updateMedication(med.id, 'frequencyAr', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className={`${labelClass} text-left`}>Frequency in English</label>
                        <input
                          type="text"
                          dir="ltr"
                          className={`${inputClass} text-left`}
                          placeholder="e.g. 3 times daily"
                          value={med.frequencyEn}
                          onChange={(e) => updateMedication(med.id, 'frequencyEn', e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Duration */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className={labelClass}>المدة بالعربي</label>
                        <input
                          type="text"
                          dir="rtl"
                          className={inputClass}
                          placeholder="مثال: 7 أيام"
                          value={med.durationAr}
                          onChange={(e) => updateMedication(med.id, 'durationAr', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className={`${labelClass} text-left`}>Duration in English</label>
                        <input
                          type="text"
                          dir="ltr"
                          className={`${inputClass} text-left`}
                          placeholder="e.g. 7 days"
                          value={med.durationEn}
                          onChange={(e) => updateMedication(med.id, 'durationEn', e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Instructions */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className={labelClass}>تعليمات بالعربي</label>
                        <input
                          type="text"
                          dir="rtl"
                          className={inputClass}
                          placeholder="مثال: بعد الأكل"
                          value={med.instructionsAr}
                          onChange={(e) => updateMedication(med.id, 'instructionsAr', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className={`${labelClass} text-left`}>Instructions in English</label>
                        <input
                          type="text"
                          dir="ltr"
                          className={`${inputClass} text-left`}
                          placeholder="e.g. After meals"
                          value={med.instructionsEn}
                          onChange={(e) => updateMedication(med.id, 'instructionsEn', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Interaction Alert below the drug row */}
                  {result && result.interactions.length > 0 && (
                    <div className="mt-2">
                      <InteractionAlert
                        interactions={result.interactions}
                        lang={lang}
                        onRemoveDrug={() => handleRemoveDrug(med.id, '')}
                        onOverride={(drugName, reason) => {
                          // Find the matching interaction to get drugA/drugB/severity
                          const interaction = result.interactions.find(
                            (i) => i.drugB === drugName || i.drugA === drugName
                          );
                          if (interaction) {
                            handleOverride(
                              med.id,
                              interaction.drugA,
                              interaction.drugB,
                              interaction.severity,
                              reason
                            );
                          }
                        }}
                        onAcknowledge={(drugName) => handleAcknowledge(med.id, drugName)}
                      />
                    </div>
                  )}

                  {/* No interactions found (green checkmark) */}
                  {result && result.interactions.length === 0 && (
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-green-600 font-[Cairo]">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                      </svg>
                      {STRINGS.noInteractions[lang]}
                    </div>
                  )}
                </div>
              );
            })}

            <button
              type="button"
              onClick={addMedication}
              className="text-teal-600 font-[Cairo] font-medium text-sm hover:text-teal-700"
            >
              + إضافة دواء
            </button>
          </div>

          {/* Pharmacist notes */}
          <div>
            <label className={labelClass}>ملاحظات للصيدلي</label>
            <textarea
              dir="rtl"
              className={`${inputClass} min-h-[80px]`}
              placeholder="أي تعليمات إضافية للصيدلي..."
              value={pharmacistNotes}
              onChange={(e) => setPharmacistNotes(e.target.value)}
            />
          </div>

          {/* Follow-up */}
          <div>
            <label className={labelClass}>موعد المتابعة</label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={0}
                className={`${inputClass} w-24`}
                value={followUpValue || ''}
                onChange={(e) => setFollowUpValue(Number(e.target.value))}
              />
              <select
                className={`${inputClass} w-32`}
                value={followUpUnit}
                onChange={(e) =>
                  setFollowUpUnit(e.target.value as PrescriptionFormData['followUpUnit'])
                }
              >
                {FOLLOW_UP_UNITS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.labelAr}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Save blocked warning */}
          {saveBlocked && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 font-[Cairo]">
              {STRINGS.saveBlocked[lang]}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={handlePreview}
              disabled={loading}
              className="flex-1 rounded-lg border-2 border-teal-600 text-teal-600 py-2.5 font-[Cairo] font-semibold text-sm hover:bg-teal-50 transition-colors disabled:opacity-50"
            >
              معاينة الروشتة
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading || saveBlocked}
              className="flex-1 rounded-lg bg-teal-600 text-white py-2.5 font-[Cairo] font-semibold text-sm hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'جاري الحفظ...' : 'حفظ وإرسال للمريض'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
