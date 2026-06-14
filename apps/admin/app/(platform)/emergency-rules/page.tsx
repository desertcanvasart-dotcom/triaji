'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { TableSkeleton } from '@/components/ui/LoadingSkeleton';
import EmptyState from '@/components/ui/EmptyState';
import { showToast } from '@/components/ui/Toast';

interface EmergencyRule {
  id: string;
  rule_name: string;
  description_ar: string;
  symptom_conditions: Record<string, unknown>;
  escalation_type: string;
  priority: number;
  is_active: boolean;
  response_ar: string;
}

const ESCALATION_COLORS: Record<string, string> = {
  emergency_room: 'badge-red',
  call_ambulance: 'badge-red',
  urgent_same_day: 'badge-amber',
};

export default function EmergencyRulesPage() {
  const [rules, setRules] = useState<EmergencyRule[]>([]);
  const [loading, setLoading] = useState(true);

  // Test panel
  const [testSymptoms, setTestSymptoms] = useState('');
  const [testResults, setTestResults] = useState<Array<{
    rule_name: string;
    escalation_type: string;
    response_ar: string;
    priority: number;
  }>>([]);
  const [testLoading, setTestLoading] = useState(false);

  const fetchRules = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/admin/emergency-rules');
    if (res.ok) {
      const data = await res.json();
      setRules(data.rules ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  async function toggleActive(rule: EmergencyRule) {
    const res = await fetch(`/api/admin/emergency-rules/${rule.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !rule.is_active }),
    });
    if (res.ok) {
      showToast(rule.is_active ? 'Rule deactivated.' : 'Rule activated.', 'success');
      fetchRules();
    } else {
      showToast('Failed to update rule.', 'error');
    }
  }

  async function handleTest() {
    if (!testSymptoms.trim()) return;
    setTestLoading(true);
    const symptoms = testSymptoms.split(',').map((s) => s.trim()).filter(Boolean);
    const res = await fetch('/api/admin/emergency-rules/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symptoms }),
    });
    if (res.ok) {
      const data = await res.json();
      setTestResults(data.triggered ?? []);
      if (data.triggered.length === 0) {
        showToast('No rules triggered.', 'info');
      }
    } else {
      showToast('Test failed.', 'error');
    }
    setTestLoading(false);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Emergency Rules</h1>
        <Link href="/emergency-rules/new" className="btn-primary">Add Rule</Link>
      </div>

      {loading ? (
        <TableSkeleton rows={6} cols={5} />
      ) : rules.length === 0 ? (
        <EmptyState
          icon="🚨"
          title="No emergency rules"
          description="Add emergency trigger rules to protect patients."
          actionLabel="Add Rule"
          onAction={() => window.location.href = '/emergency-rules/new'}
        />
      ) : (
        <div className="card p-0 overflow-hidden mb-8">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="table-header px-6 py-3">Priority</th>
                  <th className="table-header px-6 py-3">Rule Name</th>
                  <th className="table-header px-6 py-3">Escalation</th>
                  <th className="table-header px-6 py-3">Conditions</th>
                  <th className="table-header px-6 py-3">Status</th>
                  <th className="table-header px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => {
                  const conditions = rule.symptom_conditions as {
                    any_of?: string[];
                    all_of?: string[];
                  };
                  return (
                    <tr key={rule.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="table-cell font-mono">{rule.priority}</td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-gray-900">{rule.rule_name}</p>
                        <p className="text-xs text-gray-500" dir="rtl">{rule.description_ar?.slice(0, 60)}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`badge ${ESCALATION_COLORS[rule.escalation_type] ?? 'badge-gray'}`}>
                          {rule.escalation_type.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-500 font-mono">
                        {conditions.any_of?.join(', ') ?? ''}
                        {conditions.all_of ? ` + ${conditions.all_of.join(', ')}` : ''}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => toggleActive(rule)}
                          className={`badge cursor-pointer ${rule.is_active ? 'badge-green' : 'badge-gray'}`}
                        >
                          {rule.is_active ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <Link href={`/emergency-rules/${rule.id}/edit`} className="text-teal-600 hover:text-teal-800 text-sm font-medium">
                          Edit
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Test Panel */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Test Emergency Rules</h2>
        <p className="text-sm text-gray-500 mb-3">Enter comma-separated symptom keywords to test which rules trigger.</p>
        <div className="flex gap-3 mb-4">
          <input
            type="text"
            value={testSymptoms}
            onChange={(e) => setTestSymptoms(e.target.value)}
            placeholder="chest_pain, shortness_of_breath, dizziness"
            className="input-field flex-1"
          />
          <button onClick={handleTest} disabled={testLoading} className="btn-primary">
            {testLoading ? 'Testing...' : 'Test'}
          </button>
        </div>
        {testResults.length > 0 && (
          <div className="space-y-3">
            {testResults.map((r, i) => (
              <div key={i} className="border border-red-200 bg-red-50 rounded-lg p-3">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="text-sm font-medium text-red-900">{r.rule_name}</p>
                    <span className={`badge ${ESCALATION_COLORS[r.escalation_type] ?? 'badge-gray'} mt-1`}>
                      {r.escalation_type.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">Priority: {r.priority}</span>
                </div>
                <p className="text-sm text-gray-700 mt-2" dir="rtl">{r.response_ar}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
