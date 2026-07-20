'use client';

import { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import StampSetup from '@/components/doctor/StampSetup';

// react-signature-canvas is heavy and only needed on this settings page — keep
// it out of the initial bundle.
const SignaturePad = dynamic(() => import('@/components/doctor/SignaturePad'), {
  ssr: false,
  loading: () => <div className="h-48 animate-pulse rounded-xl bg-gray-100" />,
});

// ─── Types ──────────────────────────────────────────────────────────────────

interface DoctorSettings {
  id: string;
  doctor_id: string;
  name_ar: string;
  name_en: string | null;
  specialty_name_ar: string;
  syndicate_number: string;
  email: string | null;
  phone: string | null;
  signature_url: string | null;
  stamp_url: string | null;
  use_text_stamp: boolean;
  clinic_name_ar: string;
  clinic_name_en: string;
  clinic_address_ar: string;
  clinic_address_en: string;
  clinic_phone: string;
}

type TabId = 'profile' | 'signature';

interface TabConfig {
  id: TabId;
  label: string;
}

const TABS: TabConfig[] = [
  { id: 'profile', label: 'الملف الشخصي' },
  { id: 'signature', label: 'التوقيع والختم' },
];

// ─── Loading Skeleton ────────────────────────────────────────────────────────

function SettingsSkeleton() {
  return (
    <div className="p-6 md:p-8 animate-pulse space-y-6">
      <div className="h-8 bg-gray-200 rounded w-48" />
      <div className="flex gap-4">
        <div className="h-10 bg-gray-200 rounded w-32" />
        <div className="h-10 bg-gray-200 rounded w-32" />
      </div>
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-14 bg-gray-100 rounded" />
        ))}
      </div>
    </div>
  );
}

// ─── Profile Tab ─────────────────────────────────────────────────────────────

function ProfileTab({ settings }: { settings: DoctorSettings }) {
  const fields: { label: string; value: string | null }[] = [
    { label: 'الاسم بالعربي', value: settings.name_ar },
    { label: 'الاسم بالإنجليزي', value: settings.name_en },
    { label: 'التخصص', value: settings.specialty_name_ar },
    { label: 'رقم النقابة', value: settings.syndicate_number },
    { label: 'البريد الإلكتروني', value: settings.email },
    { label: 'رقم الموبايل', value: settings.phone },
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        بيانات الملف الشخصي للقراءة فقط حالياً
      </p>

      <div className="grid gap-4">
        {fields.map((field) => (
          <div
            key={field.label}
            className="bg-white border border-gray-200 rounded-lg p-4"
          >
            <p className="text-xs text-gray-500 mb-1">{field.label}</p>
            <p className="text-sm font-medium text-[#1A2F4A]">
              {field.value || '—'}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Clinic Form ─────────────────────────────────────────────────────────────

interface ClinicFormData {
  clinic_name_ar: string;
  clinic_name_en: string;
  clinic_address_ar: string;
  clinic_address_en: string;
  clinic_phone: string;
}

function ClinicDetailsForm({
  initialData,
  onSave,
}: {
  initialData: ClinicFormData;
  onSave: (data: ClinicFormData) => Promise<void>;
}) {
  const [form, setForm] = useState<ClinicFormData>(initialData);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleChange(field: keyof ClinicFormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      await onSave(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError('فشل في حفظ بيانات العيادة');
    } finally {
      setSaving(false);
    }
  }

  const fields: { key: keyof ClinicFormData; label: string; dir?: 'ltr' }[] = [
    { key: 'clinic_name_ar', label: 'اسم العيادة بالعربي' },
    { key: 'clinic_name_en', label: 'Clinic Name English', dir: 'ltr' },
    { key: 'clinic_address_ar', label: 'عنوان العيادة بالعربي' },
    { key: 'clinic_address_en', label: 'Clinic Address English', dir: 'ltr' },
    { key: 'clinic_phone', label: 'رقم تليفون العيادة' },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="text-lg font-bold text-[#1A2F4A]">بيانات العيادة</h3>

      {fields.map((field) => (
        <div key={field.key}>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {field.label}
          </label>
          <input
            type="text"
            value={form[field.key]}
            onChange={(e) => handleChange(field.key, e.target.value)}
            dir={field.dir}
            className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-colors"
          />
        </div>
      ))}

      {error && (
        <p className="text-sm text-red-600 font-medium">{error}</p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2.5 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {saving && (
            <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          )}
          حفظ بيانات العيادة
        </button>

        {saved && (
          <span className="text-sm text-green-600 font-medium">
            تم الحفظ بنجاح
          </span>
        )}
      </div>
    </form>
  );
}

// ─── Main Settings Page ──────────────────────────────────────────────────────

export default function DoctorSettingsPage() {
  const [settings, setSettings] = useState<DoctorSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('signature');
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/doctor/settings');
      if (!res.ok) {
        setFetchError('فشل في تحميل الإعدادات');
        return;
      }
      const data = (await res.json()) as { settings: DoctorSettings };
      setSettings(data.settings);
    } catch {
      setFetchError('حدث خطأ غير متوقع');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // ─── Signature Save ────────────────────────────────────────────────────────

  async function handleSignatureSave(dataUrl: string) {
    const blob = await (await fetch(dataUrl)).blob();
    const formData = new FormData();
    formData.append('file', blob, 'signature.png');
    formData.append('type', 'signature');

    const res = await fetch('/api/doctor/settings/upload', {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) throw new Error('Upload failed');

    const { url } = (await res.json()) as { url: string };
    setSettings((prev) => (prev ? { ...prev, signature_url: url } : prev));
  }

  // ─── Stamp Upload ─────────────────────────────────────────────────────────

  async function handleStampUpload(file: File) {
    const formData = new FormData();
    formData.append('file', file, 'stamp.png');
    formData.append('type', 'stamp');

    const res = await fetch('/api/doctor/settings/upload', {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) throw new Error('Upload failed');

    const { url } = (await res.json()) as { url: string };
    setSettings((prev) => (prev ? { ...prev, stamp_url: url } : prev));
  }

  // ─── Toggle Text Stamp ────────────────────────────────────────────────────

  async function handleToggleTextStamp(useText: boolean) {
    const res = await fetch('/api/doctor/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ use_text_stamp: useText }),
    });

    if (!res.ok) throw new Error('Update failed');

    setSettings((prev) => (prev ? { ...prev, use_text_stamp: useText } : prev));
  }

  // ─── Clinic Save ──────────────────────────────────────────────────────────

  async function handleClinicSave(data: ClinicFormData) {
    const res = await fetch('/api/doctor/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!res.ok) throw new Error('Update failed');

    setSettings((prev) => (prev ? { ...prev, ...data } : prev));
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) return <SettingsSkeleton />;

  if (fetchError || !settings) {
    return (
      <div className="p-6 md:p-8">
        <p className="text-red-600 font-medium">{fetchError || 'فشل في تحميل الإعدادات'}</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-3xl">
      <h1 className="text-2xl font-bold text-[#1A2F4A] mb-6">إعداداتي</h1>

      {/* ─── Tabs ──────────────────────────────────────────────────────────── */}
      <div className="flex gap-2 mb-8 border-b border-gray-200">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'border-teal-600 text-teal-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─── Profile Tab ──────────────────────────────────────────────────── */}
      {activeTab === 'profile' && <ProfileTab settings={settings} />}

      {/* ─── Signature & Stamp Tab ────────────────────────────────────────── */}
      {activeTab === 'signature' && (
        <div className="space-y-10">
          <SignaturePad
            currentSignatureUrl={settings.signature_url}
            onSave={handleSignatureSave}
          />

          <hr className="border-gray-200" />

          <StampSetup
            currentStampUrl={settings.stamp_url}
            useTextStamp={settings.use_text_stamp}
            doctorName={{ ar: settings.name_ar, en: settings.name_en }}
            specialty={settings.specialty_name_ar}
            syndicateNumber={settings.syndicate_number}
            onUploadStamp={handleStampUpload}
            onToggleTextStamp={handleToggleTextStamp}
          />

          <hr className="border-gray-200" />

          <ClinicDetailsForm
            initialData={{
              clinic_name_ar: settings.clinic_name_ar,
              clinic_name_en: settings.clinic_name_en,
              clinic_address_ar: settings.clinic_address_ar,
              clinic_address_en: settings.clinic_address_en,
              clinic_phone: settings.clinic_phone,
            }}
            onSave={handleClinicSave}
          />
        </div>
      )}
    </div>
  );
}
