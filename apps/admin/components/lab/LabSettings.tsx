'use client';

import { useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';

// ─── Types ───────────────────────────────────────────────────────────────────

type LabType =
  | 'general'
  | 'blood_analysis'
  | 'microbiology'
  | 'pathology'
  | 'genetics'
  | 'radiology_center'
  | 'imaging_center';

interface LabConfig {
  lab_type: LabType;
  accreditation_number: string;
  medical_director: string;
  turnaround_hours: number;
  urgent_turnaround_hours: number;
  accepts_walk_ins: boolean;
  home_collection: boolean;
  home_collection_fee: number;
  collection_notes: string;
}

// ─── Lab Types ───────────────────────────────────────────────────────────────

const LAB_TYPES: Array<{ value: LabType; label: string }> = [
  { value: 'general', label: 'معمل تحاليل عام' },
  { value: 'blood_analysis', label: 'تحاليل دم' },
  { value: 'microbiology', label: 'ميكروبيولوجي' },
  { value: 'pathology', label: 'باثولوجي' },
  { value: 'genetics', label: 'تحاليل وراثية' },
  { value: 'radiology_center', label: 'مركز أشعة' },
  { value: 'imaging_center', label: 'مركز تصوير طبي' },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function LabSettings({
  tenantId,
  initialConfig,
}: {
  tenantId: string;
  initialConfig: Partial<LabConfig>;
}) {
  const [config, setConfig] = useState<LabConfig>({
    lab_type: initialConfig.lab_type ?? 'general',
    accreditation_number: initialConfig.accreditation_number ?? '',
    medical_director: initialConfig.medical_director ?? '',
    turnaround_hours: initialConfig.turnaround_hours ?? 24,
    urgent_turnaround_hours: initialConfig.urgent_turnaround_hours ?? 6,
    accepts_walk_ins: initialConfig.accepts_walk_ins ?? true,
    home_collection: initialConfig.home_collection ?? false,
    home_collection_fee: initialConfig.home_collection_fee ?? 0,
    collection_notes: initialConfig.collection_notes ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function updateField<K extends keyof LabConfig>(key: K, value: LabConfig[K]) {
    setConfig((prev) => ({ ...prev, [key]: value }));
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

      const res = await fetch('/api/admin/lab/settings', {
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
      {/* Lab Type */}
      <section className="bg-white rounded-xl shadow-sm p-5 space-y-4">
        <h2 className="text-base font-semibold text-gray-900">نوع المعمل</h2>

        <div>
          <label className="block text-sm text-gray-600 mb-1">التصنيف</label>
          <select
            value={config.lab_type}
            onChange={(e) => updateField('lab_type', e.target.value as LabType)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
          >
            {LAB_TYPES.map((lt) => (
              <option key={lt.value} value={lt.value}>
                {lt.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* Accreditation & Director */}
      <section className="bg-white rounded-xl shadow-sm p-5 space-y-4">
        <h2 className="text-base font-semibold text-gray-900">بيانات المعمل</h2>

        <div>
          <label className="block text-sm text-gray-600 mb-1">رقم الاعتماد</label>
          <input
            type="text"
            value={config.accreditation_number}
            onChange={(e) => updateField('accreditation_number', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
            placeholder="رقم ترخيص وزارة الصحة"
            dir="ltr"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">المدير الطبي</label>
          <input
            type="text"
            value={config.medical_director}
            onChange={(e) => updateField('medical_director', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
            placeholder="اسم المدير الطبي المسؤول"
          />
        </div>
      </section>

      {/* Turnaround Times */}
      <section className="bg-white rounded-xl shadow-sm p-5 space-y-4">
        <h2 className="text-base font-semibold text-gray-900">أوقات التسليم</h2>

        {/* Standard Turnaround */}
        <div>
          <label className="block text-sm text-gray-600 mb-1">وقت التسليم العادي (بالساعات)</label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                updateField('turnaround_hours', Math.max(1, config.turnaround_hours - 1))
              }
              className="w-8 h-8 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 font-bold"
            >
              -
            </button>
            <span className="w-12 text-center font-medium text-lg">
              {config.turnaround_hours}
            </span>
            <button
              type="button"
              onClick={() =>
                updateField('turnaround_hours', Math.min(168, config.turnaround_hours + 1))
              }
              className="w-8 h-8 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 font-bold"
            >
              +
            </button>
            <span className="text-sm text-gray-400 mr-2">ساعة</span>
          </div>
        </div>

        {/* Urgent Turnaround */}
        <div>
          <label className="block text-sm text-gray-600 mb-1">وقت التسليم العاجل (بالساعات)</label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                updateField('urgent_turnaround_hours', Math.max(1, config.urgent_turnaround_hours - 1))
              }
              className="w-8 h-8 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 font-bold"
            >
              -
            </button>
            <span className="w-12 text-center font-medium text-lg">
              {config.urgent_turnaround_hours}
            </span>
            <button
              type="button"
              onClick={() =>
                updateField('urgent_turnaround_hours', Math.min(72, config.urgent_turnaround_hours + 1))
              }
              className="w-8 h-8 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 font-bold"
            >
              +
            </button>
            <span className="text-sm text-gray-400 mr-2">ساعة</span>
          </div>
        </div>
      </section>

      {/* Walk-ins & Home Collection */}
      <section className="bg-white rounded-xl shadow-sm p-5 space-y-4">
        <h2 className="text-base font-semibold text-gray-900">خدمات إضافية</h2>

        {/* Walk-ins Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700">قبول زيارات بدون موعد</p>
            <p className="text-xs text-gray-400">المرضى يقدرون يزوروا من غير حجز مسبق</p>
          </div>
          <button
            type="button"
            onClick={() => updateField('accepts_walk_ins', !config.accepts_walk_ins)}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              config.accepts_walk_ins ? 'bg-teal-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                config.accepts_walk_ins ? 'right-0.5' : 'right-[22px]'
              }`}
            />
          </button>
        </div>

        {/* Home Collection Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700">خدمة السحب المنزلي</p>
            <p className="text-xs text-gray-400">نوصل للمريض في البيت لسحب العينات</p>
          </div>
          <button
            type="button"
            onClick={() => updateField('home_collection', !config.home_collection)}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              config.home_collection ? 'bg-teal-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                config.home_collection ? 'right-0.5' : 'right-[22px]'
              }`}
            />
          </button>
        </div>

        {/* Home Collection Fee (shown if enabled) */}
        {config.home_collection && (
          <div>
            <label className="block text-sm text-gray-600 mb-1">رسوم السحب المنزلي (ج.م)</label>
            <input
              type="number"
              min={0}
              value={config.home_collection_fee}
              onChange={(e) => updateField('home_collection_fee', Number(e.target.value) || 0)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
              placeholder="0"
              dir="ltr"
            />
          </div>
        )}

        {/* Collection Notes */}
        <div>
          <label className="block text-sm text-gray-600 mb-1">ملاحظات السحب</label>
          <textarea
            value={config.collection_notes}
            onChange={(e) => updateField('collection_notes', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none resize-y"
            placeholder="مثال: يرجى الصيام 8 ساعات قبل سحب العينات..."
            rows={3}
          />
        </div>
      </section>

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
