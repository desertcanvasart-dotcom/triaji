'use client';

import { useState, useEffect, type FormEvent, use } from 'react';
import { useRouter } from 'next/navigation';
import { showToast } from '@/components/ui/Toast';
import { FormSkeleton } from '@/components/ui/LoadingSkeleton';

const COLLECTIONS = [
  'conditions', 'symptoms', 'specialty_map', 'emergency_protocols',
  'egypt_context', 'risk_modifiers', 'follow_up_questions',
];

export default function EditKBDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reembedding, setReembedding] = useState(false);
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

  useEffect(() => {
    fetch(`/api/admin/kb/${id}`).then(async (res) => {
      if (res.ok) {
        const data = await res.json();
        const doc = data.document;
        setForm({
          collection: doc.collection ?? '',
          title_ar: doc.title_ar ?? '',
          title_en: doc.title_en ?? '',
          content_ar: doc.content_ar ?? '',
          content_en: doc.content_en ?? '',
          metadata: doc.metadata ? JSON.stringify(doc.metadata, null, 2) : '',
          is_active: doc.is_active ?? true,
        });
      }
      setLoading(false);
    });
  }, [id]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.title_ar || !form.content_ar) {
      showToast('Arabic title and content are required.', 'error');
      return;
    }
    if (form.metadata) {
      try { JSON.parse(form.metadata); } catch { showToast('Invalid metadata JSON.', 'error'); return; }
    }

    setSaving(true);
    setEmbedProgress('Saving and re-embedding...');

    const res = await fetch(`/api/admin/kb/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, metadata: form.metadata || '{}' }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.embedding?.success) {
        setEmbedProgress(`Updated and re-embedded (${data.embedding.chunksEmbedded} chunks)`);
        showToast('Document updated and re-embedded.', 'success');
      } else if (data.embedding) {
        setEmbedProgress('Document saved but embedding failed.');
        showToast('Document saved but embedding failed.', 'error');
      } else {
        showToast('Document updated.', 'success');
      }
      setTimeout(() => router.push('/knowledge-base'), 1500);
    } else {
      const data = await res.json();
      showToast(data.error ?? 'Failed to update.', 'error');
      setEmbedProgress('');
    }
    setSaving(false);
  }

  async function handleReembed() {
    setReembedding(true);
    setEmbedProgress('Re-embedding...');
    const res = await fetch(`/api/admin/kb/${id}/embed`, { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      setEmbedProgress(`Re-embedded successfully (${data.chunksEmbedded} chunks)`);
      showToast('Re-embedded successfully.', 'success');
    } else {
      setEmbedProgress('Re-embedding failed.');
      showToast('Re-embedding failed.', 'error');
    }
    setReembedding(false);
  }

  function updateField(field: string, value: unknown) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  if (loading) return <div className="max-w-2xl"><h1 className="text-2xl font-bold text-gray-900 mb-6">Edit Document</h1><div className="card"><FormSkeleton /></div></div>;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Edit Document</h1>
      <form onSubmit={handleSubmit} className="card space-y-5">
        <div>
          <label className="label">Collection</label>
          <select value={form.collection} onChange={(e) => updateField('collection', e.target.value)} className="input-field">
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
          <textarea value={form.metadata} onChange={(e) => updateField('metadata', e.target.value)} className="input-field h-24 resize-y font-mono text-sm" />
        </div>
        <div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_active} onChange={(e) => updateField('is_active', e.target.checked)} className="rounded border-gray-300" />
            Active
          </label>
        </div>
        {embedProgress && (
          <div className="bg-teal-50 text-teal-800 text-sm px-4 py-2.5 rounded-lg">{embedProgress}</div>
        )}
        <div className="flex gap-3 pt-4 border-t border-gray-200">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Saving...' : 'Save & Re-embed'}
          </button>
          <button type="button" onClick={handleReembed} disabled={reembedding} className="btn-secondary">
            {reembedding ? 'Re-embedding...' : 'Re-embed Only'}
          </button>
          <button type="button" onClick={() => router.push('/knowledge-base')} className="btn-secondary">Cancel</button>
        </div>
      </form>
    </div>
  );
}
