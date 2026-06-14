'use client';

import { useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import PaymentSettingsSection from './PaymentSettingsSection';

type BookingMode = 'walk_in_only' | 'slots_only' | 'both';

interface TenantConfig {
  opening_time: string;
  closing_time: string;
  working_days: number[];
  estimated_minutes_per_patient: number;
  queue_whatsapp_enabled: boolean;
  queue_sms_fallback: boolean;
  specialty_ar: string;
  specialty_en: string;
  floor_address: string;
  phone: string;
  clinic_booking_mode: BookingMode;
}

const BOOKING_MODES: Array<{ value: BookingMode; icon: string; label: string; description: string }> = [
  {
    value: 'walk_in_only',
    icon: '🚶',
    label: 'قائمة انتظار فقط',
    description: 'المرضى بييجوا من غير موعد محدد ويستنوا دورهم',
  },
  {
    value: 'slots_only',
    icon: '📅',
    label: 'مواعيد بوقت محدد',
    description: 'المريض بيحجز وقت محدد زي 10:00 ص',
  },
  {
    value: 'both',
    icon: '🔄',
    label: 'الاتنين معاً',
    description: 'في ناس بيحجزوا مواعيد وفي ناس بييجوا من غير موعد',
  },
];

const DAYS = [
  { value: 0, label: 'الأحد' },
  { value: 1, label: 'الاثنين' },
  { value: 2, label: 'الثلاثاء' },
  { value: 3, label: 'الأربعاء' },
  { value: 4, label: 'الخميس' },
  { value: 5, label: 'الجمعة' },
  { value: 6, label: 'السبت' },
];

export default function SettingsForm({
  tenantId,
  initialConfig,
}: {
  tenantId: string;
  initialConfig: Partial<TenantConfig>;
}) {
  const [config, setConfig] = useState<TenantConfig>({
    opening_time: initialConfig.opening_time ?? '09:00',
    closing_time: initialConfig.closing_time ?? '17:00',
    working_days: initialConfig.working_days ?? [0, 1, 2, 3, 4],
    estimated_minutes_per_patient: initialConfig.estimated_minutes_per_patient ?? 15,
    queue_whatsapp_enabled: initialConfig.queue_whatsapp_enabled ?? false,
    queue_sms_fallback: initialConfig.queue_sms_fallback ?? false,
    specialty_ar: initialConfig.specialty_ar ?? '',
    specialty_en: initialConfig.specialty_en ?? '',
    floor_address: initialConfig.floor_address ?? '',
    phone: initialConfig.phone ?? '',
    clinic_booking_mode: (initialConfig.clinic_booking_mode as BookingMode) ?? 'walk_in_only',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function updateField<K extends keyof TenantConfig>(key: K, value: TenantConfig[K]) {
    setConfig((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  function toggleDay(day: number) {
    setConfig((prev) => {
      const days = prev.working_days.includes(day)
        ? prev.working_days.filter((d) => d !== day)
        : [...prev.working_days, day].sort();
      return { ...prev, working_days: days };
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

      const res = await fetch('/api/admin/clinic/settings', {
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
      {/* Working Hours */}
      <section className="bg-white rounded-xl shadow-sm p-5 space-y-4">
        <h2 className="text-base font-semibold text-gray-900">مواعيد العمل</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">وقت الفتح</label>
            <input
              type="time"
              value={config.opening_time}
              onChange={(e) => updateField('opening_time', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">وقت الإغلاق</label>
            <input
              type="time"
              value={config.closing_time}
              onChange={(e) => updateField('closing_time', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
              dir="ltr"
            />
          </div>
        </div>

        {/* Working Days */}
        <div>
          <label className="block text-sm text-gray-600 mb-2">أيام العمل</label>
          <div className="flex flex-wrap gap-2">
            {DAYS.map((day) => {
              const active = config.working_days.includes(day.value);
              return (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => toggleDay(day.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? 'bg-teal-600 text-white'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {day.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Minutes per patient */}
        <div>
          <label className="block text-sm text-gray-600 mb-1">
            الوقت المقدر لكل مريض (بالدقائق)
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                updateField(
                  'estimated_minutes_per_patient',
                  Math.max(5, config.estimated_minutes_per_patient - 5)
                )
              }
              className="w-8 h-8 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 font-bold"
            >
              -
            </button>
            <span className="w-12 text-center font-medium text-lg">
              {config.estimated_minutes_per_patient}
            </span>
            <button
              type="button"
              onClick={() =>
                updateField(
                  'estimated_minutes_per_patient',
                  Math.min(60, config.estimated_minutes_per_patient + 5)
                )
              }
              className="w-8 h-8 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 font-bold"
            >
              +
            </button>
            <span className="text-sm text-gray-400 mr-2">دقيقة</span>
          </div>
        </div>
      </section>

      {/* Booking Mode */}
      <section className="bg-white rounded-xl shadow-sm p-5 space-y-4">
        <h2 className="text-base font-semibold text-gray-900">نوع الحجز</h2>
        <p className="text-xs text-gray-400">كيف بيحجز المرضى؟</p>
        <div className="space-y-3">
          {BOOKING_MODES.map((mode) => (
            <button
              key={mode.value}
              type="button"
              onClick={() => updateField('clinic_booking_mode', mode.value)}
              className={`w-full text-right p-4 rounded-xl border-2 transition-colors ${
                config.clinic_booking_mode === mode.value
                  ? 'border-teal-500 bg-teal-50'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">{mode.icon}</span>
                <div>
                  <p className={`text-sm font-medium ${
                    config.clinic_booking_mode === mode.value ? 'text-teal-700' : 'text-gray-800'
                  }`}>
                    {mode.label}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{mode.description}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Notifications */}
      <section className="bg-white rounded-xl shadow-sm p-5 space-y-4">
        <h2 className="text-base font-semibold text-gray-900">الإشعارات</h2>

        {/* WhatsApp Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700">واتساب الطابور</p>
            <p className="text-xs text-gray-400">إرسال إشعارات واتساب للمرضى في الطابور</p>
          </div>
          <button
            type="button"
            onClick={() => updateField('queue_whatsapp_enabled', !config.queue_whatsapp_enabled)}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              config.queue_whatsapp_enabled ? 'bg-teal-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                config.queue_whatsapp_enabled ? 'right-0.5' : 'right-[22px]'
              }`}
            />
          </button>
        </div>

        {/* SMS Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700">رسائل SMS احتياطية</p>
            <p className="text-xs text-gray-400">إرسال SMS في حال فشل الواتساب</p>
          </div>
          <button
            type="button"
            onClick={() => updateField('queue_sms_fallback', !config.queue_sms_fallback)}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              config.queue_sms_fallback ? 'bg-teal-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                config.queue_sms_fallback ? 'right-0.5' : 'right-[22px]'
              }`}
            />
          </button>
        </div>
      </section>

      {/* Clinic Info */}
      <section className="bg-white rounded-xl shadow-sm p-5 space-y-4">
        <h2 className="text-base font-semibold text-gray-900">معلومات العيادة</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">التخصص (عربي)</label>
            <input
              type="text"
              value={config.specialty_ar}
              onChange={(e) => updateField('specialty_ar', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
              placeholder="مثال: طب الأطفال"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">التخصص (إنجليزي)</label>
            <input
              type="text"
              value={config.specialty_en}
              onChange={(e) => updateField('specialty_en', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
              placeholder="e.g. Pediatrics"
              dir="ltr"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">الطابق / العنوان</label>
          <input
            type="text"
            value={config.floor_address}
            onChange={(e) => updateField('floor_address', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
            placeholder="مثال: الدور الثالث - عيادة 305"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">رقم الهاتف</label>
          <input
            type="tel"
            value={config.phone}
            onChange={(e) => updateField('phone', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
            placeholder="01xxxxxxxxx"
            dir="ltr"
          />
        </div>
      </section>

      {/* Online Payment Settings */}
      <PaymentSettingsSection tenantId={tenantId} />

      {/* Save Button */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="bg-teal-600 text-white px-8 py-2.5 rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50 transition-colors"
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
