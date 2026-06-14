'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { showToast } from '@/components/ui/Toast';

export default function NewDoctorPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [specialties, setSpecialties] = useState<Array<{ id: string; name_en: string; name_ar: string }>>([]);
  const [governorates, setGovernorates] = useState<Array<{ id: string; name_en: string; name_ar: string }>>([]);

  const [form, setForm] = useState({
    name_ar: '',
    name_en: '',
    title_ar: 'د.',
    title_en: 'Dr.',
    specialty_id: '',
    sub_specialty_ids: [] as string[],
    governorate_id: '',
    latitude: '',
    longitude: '',
    consultation_fee_egp: '',
    phone: '',
    languages: ['ar'] as string[],
    bio_ar: '',
    bio_en: '',
    years_of_experience: '',
    accepts_new_patients: true,
    available_for_booking: true,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const supabase = getSupabaseBrowser();
    supabase.from('specialties').select('id, name_en, name_ar').order('name_en').then(({ data }) => {
      setSpecialties(data ?? []);
    });
    supabase.from('governorates').select('id, name_en, name_ar').order('name_en').then(({ data }) => {
      setGovernorates(data ?? []);
    });
  }, []);

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!form.name_ar || form.name_ar.length < 10) {
      errs['name_ar'] = 'Arabic name is required (minimum 10 characters).';
    }
    if (!form.specialty_id) {
      errs['specialty_id'] = 'Specialty is required.';
    }
    if (!form.governorate_id) {
      errs['governorate_id'] = 'Governorate is required.';
    }
    if (form.consultation_fee_egp && Number(form.consultation_fee_egp) <= 0) {
      errs['consultation_fee_egp'] = 'Fee must be a positive number.';
    }
    if ((form.latitude && !form.longitude) || (!form.latitude && form.longitude)) {
      errs['location'] = 'Both latitude and longitude are required.';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    const payload: Record<string, unknown> = {
      ...form,
      consultation_fee_egp: form.consultation_fee_egp ? Number(form.consultation_fee_egp) : null,
      years_of_experience: form.years_of_experience ? Number(form.years_of_experience) : null,
      latitude: form.latitude ? Number(form.latitude) : null,
      longitude: form.longitude ? Number(form.longitude) : null,
    };

    const res = await fetch('/api/admin/doctors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      showToast('Doctor created successfully.', 'success');
      router.push('/doctors');
    } else {
      const data = await res.json();
      showToast(data.error ?? 'Failed to create doctor.', 'error');
    }
    setSaving(false);
  }

  function updateField(field: string, value: unknown) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function toggleLanguage(lang: string) {
    setForm((prev) => ({
      ...prev,
      languages: prev.languages.includes(lang)
        ? prev.languages.filter((l) => l !== lang)
        : [...prev.languages, lang],
    }));
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Add Doctor</h1>
      <form onSubmit={handleSubmit} className="card space-y-5">
        {/* Arabic Name */}
        <div>
          <label className="label">Name (Arabic) *</label>
          <input
            type="text"
            dir="rtl"
            value={form.name_ar}
            onChange={(e) => updateField('name_ar', e.target.value)}
            className="input-field"
            placeholder="د. أحمد محمد عبدالرحمن"
          />
          {errors['name_ar'] && <p className="text-red-500 text-xs mt-1">{errors['name_ar']}</p>}
        </div>

        {/* English Name */}
        <div>
          <label className="label">Name (English)</label>
          <input
            type="text"
            value={form.name_en}
            onChange={(e) => updateField('name_en', e.target.value)}
            className="input-field"
            placeholder="Dr. Ahmed Mohamed Abdelrahman"
          />
        </div>

        {/* Titles */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Title (Arabic)</label>
            <input
              type="text"
              dir="rtl"
              value={form.title_ar}
              onChange={(e) => updateField('title_ar', e.target.value)}
              className="input-field"
            />
          </div>
          <div>
            <label className="label">Title (English)</label>
            <input
              type="text"
              value={form.title_en}
              onChange={(e) => updateField('title_en', e.target.value)}
              className="input-field"
            />
          </div>
        </div>

        {/* Specialty */}
        <div>
          <label className="label">Specialty *</label>
          <select
            value={form.specialty_id}
            onChange={(e) => updateField('specialty_id', e.target.value)}
            className="input-field"
          >
            <option value="">Select specialty...</option>
            {specialties.map((s) => (
              <option key={s.id} value={s.id}>{s.name_en}</option>
            ))}
          </select>
          {errors['specialty_id'] && <p className="text-red-500 text-xs mt-1">{errors['specialty_id']}</p>}
        </div>

        {/* Governorate */}
        <div>
          <label className="label">Governorate *</label>
          <select
            value={form.governorate_id}
            onChange={(e) => updateField('governorate_id', e.target.value)}
            className="input-field"
          >
            <option value="">Select governorate...</option>
            {governorates.map((g) => (
              <option key={g.id} value={g.id}>{g.name_en}</option>
            ))}
          </select>
          {errors['governorate_id'] && <p className="text-red-500 text-xs mt-1">{errors['governorate_id']}</p>}
        </div>

        {/* Location */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Latitude</label>
            <input
              type="number"
              step="any"
              value={form.latitude}
              onChange={(e) => updateField('latitude', e.target.value)}
              className="input-field"
              placeholder="30.0444"
            />
          </div>
          <div>
            <label className="label">Longitude</label>
            <input
              type="number"
              step="any"
              value={form.longitude}
              onChange={(e) => updateField('longitude', e.target.value)}
              className="input-field"
              placeholder="31.2357"
            />
          </div>
          {errors['location'] && <p className="text-red-500 text-xs mt-1 col-span-2">{errors['location']}</p>}
        </div>

        {/* Fee */}
        <div>
          <label className="label">Consultation Fee (EGP)</label>
          <input
            type="number"
            min="0"
            value={form.consultation_fee_egp}
            onChange={(e) => updateField('consultation_fee_egp', e.target.value)}
            className="input-field"
            placeholder="300"
          />
          {errors['consultation_fee_egp'] && <p className="text-red-500 text-xs mt-1">{errors['consultation_fee_egp']}</p>}
        </div>

        {/* Phone */}
        <div>
          <label className="label">Phone</label>
          <input
            type="text"
            value={form.phone}
            onChange={(e) => updateField('phone', e.target.value)}
            className="input-field"
            placeholder="01012345678"
          />
        </div>

        {/* Experience */}
        <div>
          <label className="label">Years of Experience</label>
          <input
            type="number"
            min="0"
            value={form.years_of_experience}
            onChange={(e) => updateField('years_of_experience', e.target.value)}
            className="input-field"
          />
        </div>

        {/* Languages */}
        <div>
          <label className="label">Languages</label>
          <div className="flex gap-4">
            {['ar', 'en', 'fr'].map((lang) => (
              <label key={lang} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.languages.includes(lang)}
                  onChange={() => toggleLanguage(lang)}
                  className="rounded border-gray-300"
                />
                {lang === 'ar' ? 'Arabic' : lang === 'en' ? 'English' : 'French'}
              </label>
            ))}
          </div>
        </div>

        {/* Bio */}
        <div>
          <label className="label">Bio (Arabic)</label>
          <textarea
            dir="rtl"
            value={form.bio_ar}
            onChange={(e) => updateField('bio_ar', e.target.value)}
            className="input-field h-24 resize-none"
          />
        </div>
        <div>
          <label className="label">Bio (English)</label>
          <textarea
            value={form.bio_en}
            onChange={(e) => updateField('bio_en', e.target.value)}
            className="input-field h-24 resize-none"
          />
        </div>

        {/* Toggles */}
        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.accepts_new_patients}
              onChange={(e) => updateField('accepts_new_patients', e.target.checked)}
              className="rounded border-gray-300"
            />
            Accepting new patients
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.available_for_booking}
              onChange={(e) => updateField('available_for_booking', e.target.checked)}
              className="rounded border-gray-300"
            />
            Available for booking
          </label>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t border-gray-200">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Creating...' : 'Create Doctor'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/doctors')}
            className="btn-secondary"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
