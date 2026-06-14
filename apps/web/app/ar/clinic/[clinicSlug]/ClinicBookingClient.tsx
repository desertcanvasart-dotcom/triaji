'use client';

import { useState, useEffect, useCallback } from 'react';

interface Doctor {
  id: string;
  name_ar: string;
  title_ar: string;
}

interface Slot {
  id: string;
  start_time: string;
  end_time: string;
  is_available: boolean;
}

interface ClinicBookingClientProps {
  tenantId: string;
  clinicName: string;
  doctors: Doctor[];
  bookingMode: string;
}

export default function ClinicBookingClient({
  tenantId,
  clinicName,
  doctors,
  bookingMode,
}: ClinicBookingClientProps) {
  const [selectedDoctor, setSelectedDoctor] = useState(doctors[0]?.id ?? '');
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [bookingForm, setBookingForm] = useState(false);
  const [patientName, setPatientName] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Fetch available slots for selected doctor (next 7 days)
  const fetchSlots = useCallback(async () => {
    if (!selectedDoctor) return;
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const weekLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const res = await fetch(
        `/api/booking/slots?doctor_id=${selectedDoctor}&date_from=${today}&date_to=${weekLater}`
      );
      if (res.ok) {
        const data = await res.json();
        setSlots(data.slots ?? []);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [selectedDoctor]);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  async function handleBookSlot() {
    if (!selectedSlot || !patientName || !patientPhone) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slot_id: selectedSlot,
          doctor_id: selectedDoctor,
          tenant_id: tenantId,
          patient_name: patientName,
          patient_phone: patientPhone,
        }),
      });

      if (res.ok) {
        setSuccess(true);
        setBookingForm(false);
        setSelectedSlot(null);
        setPatientName('');
        setPatientPhone('');
      }
    } catch {
      // Silently fail
    } finally {
      setSubmitting(false);
    }
  }

  // Group slots by date
  const slotsByDate = new Map<string, Slot[]>();
  for (const slot of slots) {
    const date = slot.start_time.split('T')[0] ?? '';
    if (!slotsByDate.has(date)) slotsByDate.set(date, []);
    slotsByDate.get(date)!.push(slot);
  }

  if (success) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
        <span className="text-4xl block mb-3">✅</span>
        <p className="text-lg font-semibold text-green-800">تم حجز الموعد بنجاح!</p>
        <p className="text-sm text-green-600 mt-1">
          سيصلك تأكيد على واتساب قريباً
        </p>
        <button
          onClick={() => setSuccess(false)}
          className="mt-4 text-sm text-teal-600 hover:underline"
        >
          حجز موعد آخر
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">
        {bookingMode === 'slots_only' ? 'احجز موعد' : 'احجز موعد مسبق'}
      </h2>

      {/* Doctor selector */}
      {doctors.length > 1 && (
        <div className="flex gap-2 overflow-x-auto">
          {doctors.map((doc) => (
            <button
              key={doc.id}
              onClick={() => {
                setSelectedDoctor(doc.id);
                setSelectedSlot(null);
              }}
              className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedDoctor === doc.id
                  ? 'bg-teal-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-200'
              }`}
            >
              {doc.title_ar} {doc.name_ar}
            </button>
          ))}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {/* Slots by date */}
      {!loading && slotsByDate.size === 0 && (
        <div className="bg-white rounded-xl shadow-sm p-8 text-center">
          <p className="text-gray-400 text-sm">لا توجد مواعيد متاحة حالياً</p>
        </div>
      )}

      {!loading &&
        Array.from(slotsByDate.entries()).map(([date, dateSlots]) => {
          const dayName = new Date(date).toLocaleDateString('ar-EG', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          });

          return (
            <div key={date} className="bg-white rounded-xl shadow-sm p-4">
              <p className="text-sm font-medium text-gray-700 mb-3">{dayName}</p>
              <div className="flex flex-wrap gap-2">
                {dateSlots.map((slot) => {
                  const time = new Date(slot.start_time).toLocaleTimeString('ar-EG', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  const isSelected = selectedSlot === slot.id;

                  return (
                    <button
                      key={slot.id}
                      disabled={!slot.is_available}
                      onClick={() => {
                        setSelectedSlot(isSelected ? null : slot.id);
                        if (!isSelected) setBookingForm(true);
                      }}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        !slot.is_available
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed line-through'
                          : isSelected
                          ? 'bg-teal-600 text-white'
                          : 'bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200'
                      }`}
                      dir="ltr"
                    >
                      {time} {!slot.is_available ? '— محجوز' : '✓'}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

      {/* Booking Form (appears when slot selected) */}
      {bookingForm && selectedSlot && (
        <div className="bg-white rounded-xl shadow-sm p-5 border-2 border-teal-200 space-y-4">
          <h3 className="text-base font-semibold text-gray-900">بيانات الحجز</h3>

          <div>
            <label className="block text-sm text-gray-600 mb-1">الاسم</label>
            <input
              type="text"
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
              placeholder="اسمك بالكامل"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">رقم الموبايل</label>
            <input
              type="tel"
              value={patientPhone}
              onChange={(e) => setPatientPhone(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
              placeholder="01xxxxxxxxx"
              dir="ltr"
              required
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleBookSlot}
              disabled={submitting || !patientName || !patientPhone}
              className="flex-1 bg-teal-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? 'جارٍ الحجز...' : 'تأكيد الحجز'}
            </button>
            <button
              onClick={() => {
                setBookingForm(false);
                setSelectedSlot(null);
              }}
              className="px-4 py-2.5 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
