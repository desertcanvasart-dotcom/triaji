'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { showToast } from '@/components/ui/Toast';

// ─── Props ──────────────────────────────────────────────────────────────────

interface FastAddFormProps {
  doctorId: string;
  tenantId: string;
  onAdded: () => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function FastAddForm({ doctorId, tenantId, onAdded }: FastAddFormProps) {
  const [phone, setPhone] = useState('');
  const [patientName, setPatientName] = useState('');
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [knownPatient, setKnownPatient] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);

  const phoneRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-focus phone on mount
  useEffect(() => {
    phoneRef.current?.focus();
  }, []);

  // ─── Phone Lookup (debounced) ─────────────────────────────────────────────

  const lookupPhone = useCallback(
    async (phoneValue: string) => {
      if (phoneValue.length < 8) {
        setKnownPatient(false);
        return;
      }

      setLookingUp(true);
      try {
        const res = await fetch(
          `/api/admin/queue?phone=${encodeURIComponent(phoneValue)}`
        );
        if (res.ok) {
          const data = await res.json();
          if (data.patient_name_ar) {
            setPatientName(data.patient_name_ar);
            setKnownPatient(true);
          } else {
            setKnownPatient(false);
          }
        } else {
          setKnownPatient(false);
        }
      } catch {
        setKnownPatient(false);
      } finally {
        setLookingUp(false);
      }
    },
    []
  );

  const handlePhoneChange = (value: string) => {
    setPhone(value);
    setKnownPatient(false);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      lookupPhone(value);
    }, 500);
  };

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  // ─── Submit ───────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = patientName.trim();
    if (!trimmedName) {
      showToast('اسم المريض مطلوب', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doctor_id: doctorId,
          patient_name_ar: trimmedName,
          patient_phone: phone.trim() || null,
          chief_complaint_ar: chiefComplaint.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'فشل في الإضافة');
      }

      // Success — clear form and notify
      setPhone('');
      setPatientName('');
      setChiefComplaint('');
      setKnownPatient(false);
      showToast('تمت الإضافة للطابور', 'success');
      onAdded();
      phoneRef.current?.focus();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'حدث خطأ غير متوقع',
        'error'
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <h3 className="text-lg font-bold text-gray-900 mb-1">إضافة مريض جديد</h3>

      {/* Phone */}
      <div>
        <label htmlFor="fast-phone" className="block text-sm font-medium text-gray-700 mb-1">
          رقم الهاتف
          <span className="text-gray-400 text-xs mr-1">(اختياري)</span>
        </label>
        <div className="relative">
          <input
            ref={phoneRef}
            id="fast-phone"
            type="tel"
            dir="ltr"
            placeholder="01xxxxxxxxx"
            value={phone}
            onChange={(e) => handlePhoneChange(e.target.value)}
            className="w-full h-12 px-4 rounded-lg border border-gray-300 text-base focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-colors"
            autoComplete="off"
          />
          {lookingUp && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
              ...
            </span>
          )}
        </div>
        {knownPatient && (
          <span className="inline-block mt-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
            مريض معروف في النظام ✓
          </span>
        )}
      </div>

      {/* Patient Name */}
      <div>
        <label htmlFor="fast-name" className="block text-sm font-medium text-gray-700 mb-1">
          اسم المريض <span className="text-red-500">*</span>
        </label>
        <input
          id="fast-name"
          type="text"
          dir="rtl"
          placeholder="الاسم بالعربي"
          value={patientName}
          onChange={(e) => setPatientName(e.target.value)}
          required
          className="w-full h-12 px-4 rounded-lg border border-gray-300 text-base focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-colors"
        />
      </div>

      {/* Chief Complaint */}
      <div>
        <label htmlFor="fast-complaint" className="block text-sm font-medium text-gray-700 mb-1">
          الشكوى الرئيسية
          <span className="text-gray-400 text-xs mr-1">(اختياري)</span>
        </label>
        <input
          id="fast-complaint"
          type="text"
          dir="rtl"
          placeholder="مثال: صداع، ألم في الظهر..."
          value={chiefComplaint}
          onChange={(e) => setChiefComplaint(e.target.value)}
          className="w-full h-12 px-4 rounded-lg border border-gray-300 text-base focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-colors"
        />
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={submitting || !patientName.trim()}
        className="w-full h-14 rounded-lg bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white text-lg font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting ? 'جارٍ الإضافة...' : 'إضافة للطابور ➕'}
      </button>
    </form>
  );
}
