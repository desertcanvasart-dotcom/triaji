'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { t, type Lang } from '@triaji/shared/i18n';
import type { GuardianRelation } from '@triaji/shared/types/paediatric';

interface AddChildFormProps {
  lang: Lang;
}

type VaccinationOption = 'fully_vaccinated' | 'unknown' | 'enter_later';

const RELATION_OPTIONS: GuardianRelation[] = [
  'mother', 'father', 'grandmother', 'grandfather', 'sibling', 'legal_guardian', 'other',
];

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function AddChildForm({ lang }: AddChildFormProps) {
  const router = useRouter();
  const isRtl = lang === 'ar';

  // Step tracking
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Basic info
  const [name, setName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [sex, setSex] = useState<'male' | 'female' | ''>('');
  const [relation, setRelation] = useState<GuardianRelation | ''>('');

  // Step 2: Optional medical
  const [bloodType, setBloodType] = useState('');
  const [gestationalAge, setGestationalAge] = useState<number | ''>('');
  const [birthWeight, setBirthWeight] = useState<number | ''>('');
  const [hasAllergies, setHasAllergies] = useState(false);
  const [hasChronicConditions, setHasChronicConditions] = useState(false);

  // Step 3: Vaccination history
  const [vaccinationOption, setVaccinationOption] = useState<VaccinationOption>('fully_vaccinated');

  const canProceedStep1 = name.trim() && dateOfBirth && sex && relation;

  const relationLabel = (r: GuardianRelation): string => {
    const keyMap: Record<GuardianRelation, string> = {
      mother: 'paediatric.mother',
      father: 'paediatric.father',
      grandmother: 'paediatric.grandmother',
      grandfather: 'paediatric.grandfather',
      sibling: 'paediatric.sibling',
      legal_guardian: 'paediatric.guardian',
      other: 'paediatric.guardian',
    };
    return t(keyMap[r], lang);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/patient/children', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          dateOfBirth,
          sex,
          relation,
          bloodType: bloodType || undefined,
          gestationalAgeWeeks: gestationalAge || undefined,
          birthWeightGrams: birthWeight || undefined,
          allergies: hasAllergies ? [] : undefined,
          chronicConditions: hasChronicConditions ? [] : undefined,
          vaccinationOption,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? t('common.error', lang));
        setSubmitting(false);
        return;
      }

      // Set active child and navigate to medical record
      document.cookie = `active_child_id=${data.childPatientId}; path=/; max-age=${60 * 60 * 24 * 365}`;
      router.push(`/${lang}/medical-record`);
    } catch {
      setError(t('common.error', lang));
      setSubmitting(false);
    }
  };

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="mx-auto max-w-lg px-4 py-6">
      {/* Header */}
      <h1 className="mb-6 text-2xl font-bold text-gray-900">
        {t('paediatric.addChild', lang)}
      </h1>

      {/* Step indicator */}
      <div className="mb-8 flex items-center justify-center gap-2">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                s === step
                  ? 'bg-teal-600 text-white'
                  : s < step
                    ? 'bg-teal-100 text-teal-700'
                    : 'bg-gray-100 text-gray-400'
              }`}
            >
              {s < step ? '\u2713' : s}
            </div>
            {s < 3 && (
              <div className={`h-0.5 w-8 ${s < step ? 'bg-teal-400' : 'bg-gray-200'}`} />
            )}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit}>
        {/* ─── Step 1: Basic info ─── */}
        {step === 1 && (
          <div className="space-y-5">
            {/* Name */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t('paediatric.childName', lang)}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                required
              />
            </div>

            {/* Date of Birth */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t('paediatric.dateOfBirth', lang)}
              </label>
              <input
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                required
              />
            </div>

            {/* Sex - pill buttons */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                {lang === 'ar' ? 'الجنس' : 'Sex'}
              </label>
              <div className="flex gap-3">
                {(['male', 'female'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSex(s)}
                    className={`flex-1 rounded-full py-3 text-sm font-medium transition-colors ${
                      sex === s
                        ? 'bg-teal-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {s === 'male'
                      ? (lang === 'ar' ? 'ذكر' : 'Male')
                      : (lang === 'ar' ? 'أنثى' : 'Female')}
                  </button>
                ))}
              </div>
            </div>

            {/* Relation */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t('paediatric.relation', lang)}
              </label>
              <select
                value={relation}
                onChange={(e) => setRelation(e.target.value as GuardianRelation)}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                required
              >
                <option value="">{lang === 'ar' ? 'اختر...' : 'Select...'}</option>
                {RELATION_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {relationLabel(r)}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={!canProceedStep1}
              className="w-full rounded-lg bg-teal-600 py-3 text-white font-semibold disabled:opacity-50 hover:bg-teal-700 transition-colors"
            >
              {lang === 'ar' ? 'التالي' : 'Next'}
            </button>
          </div>
        )}

        {/* ─── Step 2: Optional medical info ─── */}
        {step === 2 && (
          <div className="space-y-5">
            {/* Blood type */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t('paediatric.bloodType', lang)}
                <span className="mx-1 text-xs text-gray-400">
                  ({lang === 'ar' ? 'اختياري' : 'optional'})
                </span>
              </label>
              <select
                value={bloodType}
                onChange={(e) => setBloodType(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
              >
                <option value="">{lang === 'ar' ? 'غير محدد' : 'Not specified'}</option>
                {BLOOD_TYPES.map((bt) => (
                  <option key={bt} value={bt}>{bt}</option>
                ))}
              </select>
            </div>

            {/* Gestational age */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t('paediatric.gestationalAge', lang)}
                <span className="mx-1 text-xs text-gray-400">
                  ({lang === 'ar' ? 'اختياري' : 'optional'})
                </span>
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setGestationalAge((prev) => Math.max(24, (prev || 40) - 1))}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-lg font-bold text-gray-600 hover:bg-gray-200"
                >
                  -
                </button>
                <input
                  type="number"
                  value={gestationalAge}
                  onChange={(e) => setGestationalAge(e.target.value ? Number(e.target.value) : '')}
                  placeholder="40"
                  min={24}
                  max={44}
                  className="w-20 rounded-lg border border-gray-300 px-3 py-2 text-center text-gray-900 focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                />
                <button
                  type="button"
                  onClick={() => setGestationalAge((prev) => Math.min(44, (prev || 40) + 1))}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-lg font-bold text-gray-600 hover:bg-gray-200"
                >
                  +
                </button>
                <span className="text-sm text-gray-500">
                  {lang === 'ar' ? 'أسبوع' : 'weeks'}
                </span>
              </div>
            </div>

            {/* Birth weight */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t('paediatric.birthWeight', lang)}
                <span className="mx-1 text-xs text-gray-400">
                  ({lang === 'ar' ? 'اختياري' : 'optional'})
                </span>
              </label>
              <input
                type="number"
                value={birthWeight}
                onChange={(e) => setBirthWeight(e.target.value ? Number(e.target.value) : '')}
                placeholder={lang === 'ar' ? 'مثال: 3200' : 'e.g. 3200'}
                min={500}
                max={6000}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
              />
            </div>

            {/* Allergies toggle */}
            <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
              <span className="text-sm font-medium text-gray-700">
                {lang === 'ar' ? 'لديه حساسية معروفة' : 'Has known allergies'}
              </span>
              <button
                type="button"
                onClick={() => setHasAllergies(!hasAllergies)}
                className={`relative h-6 w-11 rounded-full transition-colors ${
                  hasAllergies ? 'bg-teal-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    hasAllergies
                      ? (isRtl ? '-translate-x-5' : 'translate-x-5')
                      : (isRtl ? '-translate-x-0.5' : 'translate-x-0.5')
                  }`}
                />
              </button>
            </div>

            {/* Chronic conditions toggle */}
            <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
              <span className="text-sm font-medium text-gray-700">
                {lang === 'ar' ? 'لديه أمراض مزمنة' : 'Has chronic conditions'}
              </span>
              <button
                type="button"
                onClick={() => setHasChronicConditions(!hasChronicConditions)}
                className={`relative h-6 w-11 rounded-full transition-colors ${
                  hasChronicConditions ? 'bg-teal-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    hasChronicConditions
                      ? (isRtl ? '-translate-x-5' : 'translate-x-5')
                      : (isRtl ? '-translate-x-0.5' : 'translate-x-0.5')
                  }`}
                />
              </button>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 rounded-lg border border-gray-300 py-3 font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                {t('common.back', lang)}
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="flex-1 rounded-lg bg-teal-600 py-3 text-white font-semibold hover:bg-teal-700 transition-colors"
              >
                {lang === 'ar' ? 'التالي' : 'Next'}
              </button>
            </div>
          </div>
        )}

        {/* ─── Step 3: Vaccination history ─── */}
        {step === 3 && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-gray-900">
              {t('paediatric.vaccines', lang)}
            </h2>
            <p className="text-sm text-gray-500">
              {lang === 'ar'
                ? 'هل الطفل اتطعم التطعيمات المصرية كلها؟'
                : 'Has the child received all Egyptian vaccinations?'}
            </p>

            <div className="space-y-3">
              {/* Fully vaccinated */}
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
                  vaccinationOption === 'fully_vaccinated'
                    ? 'border-teal-500 bg-teal-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="vaccinationOption"
                  value="fully_vaccinated"
                  checked={vaccinationOption === 'fully_vaccinated'}
                  onChange={(e) => setVaccinationOption(e.target.value as VaccinationOption)}
                  className="mt-1 h-4 w-4 text-teal-600 focus:ring-teal-500"
                />
                <div>
                  <div className="font-medium text-gray-900">
                    {t('paediatric.fullyVaccinated', lang)}
                  </div>
                </div>
              </label>

              {/* Unknown */}
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
                  vaccinationOption === 'unknown'
                    ? 'border-teal-500 bg-teal-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="vaccinationOption"
                  value="unknown"
                  checked={vaccinationOption === 'unknown'}
                  onChange={(e) => setVaccinationOption(e.target.value as VaccinationOption)}
                  className="mt-1 h-4 w-4 text-teal-600 focus:ring-teal-500"
                />
                <div>
                  <div className="font-medium text-gray-900">
                    {t('paediatric.unknownHistory', lang)}
                  </div>
                </div>
              </label>

              {/* Enter later */}
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
                  vaccinationOption === 'enter_later'
                    ? 'border-teal-500 bg-teal-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="vaccinationOption"
                  value="enter_later"
                  checked={vaccinationOption === 'enter_later'}
                  onChange={(e) => setVaccinationOption(e.target.value as VaccinationOption)}
                  className="mt-1 h-4 w-4 text-teal-600 focus:ring-teal-500"
                />
                <div>
                  <div className="font-medium text-gray-900">
                    {t('paediatric.enterLater', lang)}
                  </div>
                </div>
              </label>
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="flex-1 rounded-lg border border-gray-300 py-3 font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                {t('common.back', lang)}
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 rounded-lg bg-teal-600 py-3 text-white font-semibold disabled:opacity-50 hover:bg-teal-700 transition-colors"
              >
                {submitting
                  ? t('common.loading', lang)
                  : t('common.save', lang)}
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
