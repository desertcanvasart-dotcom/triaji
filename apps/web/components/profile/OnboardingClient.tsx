'use client';

import { useReducer, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

import StepProgress from './StepProgress';
import StepNavigation from './StepNavigation';
import StepBasicInfo from './StepBasicInfo';
import StepPhysical from './StepPhysical';
import StepWorkLifestyle from './StepWorkLifestyle';
import StepClinicalBaseline from './StepClinicalBaseline';
import StepMedicalHistory from './StepMedicalHistory';
import StepFamilyHistory from './StepFamilyHistory';
import StepReproductiveHealth from './StepReproductiveHealth';
import StepReview from './StepReview';

import type { CatalogOption } from './StepMedicalHistory';
import type { FamilyHistoryOption } from './StepFamilyHistory';
import type { OnboardingFormData } from './StepReview';

/* ─── Constants ─── */

const STEP_LABELS = [
  'المعلومات الأساسية',
  'القياسات الجسمية',
  'العمل ونمط الحياة',
  'الحالة الصحية',
  'التاريخ المرضي',
  'التاريخ العائلي',
  'الصحة الإنجابية',
  'مراجعة وتأكيد',
];

const TOTAL_STEPS = STEP_LABELS.length;

const INITIAL_DATA: OnboardingFormData = {
  // Step 0 - BasicInfo
  age: null,
  biological_sex: null,
  governorate_id: null,
  // Step 1 - Physical
  height_cm: null,
  weight_kg: null,
  // Step 2 - Work
  work_type: null,
  work_schedule: null,
  activity_level: null,
  // Step 3 - Clinical
  smoking_status: '',
  cigarettes_per_day: null,
  smoking_years: null,
  blood_pressure: '',
  bp_on_medication: false,
  diabetes_type: '',
  diabetes_control: '',
  diabetes_treatment: '',
  heart_condition: '',
  previous_heart_attack: false,
  heart_surgery: false,
  kidney_disease: '',
  liver_disease: '',
  // Step 4 - Medical History
  allergies: [],
  chronic_conditions: [],
  medications: [],
  surgeries: [],
  // Step 5 - Family History
  family_history: [],
  // Step 6 - Reproductive
  pregnancy_status: null,
  previous_pregnancies: null,
  menstrual_regularity: null,
  menopause_status: null,
  last_menstrual_period_approx: null,
};

/* ─── State types ─── */

interface Catalogs {
  allergyOptions: CatalogOption[];
  conditionOptions: CatalogOption[];
  surgeryOptions: CatalogOption[];
  familyHistoryOptions: FamilyHistoryOption[];
}

interface OnboardingState {
  step: number;
  data: OnboardingFormData;
  catalogs: Catalogs | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
}

type OnboardingAction =
  | { type: 'SET_STEP'; step: number }
  | { type: 'UPDATE_DATA'; partial: Partial<OnboardingFormData> }
  | { type: 'LOAD_START' }
  | { type: 'LOAD_SUCCESS'; data: Partial<OnboardingFormData>; catalogs: Catalogs }
  | { type: 'LOAD_ERROR'; error: string }
  | { type: 'SAVE_START' }
  | { type: 'SAVE_SUCCESS' }
  | { type: 'SAVE_ERROR'; error: string };

function reducer(state: OnboardingState, action: OnboardingAction): OnboardingState {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, step: action.step, error: null };
    case 'UPDATE_DATA':
      return { ...state, data: { ...state.data, ...action.partial } };
    case 'LOAD_START':
      return { ...state, loading: true, error: null };
    case 'LOAD_SUCCESS':
      return {
        ...state,
        loading: false,
        data: { ...state.data, ...action.data },
        catalogs: action.catalogs,
      };
    case 'LOAD_ERROR':
      return { ...state, loading: false, error: action.error };
    case 'SAVE_START':
      return { ...state, saving: true, error: null };
    case 'SAVE_SUCCESS':
      return { ...state, saving: false };
    case 'SAVE_ERROR':
      return { ...state, saving: false, error: action.error };
    default:
      return state;
  }
}

const INITIAL_STATE: OnboardingState = {
  step: 0,
  data: INITIAL_DATA,
  catalogs: null,
  loading: true,
  saving: false,
  error: null,
};

/* ─── Skip logic ─── */

function shouldSkipReproductive(data: OnboardingFormData): boolean {
  return data.biological_sex !== 'female';
}

function getNextStep(currentStep: number, data: OnboardingFormData): number {
  const next = currentStep + 1;
  // Skip reproductive step (6) for non-female
  if (next === 6 && shouldSkipReproductive(data)) return 7;
  return next;
}

function getPrevStep(currentStep: number, data: OnboardingFormData): number {
  const prev = currentStep - 1;
  // Skip reproductive step (6) for non-female
  if (prev === 6 && shouldSkipReproductive(data)) return 5;
  return prev;
}

/* ─── Validation ─── */

function validateStep(step: number, data: OnboardingFormData): string | null {
  if (step === 0) {
    if (data.age == null) return 'يرجى إدخال العمر';
    if (data.biological_sex == null) return 'يرجى اختيار الجنس البيولوجي';
    if (data.governorate_id == null) return 'يرجى اختيار المحافظة';
  }
  // All other steps have no required fields
  return null;
}

/* ─── Props ─── */

interface OnboardingClientProps {
  lang: 'ar' | 'en';
}

/* ─── Main Component ─── */

export default function OnboardingClient({ lang }: OnboardingClientProps) {
  const router = useRouter();
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);

  const { step, data, catalogs, loading, saving, error } = state;

  /* ── Fetch catalogs + existing profile on mount ── */
  useEffect(() => {
    let cancelled = false;

    async function load() {
      dispatch({ type: 'LOAD_START' });
      try {
        const res = await fetch('/api/patient/onboarding');
        if (!res.ok) throw new Error('فشل تحميل البيانات');
        const json = await res.json();

        if (!cancelled) {
          dispatch({
            type: 'LOAD_SUCCESS',
            data: json.profile ?? {},
            catalogs: {
              allergyOptions: json.catalogs?.allergyOptions ?? [],
              conditionOptions: json.catalogs?.conditionOptions ?? [],
              surgeryOptions: json.catalogs?.surgeryOptions ?? [],
              familyHistoryOptions: json.catalogs?.familyHistoryOptions ?? [],
            },
          });
        }
      } catch (err) {
        if (!cancelled) {
          dispatch({
            type: 'LOAD_ERROR',
            error: err instanceof Error ? err.message : 'حدث خطأ غير متوقع',
          });
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  /* ── Navigation handlers ── */

  const handleNext = useCallback(() => {
    // On the last step, save
    if (step === TOTAL_STEPS - 1) {
      handleSave();
      return;
    }

    const validationError = validateStep(step, data);
    if (validationError) {
      dispatch({ type: 'SAVE_ERROR', error: validationError });
      return;
    }

    dispatch({ type: 'SET_STEP', step: getNextStep(step, data) });
  }, [step, data]);

  const handleBack = useCallback(() => {
    if (step === 0) return;
    dispatch({ type: 'SET_STEP', step: getPrevStep(step, data) });
  }, [step, data]);

  const handleSkip = useCallback(() => {
    dispatch({ type: 'SET_STEP', step: getNextStep(step, data) });
  }, [step, data]);

  const handleEdit = useCallback((targetStep: number) => {
    dispatch({ type: 'SET_STEP', step: targetStep });
  }, []);

  /* ── Save handler ── */

  async function handleSave() {
    dispatch({ type: 'SAVE_START' });
    try {
      const res = await fetch('/api/patient/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error ?? 'فشل حفظ البيانات');
      }

      dispatch({ type: 'SAVE_SUCCESS' });
      router.push(`/${lang}/chat`);
    } catch (err) {
      dispatch({
        type: 'SAVE_ERROR',
        error: err instanceof Error ? err.message : 'حدث خطأ غير متوقع',
      });
    }
  }

  /* ── Data update helpers for each step ── */

  function updateBasicInfo(partial: { age: number | null; biological_sex: 'male' | 'female' | null; governorate_id: string | null }) {
    dispatch({ type: 'UPDATE_DATA', partial });
  }

  function updatePhysical(partial: { height_cm: number | null; weight_kg: number | null }) {
    dispatch({ type: 'UPDATE_DATA', partial });
  }

  function updateWorkLifestyle(partial: { work_type: string | null; work_schedule: string | null; activity_level: string | null }) {
    dispatch({ type: 'UPDATE_DATA', partial });
  }

  function updateClinical(incoming: any) {
    // Normalize null → '' for string fields to match OnboardingFormData shape
    const partial: Partial<OnboardingFormData> = {};
    for (const [key, value] of Object.entries(incoming as Record<string, unknown>)) {
      (partial as Record<string, unknown>)[key] = value;
    }
    dispatch({ type: 'UPDATE_DATA', partial });
  }

  function updateMedicalHistory(partial: Pick<OnboardingFormData, 'allergies' | 'chronic_conditions' | 'medications' | 'surgeries'>) {
    dispatch({ type: 'UPDATE_DATA', partial });
  }

  function updateFamilyHistory(partial: { family_history: OnboardingFormData['family_history'] }) {
    dispatch({ type: 'UPDATE_DATA', partial });
  }

  function updateReproductive(partial: Partial<OnboardingFormData>) {
    dispatch({ type: 'UPDATE_DATA', partial });
  }

  /* ── Computed ── */

  const isFirst = step === 0;
  const isLast = step === TOTAL_STEPS - 1;
  const canSkip = step > 0 && step < TOTAL_STEPS - 1;

  /* ── Loading state ── */
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center" dir="rtl">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-teal-700" />
          <p className="text-sm text-gray-500">جاري تحميل البيانات...</p>
        </div>
      </div>
    );
  }

  /* ── Error state (load error only) ── */
  if (!catalogs) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center" dir="rtl">
        <div className="flex flex-col items-center gap-4 text-center px-6">
          <div className="text-4xl">⚠️</div>
          <p className="text-sm text-red-600">{error ?? 'فشل تحميل البيانات'}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-xl bg-teal-700 px-6 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 transition-colors"
          >
            إعادة المحاولة
          </button>
        </div>
      </div>
    );
  }

  /* ── Step display number (1-indexed for StepProgress) ── */
  const displayStep = step + 1;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-24">
        {/* Progress bar */}
        <StepProgress
          currentStep={displayStep}
          totalSteps={TOTAL_STEPS}
          stepLabels={STEP_LABELS}
        />

        {/* Error banner */}
        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" dir="rtl">
            {error}
          </div>
        )}

        {/* Step content */}
        <div className="mt-6">
          {step === 0 && (
            <StepBasicInfo
              data={{
                age: data.age,
                biological_sex: data.biological_sex,
                governorate_id: data.governorate_id,
              }}
              onChange={updateBasicInfo}
            />
          )}

          {step === 1 && (
            <StepPhysical
              data={{
                height_cm: data.height_cm,
                weight_kg: data.weight_kg,
              }}
              onChange={updatePhysical}
            />
          )}

          {step === 2 && (
            <StepWorkLifestyle
              data={{
                work_type: data.work_type,
                work_schedule: data.work_schedule,
                activity_level: data.activity_level,
              }}
              onChange={updateWorkLifestyle}
            />
          )}

          {step === 3 && (
            <StepClinicalBaseline
              data={{
                smoking_status: (data.smoking_status || null) as 'never' | 'current' | 'former' | null,
                cigarettes_per_day: data.cigarettes_per_day,
                smoking_years: data.smoking_years,
                blood_pressure: (data.blood_pressure || null) as 'none' | 'controlled' | 'uncontrolled' | 'unknown' | null,
                bp_on_medication: data.bp_on_medication ?? null,
                diabetes_type: (data.diabetes_type || null) as 'none' | 'type1' | 'type2' | 'unknown' | null,
                diabetes_control: (data.diabetes_control || null) as 'controlled' | 'uncontrolled' | 'unknown' | null,
                diabetes_treatment: (data.diabetes_treatment || null) as 'tablets' | 'insulin' | 'both' | null,
                heart_condition: (data.heart_condition || null) as 'none' | 'known' | 'unknown' | null,
                previous_heart_attack: data.previous_heart_attack ?? null,
                heart_surgery: data.heart_surgery ?? null,
                kidney_disease: (data.kidney_disease || null) as 'none' | 'known' | 'unknown' | null,
                liver_disease: (data.liver_disease || null) as 'none' | 'known' | 'unknown' | null,
              }}
              onChange={updateClinical}
            />
          )}

          {step === 4 && (
            <StepMedicalHistory
              data={{
                allergies: data.allergies,
                chronic_conditions: data.chronic_conditions,
                medications: data.medications.map((m) => ({
                  drug_name_ar: m.drug_name_ar,
                  dose: m.dose ?? '',
                  frequency_ar: m.frequency_ar ?? '',
                  for_condition_ar: m.for_condition_ar ?? '',
                })),
                surgeries: data.surgeries,
              }}
              onChange={updateMedicalHistory}
              catalogs={{
                allergyOptions: catalogs.allergyOptions,
                conditionOptions: catalogs.conditionOptions,
                surgeryOptions: catalogs.surgeryOptions,
              }}
            />
          )}

          {step === 5 && (
            <StepFamilyHistory
              data={{ family_history: data.family_history }}
              onChange={updateFamilyHistory}
              familyHistoryOptions={catalogs.familyHistoryOptions}
            />
          )}

          {step === 6 && (
            <StepReproductiveHealth
              data={{
                pregnancy_status: (data.pregnancy_status ?? undefined) as 'not_pregnant' | 'pregnant' | 'breastfeeding' | 'trying_to_conceive' | undefined,
                previous_pregnancies: data.previous_pregnancies,
                menstrual_regularity: (data.menstrual_regularity ?? undefined) as 'regular' | 'irregular' | 'absent' | undefined,
                menopause_status: (data.menopause_status ?? undefined) as 'pre_menopause' | 'peri_menopause' | 'post_menopause' | 'not_applicable' | undefined,
              }}
              onChange={updateReproductive}
            />
          )}

          {step === 7 && (
            <StepReview
              data={data}
              onEdit={handleEdit}
              catalogs={catalogs}
            />
          )}
        </div>
      </div>

      {/* Fixed bottom navigation */}
      <StepNavigation
        onBack={isFirst ? null : handleBack}
        onNext={handleNext}
        onSkip={canSkip ? handleSkip : null}
        isFirst={isFirst}
        isLast={isLast}
        nextLabel={saving ? 'جاري الحفظ...' : isLast ? 'حفظ وابدأ' : undefined}
      />
    </div>
  );
}
