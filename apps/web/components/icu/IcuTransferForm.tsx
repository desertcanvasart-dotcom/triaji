'use client';

import { useState } from 'react';
import { t, type Lang } from '@triaji/shared/i18n/strings';
import type { IcuSearchResult } from '@triaji/shared/types/icu';

// ─── Props ──────────────────────────────────────────────────────────────────

interface Props {
  lang: Lang;
  unit: IcuSearchResult;
  onClose: () => void;
  onSubmitted: (id: string) => void;
}

export default function IcuTransferForm({ lang, unit, onClose, onSubmitted }: Props) {
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  // ── Form state ──────────────────────────────────────────────────────
  const [patientName, setPatientName] = useState('');
  const [patientAge, setPatientAge] = useState<number | ''>('');
  const [patientSex, setPatientSex] = useState<'male' | 'female' | ''>('');
  const [familyPhone, setFamilyPhone] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [clinicalSummary, setClinicalSummary] = useState('');
  const [urgency, setUrgency] = useState<'urgent' | 'emergency'>('urgent');
  const [currentLocation, setCurrentLocation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hospitalName =
    lang === 'ar'
      ? unit.hospital_name_ar
      : unit.hospital_name_en || unit.hospital_name_ar;

  const unitName =
    lang === 'ar'
      ? unit.unit_name_ar
      : unit.unit_name_en || unit.unit_name_ar;

  // ── Submit ──────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      // Also try to get current geolocation for ETA
      let currentLat: number | undefined;
      let currentLng: number | undefined;

      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
        });
        currentLat = pos.coords.latitude;
        currentLng = pos.coords.longitude;
      } catch {
        // silently ignore — location not required
      }

      const body: Record<string, unknown> = {
        icu_unit_id: unit.icu_unit_id,
        patient_name_ar: patientName,
        diagnosis_ar: diagnosis,
        clinical_summary_ar: clinicalSummary,
        urgency,
        current_location_ar: currentLocation,
      };

      if (patientAge !== '') body.patient_age = patientAge;
      if (patientSex) body.patient_sex = patientSex;
      if (familyPhone) body.patient_phone = familyPhone;
      if (currentLat !== undefined) body.current_location_lat = currentLat;
      if (currentLng !== undefined) body.current_location_lng = currentLng;

      const res = await fetch('/api/icu/transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${document.cookie.match(/sb-access-token=([^;]+)/)?.[1] || ''}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Transfer request failed');
      }

      const data = await res.json();
      onSubmitted(data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transfer request failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
      <div
        dir={dir}
        className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto"
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-5 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {t('icu.transferRequest', lang)}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {hospitalName} — {unitName}
            </p>
            <p className="text-xs text-green-600 mt-0.5">
              {unit.available_beds}{' '}
              {unit.available_beds === 1
                ? t('icu.bedsAvailable', lang)
                : t('icu.bedsAvailablePlural', lang)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* ── Form ────────────────────────────────────────────────────── */}
        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Patient info section */}
          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold text-gray-700 mb-2">
              {lang === 'ar' ? 'بيانات المريض' : 'Patient information'}
            </legend>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('icu.patientName', lang)} *
              </label>
              <input
                type="text"
                required
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                dir={dir}
              />
            </div>

            {/* Age + Sex row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('icu.patientAge', lang)}
                </label>
                <input
                  type="number"
                  min={0}
                  max={120}
                  value={patientAge}
                  onChange={(e) =>
                    setPatientAge(e.target.value ? parseInt(e.target.value) : '')
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('icu.patientSex', lang)}
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPatientSex('male')}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      patientSex === 'male'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {t('icu.male', lang)}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPatientSex('female')}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      patientSex === 'female'
                        ? 'bg-pink-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {t('icu.female', lang)}
                  </button>
                </div>
              </div>
            </div>

            {/* Family phone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('icu.familyPhone', lang)}
              </label>
              <input
                type="tel"
                value={familyPhone}
                onChange={(e) => setFamilyPhone(e.target.value)}
                placeholder="01XXXXXXXXX"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                dir="ltr"
              />
            </div>
          </fieldset>

          {/* Clinical section */}
          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold text-gray-700 mb-2">
              {lang === 'ar' ? 'البيانات السريرية' : 'Clinical information'}
            </legend>

            {/* Diagnosis */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('icu.diagnosis', lang)} *
              </label>
              <input
                type="text"
                required
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                dir={dir}
              />
            </div>

            {/* Clinical summary */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('icu.clinicalSummary', lang)} *
              </label>
              <textarea
                required
                rows={3}
                value={clinicalSummary}
                onChange={(e) => setClinicalSummary(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                dir={dir}
              />
            </div>

            {/* Urgency */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {lang === 'ar' ? 'درجة الاستعجال' : 'Urgency level'}
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setUrgency('urgent')}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    urgency === 'urgent'
                      ? 'bg-yellow-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {t('icu.urgentTransfer', lang)}
                </button>
                <button
                  type="button"
                  onClick={() => setUrgency('emergency')}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    urgency === 'emergency'
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {t('icu.emergencyTransfer', lang)}
                </button>
              </div>
            </div>

            {/* Emergency callout */}
            {urgency === 'emergency' && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                <span className="text-red-500 text-lg">⚠️</span>
                <div>
                  <p className="text-sm text-red-700 font-medium">
                    {t('icu.callDirectFirst', lang)}
                  </p>
                  {unit.phone_direct && (
                    <a
                      href={`tel:${unit.phone_direct}`}
                      className="text-sm text-red-600 underline mt-1 inline-block"
                    >
                      📞 {unit.phone_direct}
                    </a>
                  )}
                </div>
              </div>
            )}
          </fieldset>

          {/* Current location */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('icu.currentLocation', lang)} *
            </label>
            <input
              type="text"
              required
              value={currentLocation}
              onChange={(e) => setCurrentLocation(e.target.value)}
              placeholder={
                lang === 'ar'
                  ? 'مثال: مستشفى القصر العيني — قسم الطوارئ'
                  : 'e.g. Qasr El Ainy Hospital — ER'
              }
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              dir={dir}
            />
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-base hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {submitting
              ? t('common.loading', lang)
              : t('icu.sendTransferRequest', lang)}
          </button>
        </form>
      </div>
    </div>
  );
}
