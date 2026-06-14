'use client';

import { useState, useEffect, useCallback } from 'react';
import { t, type Lang } from '@triaji/shared/i18n';

// ─── Types ──────────────────────────────────────────────────────────────────

interface PaediatricDoseCalculatorProps {
  weightKg: number;
  ageMonths: number;
  lang: Lang;
  onCopyToPrescription: (dose: CopyDosePayload) => void;
}

export interface CopyDosePayload {
  drugNameAr: string;
  drugNameEn: string;
  dose: string;
  frequencyAr: string;
  frequencyEn: string;
}

interface DrugListItem {
  id: string;
  drug_name_en: string;
  drug_name_ar: string;
  indication_ar: string | null;
}

interface CalculatedFormulation {
  form: string;
  concentration: string;
  unit: string;
  notesAr?: string;
  minVolumePerDose: number | null;
  maxVolumePerDose: number | null;
  volumeUnit: string;
  isSuitable: boolean;
  unsuitableReason?: string;
}

interface CalculatedDose {
  drugId: string;
  drugNameAr: string;
  drugNameEn: string;
  indicationAr: string | null;
  dosesPerDay: number;
  formulaDescription: string;
  minDosePerDose: number;
  maxDosePerDose: number;
  minDailyDose: number;
  maxDailyDose: number;
  cappedMinPerDose: number;
  cappedMaxPerDose: number;
  cappedMinDaily: number;
  cappedMaxDaily: number;
  maxSingleDoseMg: number | null;
  maxDailyDoseMg: number | null;
  notesAr: string | null;
  formulations: CalculatedFormulation[];
}

// ─── Strings ────────────────────────────────────────────────────────────────

const STRINGS = {
  searchPlaceholder: { ar: 'ابحث عن الدواء...', en: 'Search for drug...' },
  selectDrug: { ar: 'اختر الدواء', en: 'Select drug' },
  noResults: { ar: 'لا توجد نتائج', en: 'No results' },
  loading: { ar: 'جاري البحث...', en: 'Searching...' },
  formula: { ar: 'المعادلة', en: 'Formula' },
  perDose: { ar: 'لكل جرعة', en: 'Per dose' },
  daily: { ar: 'يومياً', en: 'Daily' },
  maxSingleDose: { ar: 'أقصى جرعة واحدة', en: 'Max single dose' },
  maxDailyDose: { ar: 'أقصى جرعة يومية', en: 'Max daily dose' },
  capped: { ar: '(محددة)', en: '(capped)' },
  times: { ar: 'مرات', en: 'times' },
  notSuitable: { ar: 'غير مناسب لهذا الوزن', en: 'Not suitable for this weight' },
  noMatchingDrug: { ar: 'لا يوجد دواء مطابق لهذا العمر/الوزن', en: 'No matching drug for this age/weight' },
  patientInfo: { ar: 'بيانات المريض', en: 'Patient info' },
  weightLabel: { ar: 'الوزن', en: 'Weight' },
  ageLabel: { ar: 'العمر', en: 'Age' },
  monthsLabel: { ar: 'شهر', en: 'months' },
} as const;

// ─── Helpers ────────────────────────────────────────────────────────────────

function frequencyText(dosesPerDay: number, lang: Lang): { ar: string; en: string } {
  const freqMap: Record<number, { ar: string; en: string }> = {
    1: { ar: 'مرة واحدة يومياً', en: 'Once daily' },
    2: { ar: 'مرتين يومياً', en: 'Twice daily' },
    3: { ar: '3 مرات يومياً', en: '3 times daily' },
    4: { ar: '4 مرات يومياً', en: '4 times daily' },
    6: { ar: '6 مرات يومياً (كل 4 ساعات)', en: '6 times daily (every 4 hours)' },
  };
  return freqMap[dosesPerDay] ?? { ar: `${dosesPerDay} ${STRINGS.times.ar} يومياً`, en: `${dosesPerDay} ${STRINGS.times.en} daily` };
}

const inputClass =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-[Cairo] focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500';

// ─── Component ──────────────────────────────────────────────────────────────

export default function PaediatricDoseCalculator({
  weightKg,
  ageMonths,
  lang,
  onCopyToPrescription,
}: PaediatricDoseCalculatorProps) {
  const isRtl = lang === 'ar';
  const s = useCallback((key: keyof typeof STRINGS) => STRINGS[key][lang], [lang]);

  // Drug list for search
  const [allDrugs, setAllDrugs] = useState<DrugListItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDrug, setSelectedDrug] = useState<DrugListItem | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  // Calculation results
  const [calculated, setCalculated] = useState<CalculatedDose[]>([]);
  const [calcLoading, setCalcLoading] = useState(false);

  // Load drug list on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/doctor/paediatric-dose');
        if (res.ok) {
          const json = await res.json();
          setAllDrugs(json.drugs ?? []);
        }
      } catch {
        // Silent
      }
    })();
  }, []);

  // Filter drugs by search query
  const filteredDrugs = searchQuery.length >= 1
    ? allDrugs.filter(
        (d) =>
          d.drug_name_ar.includes(searchQuery) ||
          d.drug_name_en.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : allDrugs;

  // Calculate dose when drug is selected
  const handleSelectDrug = useCallback(async (drug: DrugListItem) => {
    setSelectedDrug(drug);
    setSearchQuery(lang === 'ar' ? drug.drug_name_ar : drug.drug_name_en);
    setShowDropdown(false);
    setCalcLoading(true);

    try {
      const res = await fetch(
        `/api/doctor/paediatric-dose?drug_name=${encodeURIComponent(drug.drug_name_en)}&weight_kg=${weightKg}&age_months=${ageMonths}`
      );
      if (res.ok) {
        const json = await res.json();
        setCalculated(json.calculated ?? []);
      }
    } catch {
      setCalculated([]);
    } finally {
      setCalcLoading(false);
    }
  }, [weightKg, ageMonths, lang]);

  // Copy to prescription handler
  const handleCopy = (dose: CalculatedDose, formulation?: CalculatedFormulation) => {
    const freq = frequencyText(dose.dosesPerDay, lang);
    const doseStr = formulation && formulation.isSuitable && formulation.maxVolumePerDose
      ? `${formulation.minVolumePerDose}–${formulation.maxVolumePerDose} ${formulation.volumeUnit} (${dose.cappedMinPerDose}–${dose.cappedMaxPerDose} mg)`
      : `${dose.cappedMinPerDose}–${dose.cappedMaxPerDose} mg`;

    onCopyToPrescription({
      drugNameAr: dose.drugNameAr,
      drugNameEn: dose.drugNameEn,
      dose: doseStr,
      frequencyAr: freq.ar,
      frequencyEn: freq.en,
    });
  };

  return (
    <div className="rounded-xl border border-teal-200 bg-teal-50/30 p-4 space-y-4" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-lg">🧮</span>
        <h3 className="text-base font-bold text-teal-800 font-[Cairo]">
          {t('paediatric.doseCalculator', lang)}
        </h3>
      </div>

      {/* Patient info bar */}
      <div className="flex items-center gap-4 text-xs text-teal-700 bg-teal-100/50 rounded-lg px-3 py-2">
        <span className="font-[Cairo]">
          {s('weightLabel')}: <strong>{weightKg} kg</strong>
        </span>
        <span className="text-teal-300">|</span>
        <span className="font-[Cairo]">
          {s('ageLabel')}: <strong>{ageMonths} {s('monthsLabel')}</strong>
        </span>
      </div>

      {/* Drug search */}
      <div className="relative">
        <input
          type="text"
          className={inputClass}
          placeholder={s('searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setShowDropdown(true);
            setSelectedDrug(null);
            setCalculated([]);
          }}
          onFocus={() => setShowDropdown(true)}
          dir={isRtl ? 'rtl' : 'ltr'}
        />

        {/* Dropdown */}
        {showDropdown && filteredDrugs.length > 0 && !selectedDrug && (
          <div className="absolute z-20 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {filteredDrugs.slice(0, 20).map((drug) => (
              <button
                key={drug.id}
                type="button"
                className="w-full text-right px-3 py-2 hover:bg-teal-50 transition-colors border-b border-gray-50 last:border-b-0"
                onClick={() => handleSelectDrug(drug)}
              >
                <p className="text-sm font-medium text-gray-900 font-[Cairo]">{drug.drug_name_ar}</p>
                <p className="text-xs text-gray-500" dir="ltr">{drug.drug_name_en}</p>
                {drug.indication_ar && (
                  <p className="text-xs text-teal-600 font-[Cairo]">{drug.indication_ar}</p>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Loading */}
      {calcLoading && (
        <div className="text-center py-4">
          <div className="text-sm text-teal-600 animate-pulse font-[Cairo]">{s('loading')}</div>
        </div>
      )}

      {/* Results */}
      {!calcLoading && selectedDrug && calculated.length === 0 && (
        <div className="text-center py-4">
          <p className="text-sm text-gray-500 font-[Cairo]">{s('noMatchingDrug')}</p>
        </div>
      )}

      {!calcLoading && calculated.map((dose) => (
        <div key={dose.drugId} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {/* Drug header */}
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <p className="text-sm font-bold text-gray-900 font-[Cairo]">{dose.drugNameAr}</p>
            <p className="text-xs text-gray-500" dir="ltr">{dose.drugNameEn}</p>
            {dose.indicationAr && (
              <p className="text-xs text-teal-600 font-[Cairo] mt-0.5">{dose.indicationAr}</p>
            )}
          </div>

          <div className="px-4 py-3 space-y-3">
            {/* Formula */}
            <div className="bg-blue-50 rounded-lg px-3 py-2">
              <p className="text-xs text-blue-600 font-medium font-[Cairo] mb-0.5">{s('formula')}</p>
              <p className="text-sm font-mono text-blue-900" dir="ltr">{dose.formulaDescription}</p>
            </div>

            {/* Calculated doses */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-lg p-2">
                <p className="text-xs text-gray-500 font-[Cairo]">
                  {t('paediatric.minDose', lang)} ({s('perDose')})
                </p>
                <p className="text-sm font-bold text-gray-900">
                  {dose.cappedMinPerDose} mg
                  {dose.maxSingleDoseMg && dose.minDosePerDose > dose.cappedMinPerDose && (
                    <span className="text-xs text-amber-600 font-normal mr-1"> {s('capped')}</span>
                  )}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-2">
                <p className="text-xs text-gray-500 font-[Cairo]">
                  {t('paediatric.maxDose', lang)} ({s('perDose')})
                </p>
                <p className="text-sm font-bold text-gray-900">
                  {dose.cappedMaxPerDose} mg
                  {dose.maxSingleDoseMg && dose.maxDosePerDose > dose.cappedMaxPerDose && (
                    <span className="text-xs text-amber-600 font-normal mr-1"> {s('capped')}</span>
                  )}
                </p>
              </div>
            </div>

            {/* Daily total */}
            <div className="flex items-center justify-between text-xs text-gray-500 font-[Cairo]">
              <span>{s('daily')}: {dose.cappedMinDaily}–{dose.cappedMaxDaily} mg</span>
              <span>{frequencyText(dose.dosesPerDay, lang)[lang]}</span>
            </div>

            {/* Caps info */}
            {dose.maxSingleDoseMg && (
              <p className="text-xs text-amber-600 font-[Cairo]">
                {s('maxSingleDose')}: {dose.maxSingleDoseMg} mg
              </p>
            )}
            {dose.maxDailyDoseMg && (
              <p className="text-xs text-amber-600 font-[Cairo]">
                {s('maxDailyDose')}: {dose.maxDailyDoseMg} mg
              </p>
            )}

            {/* Formulations */}
            {dose.formulations.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-700 font-[Cairo] mb-2">
                  {t('paediatric.availableFormulations', lang)}
                </p>
                <div className="space-y-2">
                  {dose.formulations.map((f, idx) => (
                    <div
                      key={idx}
                      className={`rounded-lg border px-3 py-2 ${
                        f.isSuitable
                          ? 'border-green-200 bg-green-50'
                          : 'border-red-200 bg-red-50 opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{f.form}</p>
                          <p className="text-xs text-gray-500" dir="ltr">{f.concentration}</p>
                        </div>
                        {f.isSuitable && f.minVolumePerDose !== null && f.maxVolumePerDose !== null ? (
                          <div className="text-right">
                            <p className="text-sm font-bold text-green-800">
                              {f.minVolumePerDose === f.maxVolumePerDose
                                ? `${f.maxVolumePerDose} ${f.volumeUnit}`
                                : `${f.minVolumePerDose}–${f.maxVolumePerDose} ${f.volumeUnit}`
                              }
                            </p>
                            <p className="text-xs text-green-600 font-[Cairo]">{s('perDose')}</p>
                          </div>
                        ) : (
                          <span className="text-xs text-red-600 font-[Cairo]">
                            {t('paediatric.notSuitableForWeight', lang)}
                          </span>
                        )}
                      </div>
                      {f.notesAr && (
                        <p className="text-xs text-gray-500 font-[Cairo] mt-1">{f.notesAr}</p>
                      )}

                      {/* Copy to prescription */}
                      {f.isSuitable && (
                        <button
                          type="button"
                          onClick={() => handleCopy(dose, f)}
                          className="mt-2 w-full text-center text-xs font-medium text-teal-700 bg-teal-100 hover:bg-teal-200 rounded-md py-1.5 transition-colors font-[Cairo]"
                        >
                          {t('paediatric.copyToPrescription', lang)}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Underlying calculation for doctor verification */}
            <div className="text-xs text-gray-400 border-t border-gray-100 pt-2 font-mono" dir="ltr">
              {weightKg} kg × {dose.formulaDescription} → {dose.minDosePerDose}–{dose.maxDosePerDose} mg/dose
            </div>

            {/* Notes */}
            {dose.notesAr && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <p className="text-xs text-amber-800 font-[Cairo]">{dose.notesAr}</p>
              </div>
            )}

            {/* Copy raw dose (without formulation) */}
            <button
              type="button"
              onClick={() => handleCopy(dose)}
              className="w-full text-center text-sm font-semibold text-teal-600 border-2 border-teal-600 rounded-lg py-2 hover:bg-teal-50 transition-colors font-[Cairo]"
            >
              {t('paediatric.copyToPrescription', lang)}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
