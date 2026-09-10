'use client';

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PaymentConfig {
  accepts_online_payment: boolean;
  payment_providers: string[];
  fawry_merchant_code: string;
  paymob_integration_id: string;
  vf_merchant_code: string;
}

const PROVIDER_OPTIONS = [
  {
    key: 'fawry',
    label: 'فوري',
    icon: '🏪',
    description: 'دفع عبر أكواد فوري (عبر المحلات أو التطبيق)',
    fields: [
      { key: 'fawry_merchant_code', label: 'كود التاجر (Merchant Code)', placeholder: 'FW-XXXXXX' },
    ],
  },
  {
    key: 'paymob',
    label: 'بطاقة بنكية (Paymob)',
    icon: '💳',
    description: 'دفع عبر بطاقات الائتمان والخصم',
    fields: [
      { key: 'paymob_integration_id', label: 'Integration ID', placeholder: 'XXXXX' },
    ],
  },
  {
    key: 'vodafone_cash',
    label: 'فودافون كاش',
    icon: '📱',
    description: 'دفع عبر محفظة فودافون كاش',
    fields: [
      { key: 'vf_merchant_code', label: 'كود التاجر', placeholder: 'VC-XXXXXX' },
    ],
  },
] as const;

// ─── Component ────────────────────────────────────────────────────────────────

export default function PaymentSettingsSection({
  tenantId,
}: {
  tenantId: string;
}) {
  const [config, setConfig] = useState<PaymentConfig>({
    accepts_online_payment: false,
    payment_providers: [],
    fawry_merchant_code: '',
    paymob_integration_id: '',
    vf_merchant_code: '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load existing config
  useEffect(() => {
    async function load() {
      try {
        const supabase = getSupabaseBrowser();
        const { data } = await supabase
          .from('tenant_config')
          .select(
            'accepts_online_payment, payment_providers, fawry_merchant_code, paymob_integration_id, vf_merchant_code',
          )
          .eq('tenant_id', tenantId)
          .single();

        if (data) {
          setConfig({
            accepts_online_payment: (data.accepts_online_payment as boolean) ?? false,
            payment_providers: (data.payment_providers as string[]) ?? [],
            fawry_merchant_code: (data.fawry_merchant_code as string) ?? '',
            paymob_integration_id: (data.paymob_integration_id as string) ?? '',
            vf_merchant_code: (data.vf_merchant_code as string) ?? '',
          });
        }
      } catch {
        // Silent — use defaults
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [tenantId]);

  function toggleProvider(providerKey: string) {
    setConfig((prev) => {
      const providers = prev.payment_providers.includes(providerKey)
        ? prev.payment_providers.filter((p) => p !== providerKey)
        : [...prev.payment_providers, providerKey];
      return { ...prev, payment_providers: providers };
    });
    setSaved(false);
  }

  function updateField(key: string, value: string | boolean) {
    setConfig((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const supabase = getSupabaseBrowser();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch('/api/admin/clinic/payment-settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ tenantId, ...config }),
      });

      if (res.ok) {
        setSaved(true);
      } else {
        // Fallback: direct Supabase upsert
        await supabase
          .from('tenant_config')
          .upsert(
            {
              tenant_id: tenantId,
              accepts_online_payment: config.accepts_online_payment,
              payment_providers: config.payment_providers,
              fawry_merchant_code: config.fawry_merchant_code,
              paymob_integration_id: config.paymob_integration_id,
              vf_merchant_code: config.vf_merchant_code,
            },
            { onConflict: 'tenant_id' },
          );
        setSaved(true);
      }
    } catch {
      // Silent fail
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section className="bg-white rounded-xl shadow-sm p-5 space-y-4 animate-pulse" dir="rtl">
        <div className="h-6 bg-gray-100 rounded w-48" />
        <div className="h-20 bg-gray-100 rounded" />
      </section>
    );
  }

  return (
    <section className="bg-white rounded-xl shadow-sm p-5 space-y-5" dir="rtl">
      <div>
        <h2 className="text-base font-semibold text-gray-900">
          &#128179; إعدادات الدفع الأونلاين
        </h2>
        <p className="text-xs text-gray-400 mt-1">
          فعّل الدفع الأونلاين ليقدر المرضى يدفعوا من الموبايل
        </p>
      </div>

      {/* Main Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-700">قبول الدفع الأونلاين</p>
          <p className="text-xs text-gray-400">
            المرضى يقدروا يدفعوا عبر فوري، بطاقة بنكية، أو فودافون كاش
          </p>
        </div>
        <button
          type="button"
          onClick={() => updateField('accepts_online_payment', !config.accepts_online_payment)}
          className={`relative w-11 h-6 rounded-full transition-colors ${
            config.accepts_online_payment ? 'bg-teal-600' : 'bg-gray-300'
          }`}
        >
          <span
            className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
              config.accepts_online_payment ? 'right-0.5' : 'right-[22px]'
            }`}
          />
        </button>
      </div>

      {/* Provider Selection — only shown when online payment enabled */}
      {config.accepts_online_payment && (
        <div className="space-y-4 border-t border-gray-100 pt-4">
          <p className="text-sm font-medium text-gray-700">طرق الدفع المتاحة</p>

          {PROVIDER_OPTIONS.map((provider) => {
            const isEnabled = config.payment_providers.includes(provider.key);
            return (
              <div
                key={provider.key}
                className={`rounded-xl border-2 p-4 transition-colors ${
                  isEnabled ? 'border-teal-500 bg-teal-50/50' : 'border-gray-200 bg-white'
                }`}
              >
                {/* Provider header with toggle */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{provider.icon}</span>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{provider.label}</p>
                      <p className="text-xs text-gray-500">{provider.description}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleProvider(provider.key)}
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      isEnabled ? 'bg-teal-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        isEnabled ? 'right-0.5' : 'right-[22px]'
                      }`}
                    />
                  </button>
                </div>

                {/* Merchant code inputs — only shown when provider is enabled */}
                {isEnabled && (
                  <div className="mt-3 space-y-3 border-t border-gray-200 pt-3">
                    {provider.fields.map((field) => (
                      <div key={field.key}>
                        <label className="block text-xs text-gray-600 mb-1">{field.label}</label>
                        <input
                          type="text"
                          value={(config as unknown as Record<string, string | boolean | string[]>)[field.key] as string ?? ''}
                          onChange={(e) => updateField(field.key, e.target.value)}
                          placeholder={field.placeholder}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none font-mono"
                          dir="ltr"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Save Button */}
      <div className="flex items-center gap-3 border-t border-gray-100 pt-4">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="bg-teal-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50 transition-colors"
        >
          {saving ? 'جارٍ الحفظ...' : 'حفظ إعدادات الدفع'}
        </button>
        {saved && (
          <span className="text-sm text-green-600 font-medium">تم الحفظ بنجاح</span>
        )}
      </div>
    </section>
  );
}
