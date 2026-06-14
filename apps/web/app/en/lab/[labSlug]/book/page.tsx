'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

// ─── Types ──────────────────────────────────────────────────────────────────

interface LabService {
  id: string;
  code: string;
  name_en: string;
  category_ar: string;
  price_egp: number;
  fasting_required: boolean;
  requires_appointment: boolean;
}

interface LabInfo {
  id: string;
  name_en: string;
  slug: string;
  tier: string;
  accepts_walk_ins: boolean;
  home_collection: boolean;
  home_collection_fee_egp: number | null;
}

type BookingType = 'walk_in' | 'scheduled' | 'home_collection';

// ─── English Self-Referral Booking ──────────────────────────────────────────

export default function LabSelfBookPage() {
  const params = useParams();
  const router = useRouter();
  const labSlug = params.labSlug as string;

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [labInfo, setLabInfo] = useState<LabInfo | null>(null);
  const [services, setServices] = useState<LabService[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedServiceIds, setSelectedServiceIds] = useState<Set<string>>(new Set());
  const [bookingType, setBookingType] = useState<BookingType>('walk_in');
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentTime, setAppointmentTime] = useState('');
  const [patientName, setPatientName] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [collectionAddress, setCollectionAddress] = useState('');

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/lab/nearby`);
        const data = await res.json();
        const lab = (data.labs ?? []).find((l: { slug: string }) => l.slug === labSlug);
        if (!lab) {
          setError('Lab not found');
          setLoading(false);
          return;
        }

        const config = Array.isArray(lab.tenant_config)
          ? lab.tenant_config[0]
          : lab.tenant_config;

        setLabInfo({
          id: lab.id,
          name_en: lab.name_en,
          slug: lab.slug,
          tier: lab.tier,
          accepts_walk_ins: config?.accepts_walk_ins ?? true,
          home_collection: config?.home_collection ?? false,
          home_collection_fee_egp: config?.home_collection_fee_egp ?? null,
        });
      } catch {
        setError('Failed to load data');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [labSlug]);

  const toggleService = (id: string) => {
    setSelectedServiceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedServices = services.filter((s) => selectedServiceIds.has(s.id));
  const totalPrice = selectedServices.reduce((sum, s) => sum + s.price_egp, 0);
  const hasFasting = selectedServices.some((s) => s.fasting_required);

  const filteredServices = services.filter(
    (s) => s.name_en.toLowerCase().includes(searchQuery.toLowerCase()) || s.category_ar.includes(searchQuery)
  );

  const handleSubmit = async () => {
    if (!labInfo) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/lab/route-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lab_tenant_id: labInfo.id,
          patient_name_ar: patientName,
          patient_phone: patientPhone,
          booking_type: bookingType,
          appointment_datetime: bookingType === 'scheduled'
            ? `${appointmentDate}T${appointmentTime}:00`
            : null,
          is_home_collection: bookingType === 'home_collection',
          collection_address_ar: bookingType === 'home_collection' ? collectionAddress : null,
          selected_service_ids: Array.from(selectedServiceIds),
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error ?? 'Booking failed');
      }

      setStep(4);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center" dir="ltr">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-500 mt-3">Loading...</p>
        </div>
      </div>
    );
  }

  if (error && !labInfo) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center" dir="ltr">
        <div className="text-center">
          <p className="text-red-600 text-lg">{error}</p>
          <button onClick={() => router.back()} className="mt-4 text-teal-600 hover:underline">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" dir="ltr">
      {/* Header */}
      <header className="bg-teal-700 text-white py-6 px-4">
        <div className="max-w-3xl mx-auto">
          <button onClick={() => router.back()} className="text-teal-200 hover:text-white text-sm mb-2">
            ← Back
          </button>
          <h1 className="text-xl font-bold">Book Appointment — {labInfo?.name_en}</h1>
        </div>
      </header>

      {/* Progress */}
      <div className="max-w-3xl mx-auto px-4 py-4">
        <div className="flex items-center gap-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                step >= s ? 'bg-teal-600 text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                {step > s ? '✓' : s}
              </div>
              {s < 3 && (
                <div className={`flex-1 h-0.5 ${step > s ? 'bg-teal-600' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-2 text-xs text-gray-500">
          <span>Select Tests</span>
          <span>Booking Type</span>
          <span>Your Info</span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 pb-8">
        {/* Step 1: Select Tests */}
        {step === 1 && (
          <div className="space-y-4">
            {services.length > 0 ? (
              <>
                <input
                  type="text"
                  placeholder="Search for a test..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />

                <div className="space-y-2">
                  {filteredServices.map((svc) => (
                    <label
                      key={svc.id}
                      className={`flex items-center gap-3 bg-white rounded-xl p-4 cursor-pointer border-2 transition-colors ${
                        selectedServiceIds.has(svc.id) ? 'border-teal-500 bg-teal-50' : 'border-transparent'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedServiceIds.has(svc.id)}
                        onChange={() => toggleService(svc.id)}
                        className="w-5 h-5 text-teal-600 rounded"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{svc.name_en}</p>
                      </div>
                      <span className="text-sm font-semibold text-teal-700">EGP {svc.price_egp}</span>
                    </label>
                  ))}
                </div>

                {selectedServiceIds.size > 0 && (
                  <div className="bg-teal-50 rounded-xl p-4">
                    <p className="text-sm text-teal-800">
                      {selectedServiceIds.size} tests selected — Total: <strong>EGP {totalPrice}</strong>
                    </p>
                    {hasFasting && (
                      <p className="text-xs text-red-600 mt-1">
                        ⚠️ Some tests require fasting (8-12 hours)
                      </p>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="bg-white rounded-xl p-6 text-center">
                <p className="text-gray-500 text-sm">
                  You can book directly and specify tests upon arrival
                </p>
              </div>
            )}

            <button
              onClick={() => setStep(2)}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              Next
            </button>
          </div>
        )}

        {/* Step 2: Booking Type */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Choose Booking Type</h2>

            {labInfo?.accepts_walk_ins && (
              <label className={`block bg-white rounded-xl p-5 cursor-pointer border-2 transition-colors ${
                bookingType === 'walk_in' ? 'border-teal-500' : 'border-transparent'
              }`}>
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="bookingType"
                    checked={bookingType === 'walk_in'}
                    onChange={() => setBookingType('walk_in')}
                    className="w-5 h-5 text-teal-600"
                  />
                  <div>
                    <p className="font-medium text-gray-900">🚶 Walk-in</p>
                    <p className="text-xs text-gray-500 mt-1">Visit the lab during working hours</p>
                  </div>
                </div>
              </label>
            )}

            <label className={`block bg-white rounded-xl p-5 cursor-pointer border-2 transition-colors ${
              bookingType === 'scheduled' ? 'border-teal-500' : 'border-transparent'
            }`}>
              <div className="flex items-center gap-3">
                <input
                  type="radio"
                  name="bookingType"
                  checked={bookingType === 'scheduled'}
                  onChange={() => setBookingType('scheduled')}
                  className="w-5 h-5 text-teal-600"
                />
                <div>
                  <p className="font-medium text-gray-900">📅 Scheduled Appointment</p>
                  <p className="text-xs text-gray-500 mt-1">Book a convenient time slot</p>
                </div>
              </div>
            </label>

            {bookingType === 'scheduled' && (
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Date</label>
                  <input
                    type="date"
                    value={appointmentDate}
                    onChange={(e) => setAppointmentDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Time</label>
                  <input
                    type="time"
                    value={appointmentTime}
                    onChange={(e) => setAppointmentTime(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>
            )}

            {labInfo?.home_collection && (
              <label className={`block bg-white rounded-xl p-5 cursor-pointer border-2 transition-colors ${
                bookingType === 'home_collection' ? 'border-teal-500' : 'border-transparent'
              }`}>
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="bookingType"
                    checked={bookingType === 'home_collection'}
                    onChange={() => setBookingType('home_collection')}
                    className="w-5 h-5 text-teal-600"
                  />
                  <div>
                    <p className="font-medium text-gray-900">🏠 Home Collection</p>
                    <p className="text-xs text-gray-500 mt-1">
                      A technician visits your home
                      {labInfo.home_collection_fee_egp && (
                        <span className="text-amber-600"> (+EGP {labInfo.home_collection_fee_egp})</span>
                      )}
                    </p>
                  </div>
                </div>
              </label>
            )}

            {bookingType === 'home_collection' && (
              <div className="bg-gray-50 rounded-xl p-4">
                <label className="block text-sm text-gray-600 mb-1">Address</label>
                <textarea
                  value={collectionAddress}
                  onChange={(e) => setCollectionAddress(e.target.value)}
                  placeholder="Enter your full address..."
                  rows={3}
                  className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none"
                />
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="flex-1 border border-gray-300 text-gray-700 font-medium py-3 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                className="flex-1 bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 rounded-xl transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Patient Info */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Your Information</h2>

            <div className="bg-white rounded-xl p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  placeholder="Enter your full name"
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={patientPhone}
                  onChange={(e) => setPatientPhone(e.target.value)}
                  placeholder="01xxxxxxxxx"
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            {/* Summary */}
            <div className="bg-teal-50 rounded-xl p-4 space-y-2">
              <h3 className="text-sm font-semibold text-teal-900">Booking Summary</h3>
              <p className="text-sm text-teal-800">Lab: {labInfo?.name_en}</p>
              <p className="text-sm text-teal-800">
                Type:{' '}
                {bookingType === 'walk_in' && 'Walk-in'}
                {bookingType === 'scheduled' && `Scheduled: ${appointmentDate} ${appointmentTime}`}
                {bookingType === 'home_collection' && 'Home Collection'}
              </p>
              {selectedServiceIds.size > 0 && (
                <p className="text-sm text-teal-800">
                  {selectedServiceIds.size} tests — Total: EGP {totalPrice}
                </p>
              )}
              {hasFasting && (
                <p className="text-xs text-red-600 font-medium">
                  ⚠️ Please fast for 8-12 hours before your tests
                </p>
              )}
            </div>

            {error && (
              <div className="bg-red-50 text-red-700 text-sm p-3 rounded-xl">{error}</div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="flex-1 border border-gray-300 text-gray-700 font-medium py-3 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || !patientName || !patientPhone}
                className="flex-1 bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Booking...
                  </span>
                ) : (
                  'Confirm Booking'
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Success */}
        {step === 4 && (
          <div className="bg-white rounded-xl p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <span className="text-3xl">✓</span>
            </div>
            <h2 className="text-xl font-bold text-gray-900">Booking Confirmed!</h2>
            <p className="text-gray-500 text-sm">
              We will contact you at {patientPhone} to confirm your appointment.
            </p>
            <button
              onClick={() => router.push(`/en/lab/${labSlug}`)}
              className="mt-4 text-teal-600 hover:underline text-sm"
            >
              Back to Lab Page
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
