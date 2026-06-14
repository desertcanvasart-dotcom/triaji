'use client';

import { useState, useEffect, type FormEvent, use } from 'react';
import { useRouter } from 'next/navigation';
import { showToast } from '@/components/ui/Toast';
import { FormSkeleton } from '@/components/ui/LoadingSkeleton';

export default function EditEmergencyRulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    rule_name: '',
    description_ar: '',
    symptom_conditions: '{}',
    profile_conditions: '{}',
    response_ar: '',
    escalation_type: 'emergency_room',
    priority: 100,
    is_active: true,
  });

  useEffect(() => {
    fetch(`/api/admin/emergency-rules/${id}`).then(async (res) => {
      if (res.ok) {
        const data = await res.json();
        const rule = data.rule;
        setForm({
          rule_name: rule.rule_name ?? '',
          description_ar: rule.description_ar ?? '',
          symptom_conditions: JSON.stringify(rule.symptom_conditions ?? {}, null, 2),
          profile_conditions: JSON.stringify(rule.profile_conditions ?? {}, null, 2),
          response_ar: rule.response_ar ?? '',
          escalation_type: rule.escalation_type ?? 'emergency_room',
          priority: rule.priority ?? 100,
          is_active: rule.is_active ?? true,
        });
      }
      setLoading(false);
    });
  }, [id]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      JSON.parse(form.symptom_conditions);
      JSON.parse(form.profile_conditions);
    } catch {
      showToast('Invalid JSON in conditions.', 'error');
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/admin/emergency-rules/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      showToast('Rule updated.', 'success');
      router.push('/emergency-rules');
    } else {
      const data = await res.json();
      showToast(data.error ?? 'Failed to update rule.', 'error');
    }
    setSaving(false);
  }

  function updateField(field: string, value: unknown) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  if (loading) return <div className="max-w-2xl"><h1 className="text-2xl font-bold text-gray-900 mb-6">Edit Rule</h1><div className="card"><FormSkeleton /></div></div>;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Edit Emergency Rule</h1>
      <form onSubmit={handleSubmit} className="card space-y-5">
        <div>
          <label className="label">Rule Name</label>
          <input type="text" value={form.rule_name} onChange={(e) => updateField('rule_name', e.target.value)} className="input-field" />
        </div>
        <div>
          <label className="label">Description (Arabic)</label>
          <textarea dir="rtl" value={form.description_ar} onChange={(e) => updateField('description_ar', e.target.value)} className="input-field h-20 resize-none" />
        </div>
        <div>
          <label className="label">Symptom Conditions (JSON)</label>
          <textarea value={form.symptom_conditions} onChange={(e) => updateField('symptom_conditions', e.target.value)} className="input-field h-32 resize-y font-mono text-sm" />
        </div>
        <div>
          <label className="label">Profile Conditions (JSON)</label>
          <textarea value={form.profile_conditions} onChange={(e) => updateField('profile_conditions', e.target.value)} className="input-field h-24 resize-y font-mono text-sm" />
        </div>
        <div>
          <label className="label">Arabic Response</label>
          <textarea dir="rtl" value={form.response_ar} onChange={(e) => updateField('response_ar', e.target.value)} className="input-field h-24 resize-y" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Escalation Type</label>
            <select value={form.escalation_type} onChange={(e) => updateField('escalation_type', e.target.value)} className="input-field">
              <option value="emergency_room">Emergency Room</option>
              <option value="call_ambulance">Call Ambulance</option>
              <option value="urgent_same_day">Urgent Same Day</option>
            </select>
          </div>
          <div>
            <label className="label">Priority</label>
            <input type="number" min="1" value={form.priority} onChange={(e) => updateField('priority', Number(e.target.value))} className="input-field" />
          </div>
        </div>
        <div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_active} onChange={(e) => updateField('is_active', e.target.checked)} className="rounded border-gray-300" />
            Active
          </label>
        </div>
        <div className="flex gap-3 pt-4 border-t border-gray-200">
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save Changes'}</button>
          <button type="button" onClick={() => router.push('/emergency-rules')} className="btn-secondary">Cancel</button>
        </div>
      </form>
    </div>
  );
}
