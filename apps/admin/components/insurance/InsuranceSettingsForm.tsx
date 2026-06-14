'use client';

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';

// ─── Types ───────────────────────────────────────────────────────────────────

interface InsuranceSettings {
  require_preauth_above_egp: number | null;
  preauth_sla_hours: number;
  default_reimbursement_pct: number;
  claim_submission_deadline_days: number;
  auto_approve_under_egp: number | null;
  allow_partial_approval: boolean;
}

const DEFAULT_SETTINGS: InsuranceSettings = {
  require_preauth_above_egp: 5000,
  preauth_sla_hours: 24,
  default_reimbursement_pct: 80,
  claim_submission_deadline_days: 30,
  auto_approve_under_egp: null,
  allow_partial_approval: true,
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function InsuranceSettingsForm() {
  const [settings, setSettings] = useState<InsuranceSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseBrowser();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      const headers: Record<string, string> = token
        ? { Authorization: `Bearer ${token}` }
        : {};

      const res = await fetch('/api/admin/insurance/settings', { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.settings) {
          setSettings({ ...DEFAULT_SETTINGS, ...data.settings });
        }
      }
    } catch {
      // Use defaults
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const supabase = getSupabaseBrowser();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      const res = await fetch('/api/admin/insurance/settings', {
        method: 'PUT',
        headers,
        body: JSON.stringify(settings),
      });

      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch {
      // Silently fail
    } finally {
      setSaving(false);
    }
  };

  // ─── Loading ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6 animate-pulse h-96" />
    );
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6" dir="rtl">
      {/* Pre-Auth Rules */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">قواعد الموافقة المسبقة</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-600 mb-1">
              تتطلب موافقة مسبقة فوق (ج.م)
            </label>
            <input
              type="number"
              value={settings.require_preauth_above_egp ?? ''}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  require_preauth_above_egp: e.target.value ? Number(e.target.value) : null,
                })
              }
              placeholder="5000"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            />
            <p className="text-xs text-gray-400 mt-1">اتركها فارغة لعدم وجود حد أدنى</p>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">
              موافقة تلقائية تحت (ج.م)
            </label>
            <input
              type="number"
              value={settings.auto_approve_under_egp ?? ''}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  auto_approve_under_egp: e.target.value ? Number(e.target.value) : null,
                })
              }
              placeholder="اختياري"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            />
            <p className="text-xs text-gray-400 mt-1">الموافقة التلقائية على المطالبات أقل من هذا المبلغ</p>
          </div>
        </div>
      </div>

      {/* SLA & Deadlines */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">المواعيد و SLA</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-600 mb-1">
              مهلة الموافقة المسبقة (ساعات)
            </label>
            <input
              type="number"
              value={settings.preauth_sla_hours}
              onChange={(e) =>
                setSettings({ ...settings, preauth_sla_hours: Number(e.target.value) || 24 })
              }
              min="1"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">
              مهلة تقديم المطالبة (أيام)
            </label>
            <input
              type="number"
              value={settings.claim_submission_deadline_days}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  claim_submission_deadline_days: Number(e.target.value) || 30,
                })
              }
              min="1"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            />
          </div>
        </div>
      </div>

      {/* Reimbursement */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">التسوية المالية</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-600 mb-1">
              نسبة التعويض الافتراضية %
            </label>
            <input
              type="number"
              value={settings.default_reimbursement_pct}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  default_reimbursement_pct: Number(e.target.value) || 80,
                })
              }
              min="0"
              max="100"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            />
          </div>
          <div className="flex items-center gap-3 mt-5">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.allow_partial_approval}
                onChange={(e) =>
                  setSettings({ ...settings, allow_partial_approval: e.target.checked })
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-500 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600" />
            </label>
            <span className="text-sm text-gray-700">السماح بالموافقة الجزئية</span>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
        >
          {saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
        </button>
        {saved && (
          <span className="text-sm text-green-600 font-medium">تم الحفظ بنجاح</span>
        )}
      </div>
    </div>
  );
}
