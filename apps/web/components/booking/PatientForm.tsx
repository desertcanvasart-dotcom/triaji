'use client';

import { useState } from 'react';

interface PatientFormProps {
  onSubmit: (data: { patientName: string; phoneNumber: string }) => void;
  onBack: () => void;
  isSubmitting: boolean;
}

function isValidEgyptianPhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s\-()]/g, '');
  return /^(010|011|012|015)\d{8}$/.test(cleaned);
}

export default function PatientForm({ onSubmit, onBack, isSubmitting }: PatientFormProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  const handleSubmit = () => {
    let valid = true;

    if (name.trim().length < 2) {
      setNameError('من فضلك أدخل اسمك بالكامل');
      valid = false;
    } else {
      setNameError(null);
    }

    if (!isValidEgyptianPhone(phone)) {
      setPhoneError('من فضلك أدخل رقم موبايل مصري صحيح');
      valid = false;
    } else {
      setPhoneError(null);
    }

    if (valid) {
      onSubmit({ patientName: name.trim(), phoneNumber: phone.trim() });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
      <div
        className="bg-white rounded-t-2xl w-full max-w-lg overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <button onClick={onBack} className="text-gray-400 hover:text-gray-600 text-sm">
            ← رجوع
          </button>
          <h3 className="font-bold text-gray-900">بيانات الحجز</h3>
          <div className="w-12" />
        </div>

        {/* Form */}
        <div className="p-4 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">اسمك؟</label>
            <input
              type="text"
              dir="rtl"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="اسمك بالكامل"
              className={`w-full border rounded-xl px-4 py-3 text-right focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent ${
                nameError ? 'border-red-400' : 'border-gray-300'
              }`}
            />
            {nameError && <p className="text-red-500 text-xs mt-1">{nameError}</p>}
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">رقم موبايلك؟</label>
            <input
              type="tel"
              dir="ltr"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="010XXXXXXXX"
              className={`w-full border rounded-xl px-4 py-3 text-left focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent ${
                phoneError ? 'border-red-400' : 'border-gray-300'
              }`}
            />
            {phoneError && <p className="text-red-500 text-xs mt-1">{phoneError}</p>}
          </div>
        </div>

        {/* Submit */}
        <div className="p-4 border-t">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full bg-teal-600 text-white py-3 rounded-xl font-semibold hover:bg-teal-700 transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'جاري الحجز...' : 'تأكيد الحجز'}
          </button>
        </div>
      </div>
    </div>
  );
}
