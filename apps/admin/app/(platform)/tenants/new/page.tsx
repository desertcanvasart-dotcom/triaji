'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { showToast } from '@/components/ui/Toast';

export default function NewTenantPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name_ar: '',
    name_en: '',
    slug: '',
    tier: 'basic',
    is_active: true,
  });

  function generateSlug(name: string) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name_en || !form.slug) {
      showToast('English name and slug are required.', 'error');
      return;
    }
    setSaving(true);
    const res = await fetch('/api/admin/tenants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      showToast('Tenant created.', 'success');
      router.push('/tenants');
    } else {
      const data = await res.json();
      showToast(data.error ?? 'Failed to create tenant.', 'error');
    }
    setSaving(false);
  }

  function updateField(field: string, value: unknown) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Add Tenant</h1>
      <form onSubmit={handleSubmit} className="card space-y-5">
        <div>
          <label className="label">Name (Arabic)</label>
          <input type="text" dir="rtl" value={form.name_ar} onChange={(e) => updateField('name_ar', e.target.value)} className="input-field" />
        </div>
        <div>
          <label className="label">Name (English) *</label>
          <input
            type="text"
            value={form.name_en}
            onChange={(e) => { updateField('name_en', e.target.value); if (!form.slug || form.slug === generateSlug(form.name_en)) { updateField('slug', generateSlug(e.target.value)); } }}
            className="input-field"
            placeholder="Cairo General Hospital"
          />
        </div>
        <div>
          <label className="label">Slug *</label>
          <input
            type="text"
            value={form.slug}
            onChange={(e) => updateField('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            className="input-field font-mono"
            placeholder="cairo-general-hospital"
          />
          <p className="text-xs text-gray-400 mt-1">URL-safe identifier. Only lowercase letters, numbers, and hyphens.</p>
        </div>
        <div>
          <label className="label">Tier</label>
          <select value={form.tier} onChange={(e) => updateField('tier', e.target.value)} className="input-field">
            <option value="basic">Basic</option>
            <option value="premium">Premium</option>
          </select>
        </div>
        <div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_active} onChange={(e) => updateField('is_active', e.target.checked)} className="rounded border-gray-300" />
            Active
          </label>
        </div>
        <div className="flex gap-3 pt-4 border-t border-gray-200">
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Creating...' : 'Create Tenant'}</button>
          <button type="button" onClick={() => router.push('/tenants')} className="btn-secondary">Cancel</button>
        </div>
      </form>
    </div>
  );
}
