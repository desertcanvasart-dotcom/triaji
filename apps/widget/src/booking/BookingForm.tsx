import React, { useState } from 'react';
import type { AvailableSlot, MatchedDoctor, BookingResult } from '../config';
import { createBooking } from '../api';
import { trackEvent } from '../analytics';

interface BookingFormProps {
  apiUrl: string;
  tenantId: string;
  sessionId: string;
  doctor: MatchedDoctor;
  slot: AvailableSlot;
  onConfirmed: (result: BookingResult) => void;
  onBack: () => void;
  primaryColor: string;
}

export function BookingForm({
  apiUrl,
  tenantId,
  sessionId,
  doctor,
  slot,
  onConfirmed,
  onBack,
  primaryColor,
}: BookingFormProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (name.trim().length < 2) {
      setError('من فضلك أدخل اسمك بالكامل');
      return;
    }

    const cleaned = phone.replace(/[\s\-()]/g, '');
    if (!/^(010|011|012|015)\d{8}$/.test(cleaned)) {
      setError('من فضلك أدخل رقم موبايل مصري صحيح');
      return;
    }

    setSubmitting(true);

    try {
      const result = await createBooking(apiUrl, {
        sessionId,
        doctorId: doctor.id,
        slotId: slot.id,
        patientName: name.trim(),
        phoneNumber: cleaned,
        notes: notes.trim() || undefined,
      });

      trackEvent(apiUrl, tenantId, 'booking_confirmed', sessionId);
      onConfirmed(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ أثناء الحجز');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="triaji-booking-form" onSubmit={handleSubmit}>
      <div className="triaji-form-title">تأكيد الحجز</div>
      <div className="triaji-form-summary">
        <div>👨‍⚕️ {doctor.nameAr}</div>
        <div>📋 {doctor.specialtyNameAr}</div>
        <div>📅 {slot.dayAr} — {slot.dateAr}</div>
        <div>🕐 {slot.timeAr}</div>
        {doctor.consultationFeeEgp != null && (
          <div>💰 {doctor.consultationFeeEgp} ج.م</div>
        )}
      </div>

      <div className="triaji-form-group">
        <label className="triaji-form-label">الاسم بالكامل</label>
        <input
          type="text"
          className="triaji-form-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="أدخل اسمك الثلاثي"
          dir="rtl"
        />
      </div>

      <div className="triaji-form-group">
        <label className="triaji-form-label">رقم الموبايل</label>
        <input
          type="tel"
          className="triaji-form-input ltr"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="01XXXXXXXXX"
          dir="ltr"
        />
      </div>

      <div className="triaji-form-group">
        <label className="triaji-form-label">ملاحظات (اختياري)</label>
        <input
          type="text"
          className="triaji-form-input"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="أي ملاحظات إضافية"
          dir="rtl"
        />
      </div>

      {error && <div className="triaji-form-error">{error}</div>}

      <button
        type="button"
        className="triaji-slot-back"
        onClick={onBack}
        style={{ alignSelf: 'flex-start' }}
      >
        → العودة للمواعيد
      </button>

      <button
        type="submit"
        className="triaji-form-submit"
        disabled={submitting}
        style={{ backgroundColor: primaryColor }}
      >
        {submitting ? 'جاري الحجز...' : 'تأكيد الحجز'}
      </button>
    </form>
  );
}
