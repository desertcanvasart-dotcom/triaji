'use client';

import { useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';

// ─── Types ───────────────────────────────────────────────────────────────────

type PharmacyType = 'general' | 'hospital' | 'compounding' | 'specialty';

interface PharmacyConfig {
  license_number: string;
  pharmacist_name_ar: string;
  pharmacist_name_en: string;
  pharmacy_type: PharmacyType;
  delivery_enabled: boolean;
  delivery_radius_km: number;
  delivery_fee_egp: number;
  accepts_insurance: boolean;
  insurance_providers: string[];
  prep_time_minutes: number;
}

// ─── Pharmacy Types ──────────────────────────────────────────────────────────

const PHARMACY_TYPES: Array<{ value: PharmacyType; label: string }> = [
  { value: 'general', label: 'صيدلية عامة' },
  { value: 'hospital', label: 'صيدلية مستشفى' },
  { value: 'compounding', label: 'صيدلية تركيبات' },
  { value: 'specialty', label: 'صيدلية متخصصة' },
];

const INSURANCE_PROVIDERS = [
  'MetLife',
  'Bupa',
  'AXA',
  'Allianz',
  'GlobeMed',
  'Mednet',
  'NGE',
  'SAICO',
  'MedGulf',
  'QIC',
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function PharmacySettings({
  tenantId,
  initialConfig,
}: {
  tenantId: string;
  initialConfig: Partial<PharmacyConfig>;
}) {
  const [config, setConfig] = useState<PharmacyConfig>({
    license_number: initialConfig.license_number ?? '',
    pharmacist_name_ar: initialConfig.pharmacist_name_ar ?? '',
    pharmacist_name_en: initialConfig.pharmacist_name_en ?? '',
    pharmacy_type: initialConfig.pharmacy_type ?? 'general',
    delivery_enabled: initialConfig.delivery_enabled ?? false,
    delivery_radius_km: initialConfig.delivery_radius_km ?? 5,
    delivery_fee_egp: initialConfig.delivery_fee_egp ?? 0,
    accepts_insurance: initialConfig.accepts_insurance ?? false,
    insurance_providers: initialConfig.insurance_providers ?? [],
    prep_time_minutes: initialConfig.prep_time_minutes ?? 30,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function updateField<K extends keyof PharmacyConfig>(key: K, value: PharmacyConfig[K]) {
    setConfig((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  function toggleInsuranceProvider(provider: string) {
    setConfig((prev) => {
      const current = prev.insurance_providers;
      const next = current.includes(provider)
        ? current.filter((p) => p !== provider)
        : [...current, provider];
      return { ...prev, insurance_providers: next };
    });
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const supabase = getSupabaseBrowser();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch('/api/admin/pharmacy/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(config),
      });

      if (res.ok) {
        setSaved(true);
      }
    } catch {
      // Silently fail
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-8" dir="rtl">
      {/* Pharmacy Type */}
      <section className="bg-white rounded-xl shadow-sm p-5 space-y-4">
        <h2 className="text-base font-semibold text-gray-900">نوع الصيدلية</h2>

        <div>
          <label className="block text-sm text-gray-600 mb-1">التصنيف</label>
          <select
            value={config.pharmacy_type}
            onChange={(e) => updateField('pharmacy_type', e.target.value as PharmacyType)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
          >
            {PHARMACY_TYPES.map((pt) => (
              <option key={pt.value} value={pt.value}>
                {pt.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* License & Pharmacist */}
      <section className="bg-white rounded-xl shadow-sm p-5 space-y-4">
        <h2 className="text-base font-semibold text-gray-900">بيانات الصيدلية</h2>

        <div>
          <label className="block text-sm text-gray-600 mb-1">رقم الترخيص</label>
          <input
            type="text"
            value={config.license_number}
            onChange={(e) => updateField('license_number', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
            placeholder="رقم ترخيص وزارة الصحة"
            dir="ltr"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">اسم الصيدلي المسؤول (عربي)</label>
          <input
            type="text"
            value={config.pharmacist_name_ar}
            onChange={(e) => updateField('pharmacist_name_ar', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
            placeholder="الاسم بالعربي"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">اسم الصيدلي المسؤول (إنجليزي)</label>
          <input
            type="text"
            value={config.pharmacist_name_en}
            onChange={(e) => updateField('pharmacist_name_en', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
            placeholder="Name in English"
            dir="ltr"
          />
        </div>
      </section>

      {/* Delivery */}
      <section className="bg-white rounded-xl shadow-sm p-5 space-y-4">
        <h2 className="text-base font-semibold text-gray-900">التوصيل</h2>

        {/* Delivery Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700">خدمة التوصيل</p>
            <p className="text-xs text-gray-400">توصيل الأدوية للمريض في البيت</p>
          </div>
          <button
            type="button"
            onClick={() => updateField('delivery_enabled', !config.delivery_enabled)}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              config.delivery_enabled ? 'bg-emerald-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                config.delivery_enabled ? 'right-0.5' : 'right-[22px]'
              }`}
            />
          </button>
        </div>

        {config.delivery_enabled && (
          <>
            <div>
              <label className="block text-sm text-gray-600 mb-1">نطاق التوصيل (كم)</label>
              <input
                type="number"
                min={1}
                max={100}
                value={config.delivery_radius_km}
                onChange={(e) => updateField('delivery_radius_km', Number(e.target.value) || 5)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">رسوم التوصيل (ج.م)</label>
              <input
                type="number"
                min={0}
                value={config.delivery_fee_egp}
                onChange={(e) => updateField('delivery_fee_egp', Number(e.target.value) || 0)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                dir="ltr"
              />
            </div>
          </>
        )}
      </section>

      {/* Insurance */}
      <section className="bg-white rounded-xl shadow-sm p-5 space-y-4">
        <h2 className="text-base font-semibold text-gray-900">التأمين الطبي</h2>

        {/* Insurance Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700">قبول التأمين</p>
            <p className="text-xs text-gray-400">الصيدلية تقبل التعامل مع شركات التأمين</p>
          </div>
          <button
            type="button"
            onClick={() => updateField('accepts_insurance', !config.accepts_insurance)}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              config.accepts_insurance ? 'bg-emerald-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                config.accepts_insurance ? 'right-0.5' : 'right-[22px]'
              }`}
            />
          </button>
        </div>

        {config.accepts_insurance && (
          <div className="space-y-2">
            <label className="block text-sm text-gray-600">شركات التأمين المقبولة</label>
            <div className="flex flex-wrap gap-2">
              {INSURANCE_PROVIDERS.map((provider) => (
                <button
                  key={provider}
                  type="button"
                  onClick={() => toggleInsuranceProvider(provider)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    config.insurance_providers.includes(provider)
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {provider}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Preparation Time */}
      <section className="bg-white rounded-xl shadow-sm p-5 space-y-4">
        <h2 className="text-base font-semibold text-gray-900">وقت التحضير</h2>

        <div>
          <label className="block text-sm text-gray-600 mb-1">وقت تحضير الوصفة (بالدقائق)</label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                updateField('prep_time_minutes', Math.max(5, config.prep_time_minutes - 5))
              }
              className="w-8 h-8 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 font-bold"
            >
              -
            </button>
            <span className="w-12 text-center font-medium text-lg">
              {config.prep_time_minutes}
            </span>
            <button
              type="button"
              onClick={() =>
                updateField('prep_time_minutes', Math.min(120, config.prep_time_minutes + 5))
              }
              className="w-8 h-8 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 font-bold"
            >
              +
            </button>
            <span className="text-sm text-gray-400 mr-2">دقيقة</span>
          </div>
        </div>
      </section>

      {/* Save Button */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="bg-emerald-600 text-white px-8 py-2.5 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
        >
          {saving ? 'جارٍ الحفظ...' : 'حفظ الإعدادات'}
        </button>
        {saved && (
          <span className="text-sm text-green-600 font-medium">تم الحفظ بنجاح</span>
        )}
      </div>
    </div>
  );
}
