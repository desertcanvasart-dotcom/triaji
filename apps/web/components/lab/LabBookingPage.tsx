'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { t, type Lang } from '@triaji/shared/i18n/strings';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ChainSlot {
  slotId: string;
  date: string;
  time: string;
  branchId?: string;
  branchName?: string;
  branchNameAr?: string;
  branchNameEn?: string;
  branchAddress?: string;
  homeCollection?: boolean;
  distance_km?: number;
}

interface ChainInfo {
  code: string;
  name_ar: string;
  name_en: string;
  has_api: boolean;
}

interface LabBookingPageProps {
  labSlug: string;
  lang: Lang;
  chainInfo?: ChainInfo | null;
  testCodes?: string[];
  orderId?: string;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function LabBookingPage({
  labSlug,
  lang,
  chainInfo,
  testCodes = [],
  orderId,
}: LabBookingPageProps) {
  const router = useRouter();
  const isRtl = lang === 'ar';

  // State
  const [step, setStep] = useState<'slots' | 'form' | 'success'>('slots');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Slots state
  const [apiAvailable, setApiAvailable] = useState<boolean | null>(null);
  const [slots, setSlots] = useState<ChainSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<ChainSlot | null>(null);

  // Generic picker state (when API unavailable)
  const [genericDate, setGenericDate] = useState('');
  const [genericTime, setGenericTime] = useState('');

  // Patient form
  const [patientName, setPatientName] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [patientDOB, setPatientDOB] = useState('');
  const [patientSex, setPatientSex] = useState<'male' | 'female' | ''>('');

  // Booking result
  const [confirmationCode, setConfirmationCode] = useState('');
  const [bookedBranch, setBookedBranch] = useState('');

  // ─── Fetch slots if chain has API ──────────────────────────────────────

  const fetchSlots = useCallback(async () => {
    if (!chainInfo?.code) {
      setApiAvailable(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Try to get user's location for distance
      let lat: number | undefined;
      let lng: number | undefined;

      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
        });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch {
        // Location not available — proceed without distance
      }

      const params = new URLSearchParams();
      if (testCodes.length > 0) params.set('test_codes', testCodes.join(','));
      if (lat !== undefined) params.set('lat', String(lat));
      if (lng !== undefined) params.set('lng', String(lng));

      const today = new Date().toISOString().split('T')[0];
      params.set('preferred_date', today!);

      const res = await fetch(`/api/lab/chains/${chainInfo.code}/slots?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        setApiAvailable(false);
        return;
      }

      if (data.apiAvailable === false) {
        setApiAvailable(false);
        return;
      }

      setApiAvailable(true);
      setSlots(data.slots ?? []);
    } catch {
      setApiAvailable(false);
    } finally {
      setLoading(false);
    }
  }, [chainInfo, testCodes]);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  // ─── Group slots by branch ────────────────────────────────────────────

  const slotsByBranch: Record<string, ChainSlot[]> = {};
  for (const slot of slots) {
    const branchKey = slot.branchId ?? slot.branchName ?? 'default';
    if (!slotsByBranch[branchKey]) slotsByBranch[branchKey] = [];
    slotsByBranch[branchKey]!.push(slot);
  }

  // ─── Handle booking ──────────────────────────────────────────────────

  const handleBooking = async () => {
    if (!chainInfo?.code) return;
    setSubmitting(true);
    setError(null);

    try {
      if (apiAvailable && selectedSlot) {
        // Book via chain API
        const res = await fetch(`/api/lab/chains/${chainInfo.code}/book`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId,
            slotId: selectedSlot.slotId,
            patientName,
            patientPhone,
            patientDOB: patientDOB || undefined,
            patientSex: patientSex || undefined,
            testCodes,
            lang,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error ?? t('labChain.bookingFailed', lang));
        }

        setConfirmationCode(data.confirmationCode ?? data.bookingId ?? '');
        setBookedBranch(data.branchName ?? '');
        setStep('success');
      } else {
        // Generic booking — create manual appointment
        const res = await fetch('/api/lab/route-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lab_tenant_id: labSlug,
            patient_name_ar: patientName,
            patient_phone: patientPhone,
            booking_type: 'scheduled',
            appointment_datetime: genericDate && genericTime
              ? `${genericDate}T${genericTime}:00`
              : null,
          }),
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error ?? t('labChain.bookingFailed', lang));
        }

        setStep('success');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('labChain.bookingFailed', lang));
    } finally {
      setSubmitting(false);
    }
  };

  const chainName = chainInfo
    ? (lang === 'ar' ? chainInfo.name_ar : chainInfo.name_en)
    : '';

  // ─── Render ───────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-500 mt-3">{t('common.loading', lang)}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Header */}
      <header className="bg-teal-700 text-white py-6 px-4">
        <div className="max-w-3xl mx-auto">
          <button
            onClick={() => router.back()}
            className="text-teal-200 hover:text-white text-sm mb-2"
          >
            {isRtl ? '←' : '→'} {t('common.back', lang)}
          </button>
          <h1 className="text-xl font-bold">
            {chainName
              ? `${t('labChain.confirmBooking', lang)} — ${chainName}`
              : t('labChain.confirmBooking', lang)}
          </h1>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* ─── Slots Step ─────────────────────────────────────────────── */}
        {step === 'slots' && (
          <div className="space-y-4">
            {apiAvailable === true && slots.length > 0 ? (
              <>
                <h2 className="text-lg font-semibold text-gray-900">
                  {t('labChain.realTimeSlots', lang)}
                </h2>

                {Object.entries(slotsByBranch).map(([branchKey, branchSlots]) => {
                  const firstSlot = branchSlots[0]!;
                  const branchDisplayName = lang === 'ar'
                    ? (firstSlot.branchNameAr ?? firstSlot.branchName ?? branchKey)
                    : (firstSlot.branchNameEn ?? firstSlot.branchName ?? branchKey);

                  return (
                    <div key={branchKey} className="bg-white rounded-xl shadow-sm overflow-hidden">
                      {/* Branch header */}
                      <div className="bg-gray-50 px-5 py-3 border-b border-gray-100">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-medium text-gray-800">
                              {branchDisplayName}
                            </h3>
                            {firstSlot.branchAddress && (
                              <p className="text-xs text-gray-500 mt-0.5">{firstSlot.branchAddress}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {firstSlot.distance_km !== undefined && (
                              <span className="text-xs text-gray-500">
                                {firstSlot.distance_km.toFixed(1)} {t('labChain.distanceKm', lang)}
                              </span>
                            )}
                            {firstSlot.homeCollection && (
                              <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">
                                {t('labChain.homeCollection', lang)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Slots */}
                      <div className="p-4 flex flex-wrap gap-2">
                        {branchSlots.map((slot) => (
                          <button
                            key={slot.slotId}
                            onClick={() => {
                              setSelectedSlot(slot);
                              setStep('form');
                            }}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
                              selectedSlot?.slotId === slot.slotId
                                ? 'bg-teal-600 text-white border-teal-600'
                                : 'bg-white text-gray-700 border-gray-200 hover:border-teal-400 hover:text-teal-700'
                            }`}
                          >
                            {slot.time}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </>
            ) : (
              /* ─── Generic time picker fallback ─────────────────────── */
              <div className="space-y-4">
                <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
                  <h2 className="text-lg font-semibold text-gray-900">
                    {t('labChain.genericTimePicker', lang)}
                  </h2>

                  {/* Notice: API unavailable */}
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="text-sm text-amber-800">
                      {t('labChain.labWillContact', lang)}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('labChain.selectDate', lang)}
                    </label>
                    <input
                      type="date"
                      value={genericDate}
                      onChange={(e) => setGenericDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('labChain.selectTime', lang)}
                    </label>
                    <input
                      type="time"
                      value={genericTime}
                      onChange={(e) => setGenericTime(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>

                <button
                  onClick={() => setStep('form')}
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 rounded-xl transition-colors"
                >
                  {t('common.confirm', lang)}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ─── Patient Form Step ──────────────────────────────────────── */}
        {step === 'form' && (
          <div className="space-y-4">
            {/* Selected slot summary */}
            {selectedSlot && (
              <div className="bg-teal-50 rounded-xl p-4">
                <p className="text-sm font-medium text-teal-900">
                  {t('labChain.slotAt', lang)}: {selectedSlot.time} — {selectedSlot.date}
                </p>
                {(lang === 'ar' ? selectedSlot.branchNameAr : selectedSlot.branchNameEn) && (
                  <p className="text-xs text-teal-700 mt-1">
                    {lang === 'ar' ? selectedSlot.branchNameAr : selectedSlot.branchNameEn}
                  </p>
                )}
              </div>
            )}

            <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('labChain.patientName', lang)}
                </label>
                <input
                  type="text"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('labChain.patientPhone', lang)}
                </label>
                <input
                  type="tel"
                  value={patientPhone}
                  onChange={(e) => setPatientPhone(e.target.value)}
                  placeholder="01xxxxxxxxx"
                  dir="ltr"
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('labChain.selectDate', lang)} ({t('common.cancel', lang).charAt(0) === 'إ' ? 'اختياري' : 'Optional'})
                </label>
                <input
                  type="date"
                  value={patientDOB}
                  onChange={(e) => setPatientDOB(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {lang === 'ar' ? 'النوع (اختياري)' : 'Sex (optional)'}
                </label>
                <select
                  value={patientSex}
                  onChange={(e) => setPatientSex(e.target.value as 'male' | 'female' | '')}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">—</option>
                  <option value="male">{lang === 'ar' ? 'ذكر' : 'Male'}</option>
                  <option value="female">{lang === 'ar' ? 'أنثى' : 'Female'}</option>
                </select>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 text-red-700 text-sm p-3 rounded-xl">{error}</div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep('slots')}
                className="flex-1 border border-gray-300 text-gray-700 font-medium py-3 rounded-xl hover:bg-gray-50 transition-colors"
              >
                {t('common.back', lang)}
              </button>
              <button
                onClick={handleBooking}
                disabled={submitting || !patientName || !patientPhone}
                className="flex-1 bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {t('common.loading', lang)}
                  </span>
                ) : (
                  t('labChain.confirmBooking', lang)
                )}
              </button>
            </div>
          </div>
        )}

        {/* ─── Success Step ───────────────────────────────────────────── */}
        {step === 'success' && (
          <div className="bg-white rounded-xl p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <span className="text-3xl text-green-600">&#10003;</span>
            </div>
            <h2 className="text-xl font-bold text-gray-900">
              {t('labChain.bookingSuccess', lang)}
            </h2>

            {confirmationCode && (
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">{t('labChain.chainOrderRef', lang)}</p>
                <p className="text-lg font-mono font-bold text-teal-700 mt-1">{confirmationCode}</p>
              </div>
            )}

            {bookedBranch && (
              <p className="text-sm text-gray-600">{bookedBranch}</p>
            )}

            {!apiAvailable && (
              <p className="text-sm text-amber-700 bg-amber-50 rounded-lg p-3">
                {t('labChain.labWillContact', lang)}
              </p>
            )}

            <button
              onClick={() => router.push(`/${lang}/lab/${labSlug}`)}
              className="mt-4 text-teal-600 hover:underline text-sm"
            >
              {t('common.back', lang)}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
