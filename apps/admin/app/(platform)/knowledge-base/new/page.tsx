'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { showToast } from '@/components/ui/Toast';

const COLLECTIONS = [
  'conditions', 'symptoms', 'specialty_map', 'emergency_protocols',
  'egypt_context', 'risk_modifiers', 'follow_up_questions',
];

export default function NewKBDocumentPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [embedProgress, setEmbedProgress] = useState('');
  const [form, setForm] = useState({
    collection: '',
    title_ar: '',
    title_en: '',
    content_ar: '',
    content_en: '',
    metadata: '',
    is_active: true,
  });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.collection || !form.title_ar || !form.content_ar) {
      showToast('Collection, Arabic title, and Arabic content are required.', 'error');
      return;
    }

    // Validate metadata JSON
    if (form.metadata) {
      try {
        JSON.parse(form.metadata);
      } catch {
        showToast('Invalid metadata JSON.', 'error');
        return;
      }
    }

    setSaving(true);
    setEmbedProgress('Saving document...');

    const res = await fetch('/api/admin/kb', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        metadata: form.metadata || '{}',
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.embedding?.success) {
        setEmbedProgress(`Document saved and embedded successfully (${data.embedding.chunksEmbedded} chunks)`);
        showToast('Document saved and embedded successfully.', 'success');
      } else {
        setEmbedProgress('Document saved but embedding failed. Retry embedding from the edit page.');
        showToast('Document saved but embedding failed.', 'error');
      }
      setTimeout(() => router.push('/knowledge-base'), 1500);
    } else {
      const data = await res.json();
      showToast(data.error ?? 'Failed to save document.', 'error');
      setEmbedProgress('');
    }
    setSaving(false);
  }

  function updateField(field: string, value: unknown) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Add KB Document</h1>
      <form onSubmit={handleSubmit} className="card space-y-5">
        <div>
          <label className="label">Collection *</label>
          <select value={form.collection} onChange={(e) => updateField('collection', e.target.value)} className="input-field">
            <option value="">Select collection...</option>
            {COLLECTIONS.map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Title (Arabic) *</label>
          <input type="text" dir="rtl" value={form.title_ar} onChange={(e) => updateField('title_ar', e.target.value)} className="input-field" />
        </div>
        <div>
          <label className="label">Title (English)</label>
          <input type="text" value={form.title_en} onChange={(e) => updateField('title_en', e.target.value)} className="input-field" />
        </div>
        <div>
          <label className="label">Content (Arabic) *</label>
          <textarea dir="rtl" value={form.content_ar} onChange={(e) => updateField('content_ar', e.target.value)} className="input-field h-40 resize-y" />
        </div>
        <div>
          <label className="label">Content (English)</label>
          <textarea value={form.content_en} onChange={(e) => updateField('content_en', e.target.value)} className="input-field h-40 resize-y" />
        </div>
        <div>
          <label className="label">Metadata (JSON)</label>
          <textarea
            value={form.metadata}
            onChange={(e) => updateField('metadata', e.target.value)}
            className="input-field h-24 resize-y font-mono text-sm"
            placeholder='{"specialty": "cardiology", "urgency": "urgent", "tags": ["chest", "heart"]}'
          />
        </div>
        <div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_active} onChange={(e) => updateField('is_active', e.target.checked)} className="rounded border-gray-300" />
            Active
          </label>
        </div>
        {embedProgress && (
          <div className="bg-teal-50 text-teal-800 text-sm px-4 py-2.5 rounded-lg">
            {embedProgress}
          </div>
        )}
        <div className="flex gap-3 pt-4 border-t border-gray-200">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Saving & Embedding...' : 'Save & Embed'}
          </button>
          <button type="button" onClick={() => router.push('/knowledge-base')} className="btn-secondary">Cancel</button>
        </div>
      </form>
    </div>
  );
}
