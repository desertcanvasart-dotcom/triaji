'use client';

import { useState, useEffect, useRef } from 'react';
import { t, type Lang } from '@triaji/shared/i18n';

// ─── Types ───────────────────────────────────────────────────────────────────

interface InsurancePolicyFormProps {
  lang: Lang;
  onSaved: () => void;
}

interface InsurerOption {
  code: string;
  name_ar: string;
  name_en: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function InsurancePolicyForm({ lang, onSaved }: InsurancePolicyFormProps) {
  const isRtl = lang === 'ar';
  const [insurers, setInsurers] = useState<InsurerOption[]>([]);
  const [saving, setSaving] = useState(false);

  // Form state
  const [insurerCode, setInsurerCode] = useState('');
  const [policyNumber, setPolicyNumber] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [memberName, setMemberName] = useState('');
  const [employer, setEmployer] = useState('');
  const [cardImage, setCardImage] = useState<File | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch insurers
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/insurance/providers');
        if (res.ok) {
          const data = await res.json();
          setInsurers(data.providers ?? []);
        }
      } catch {
        // Silently fail
      }
    })();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!insurerCode || !policyNumber) return;

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('insurer_code', insurerCode);
      formData.append('policy_number', policyNumber);
      if (cardNumber) formData.append('card_number', cardNumber);
      if (memberName) formData.append('member_name', memberName);
      if (employer) formData.append('employer', employer);
      if (cardImage) formData.append('card_image', cardImage);

      const res = await fetch('/api/patient/insurance/policy', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        onSaved();
      }
    } catch {
      // Silently fail
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    'w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none';

  return (
    <form onSubmit={handleSubmit} className="space-y-4" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Insurer Select */}
      <div>
        <label className="block text-xs text-gray-600 mb-1">
          {t('insurance.selectInsurer', lang)}
        </label>
        <select
          value={insurerCode}
          onChange={(e) => setInsurerCode(e.target.value)}
          required
          className={inputClass}
        >
          <option value="">{t('insurance.selectInsurer', lang)}</option>
          {insurers.map((ins) => (
            <option key={ins.code} value={ins.code}>
              {lang === 'ar' ? ins.name_ar : ins.name_en}
            </option>
          ))}
        </select>
      </div>

      {/* Policy Number */}
      <div>
        <label className="block text-xs text-gray-600 mb-1">
          {t('insurance.policyNumber', lang)}
        </label>
        <input
          type="text"
          value={policyNumber}
          onChange={(e) => setPolicyNumber(e.target.value)}
          required
          placeholder={t('insurance.policyNumber', lang)}
          className={inputClass}
        />
      </div>

      {/* Card Number */}
      <div>
        <label className="block text-xs text-gray-600 mb-1">
          {t('insurance.cardNumber', lang)}
        </label>
        <input
          type="text"
          value={cardNumber}
          onChange={(e) => setCardNumber(e.target.value)}
          placeholder={t('insurance.cardNumber', lang)}
          className={inputClass}
        />
      </div>

      {/* Member Name */}
      <div>
        <label className="block text-xs text-gray-600 mb-1">
          {t('insurance.memberName', lang)}
        </label>
        <input
          type="text"
          value={memberName}
          onChange={(e) => setMemberName(e.target.value)}
          placeholder={t('insurance.memberName', lang)}
          className={inputClass}
        />
      </div>

      {/* Employer */}
      <div>
        <label className="block text-xs text-gray-600 mb-1">
          {t('insurance.employer', lang)}
        </label>
        <input
          type="text"
          value={employer}
          onChange={(e) => setEmployer(e.target.value)}
          placeholder={t('insurance.employer', lang)}
          className={inputClass}
        />
      </div>

      {/* Card Image Upload */}
      <div>
        <label className="block text-xs text-gray-600 mb-1">
          {t('insurance.uploadCard', lang)}
        </label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => setCardImage(e.target.files?.[0] ?? null)}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full border-2 border-dashed border-gray-300 rounded-lg px-4 py-6 text-center text-sm text-gray-500 hover:border-emerald-400 hover:text-emerald-600 transition-colors"
        >
          {cardImage ? (
            <span className="text-emerald-600 font-medium">{cardImage.name}</span>
          ) : (
            <>
              <span className="text-2xl block mb-1">📷</span>
              {t('insurance.uploadCard', lang)}
            </>
          )}
        </button>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={saving || !insurerCode || !policyNumber}
        className="w-full py-3 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
      >
        {saving ? t('insurance.savingPolicy', lang) : t('insurance.savePolicy', lang)}
      </button>
    </form>
  );
}
