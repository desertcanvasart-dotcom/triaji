'use client';

import { useState, useEffect, useCallback } from 'react';
import { t, type Lang } from '@triaji/shared/i18n';
import InsurancePolicyForm from './InsurancePolicyForm';

// ─── Types ───────────────────────────────────────────────────────────────────

interface InsuranceSectionProps {
  lang: Lang;
}

interface PolicyData {
  id: string;
  insurer_code: string;
  insurer_name: string;
  policy_number: string;
  status: 'active' | 'suspended' | 'expired' | 'pending_verification' | 'unverified';
  annual_limit_egp: number | null;
  used_limit_egp: number;
  remaining_limit_egp: number | null;
  copay_pct: number;
  coverage_end: string | null;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function InsuranceSection({ lang }: InsuranceSectionProps) {
  const isRtl = lang === 'ar';
  const [policy, setPolicy] = useState<PolicyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const fetchPolicy = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/patient/insurance/policy');
      if (res.ok) {
        const data = await res.json();
        setPolicy(data.policy ?? null);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPolicy();
  }, [fetchPolicy]);

  const handlePolicySaved = () => {
    setShowForm(false);
    fetchPolicy();
  };

  // ─── Loading ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-5 animate-pulse h-32" />
    );
  }

  // ─── No Policy ───────────────────────────────────────────────────────────

  if (!policy) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-5" dir={isRtl ? 'rtl' : 'ltr'}>
        {!showForm ? (
          <div className="text-center py-6">
            <span className="text-3xl mb-2 block">🛡️</span>
            <p className="text-gray-500 text-sm mb-1">{t('insurance.noInsurance', lang)}</p>
            <p className="text-gray-400 text-xs mb-4">{t('insurance.noInsuranceMsg', lang)}</p>
            <button
              onClick={() => setShowForm(true)}
              className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
            >
              {t('insurance.addPolicy', lang)}
            </button>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">{t('insurance.addPolicy', lang)}</h3>
              <button
                onClick={() => setShowForm(false)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                {t('common.cancel', lang)}
              </button>
            </div>
            <InsurancePolicyForm lang={lang} onSaved={handlePolicySaved} />
          </div>
        )}
      </div>
    );
  }

  // ─── Pending Verification ────────────────────────────────────────────────

  if (policy.status === 'pending_verification' || policy.status === 'unverified') {
    return (
      <div className="bg-white rounded-xl shadow-sm p-5" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-yellow-50 flex items-center justify-center text-lg flex-shrink-0">
            ⏳
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">{t('insurance.myInsurance', lang)}</h3>
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                {t('insurance.pendingVerification', lang)}
              </span>
            </div>
            <p className="text-sm text-gray-600 mt-1">{policy.insurer_name}</p>
            <p className="text-xs text-gray-400 mt-0.5 font-mono">{policy.policy_number}</p>
            <p className="text-xs text-yellow-600 mt-2">
              {t('insurance.pendingVerificationMsg', lang)}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Expired or Suspended ────────────────────────────────────────────────

  if (policy.status === 'expired' || policy.status === 'suspended') {
    const isExpired = policy.status === 'expired';
    return (
      <div className="bg-white rounded-xl shadow-sm p-5" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-lg">🚫</span>
            <div>
              <h3 className="font-semibold text-red-800">
                {isExpired ? t('insurance.policyExpired', lang) : t('insurance.policySuspended', lang)}
              </h3>
              <p className="text-sm text-red-600 mt-1">{policy.insurer_name}</p>
              <p className="text-xs text-red-500 mt-0.5 font-mono">{policy.policy_number}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Active / Verified — Coverage Breakdown ──────────────────────────────

  return (
    <div className="bg-white rounded-xl shadow-sm p-5" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center text-lg">
            🛡️
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{t('insurance.myInsurance', lang)}</h3>
            <p className="text-sm text-gray-500">{policy.insurer_name}</p>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
          {t('insurance.verified', lang)}
        </span>
      </div>

      {/* Coverage Breakdown */}
      <div className="space-y-3">
        <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider">
          {t('insurance.coverageBreakdown', lang)}
        </h4>

        {/* Remaining Limit */}
        {policy.remaining_limit_egp != null && policy.annual_limit_egp != null && (
          <div>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-gray-600">{t('insurance.remainingLimit', lang)}</span>
              <span className="font-bold text-gray-900">
                {policy.remaining_limit_egp.toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-EG')} {lang === 'ar' ? 'ج.م' : 'EGP'}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-emerald-500 h-2 rounded-full transition-all"
                style={{
                  width: `${Math.min(100, (policy.remaining_limit_egp / policy.annual_limit_egp) * 100)}%`,
                }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {policy.remaining_limit_egp.toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-EG')} / {policy.annual_limit_egp.toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-EG')} {lang === 'ar' ? 'ج.م' : 'EGP'}
            </p>
          </div>
        )}

        {/* Copay & Validity */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500">{t('insurance.copay', lang)}</p>
            <p className="text-lg font-bold text-gray-900 mt-0.5">{policy.copay_pct}%</p>
          </div>
          {policy.coverage_end && (
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">{t('insurance.validUntil', lang)}</p>
              <p className="text-sm font-bold text-gray-900 mt-0.5">
                {new Date(policy.coverage_end).toLocaleDateString(
                  lang === 'ar' ? 'ar-EG' : 'en-GB',
                  { year: 'numeric', month: 'short', day: 'numeric' }
                )}
              </p>
            </div>
          )}
        </div>

        {/* Policy Number */}
        <div className="text-xs text-gray-400 font-mono pt-1">
          {t('insurance.policyNumber', lang)}: {policy.policy_number}
        </div>
      </div>
    </div>
  );
}
