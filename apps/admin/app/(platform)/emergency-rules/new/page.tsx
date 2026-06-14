'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { showToast } from '@/components/ui/Toast';

export default function NewEmergencyRulePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    rule_name: '',
    description_ar: '',
    symptom_conditions: '{\n  "any_of": [],\n  "all_of": [],\n  "none_of": []\n}',
    profile_conditions: '{}',
    response_ar: '',
    escalation_type: 'emergency_room',
    priority: 100,
    is_active: true,
  });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.rule_name || !form.escalation_type) {
      showToast('Rule name and escalation type are required.', 'error');
      return;
    }
    try {
      JSON.parse(form.symptom_conditions);
      JSON.parse(form.profile_conditions);
    } catch {
      showToast('Invalid JSON in conditions.', 'error');
      return;
    }

    setSaving(true);
    const res = await fetch('/api/admin/emergency-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      showToast('Rule created.', 'success');
      router.push('/emergency-rules');
    } else {
      const data = await res.json();
      showToast(data.error ?? 'Failed to create rule.', 'error');
    }
    setSaving(false);
  }

  function updateField(field: string, value: unknown) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Add Emergency Rule</h1>
      <form onSubmit={handleSubmit} className="card space-y-5">
        <div>
          <label className="label">Rule Name</label>
          <input type="text" value={form.rule_name} onChange={(e) => updateField('rule_name', e.target.value)} className="input-field" placeholder="cardiac_chest_pain_plus_breath" />
        </div>
        <div>
          <label className="label">Description (Arabic)</label>
          <textarea dir="rtl" value={form.description_ar} onChange={(e) => updateField('description_ar', e.target.value)} className="input-field h-20 resize-none" />
        </div>
        <div>
          <label className="label">Symptom Conditions (JSON)</label>
          <textarea value={form.symptom_conditions} onChange={(e) => updateField('symptom_conditions', e.target.value)} className="input-field h-32 resize-y font-mono text-sm" />
          <p className="text-xs text-gray-400 mt-1">any_of = at least one must match, all_of = all must match, none_of = none must match</p>
        </div>
        <div>
          <label className="label">Profile Conditions (JSON, optional)</label>
          <textarea value={form.profile_conditions} onChange={(e) => updateField('profile_conditions', e.target.value)} className="input-field h-24 resize-y font-mono text-sm" />
        </div>
        <div>
          <label className="label">Arabic Response Text</label>
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
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Creating...' : 'Create Rule'}</button>
          <button type="button" onClick={() => router.push('/emergency-rules')} className="btn-secondary">Cancel</button>
        </div>
      </form>
    </div>
  );
}
