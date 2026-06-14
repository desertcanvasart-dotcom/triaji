'use client';

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PaymentSummary {
  totalRevenue: number;
  paidCash: number;
  paidOnline: number;
  unpaid: number;
  totalTransactions: number;
  byProvider: Record<string, { count: number; amount: number }>;
  period: string;
}

interface UnpaidTransaction {
  id: string;
  triaji_reference: string;
  amount_egp: number;
  provider: string;
  payable_type: string;
  patient_name: string;
  patient_phone: string;
  created_at: string;
}

type Period = 'week' | 'month' | 'all';

const PERIOD_LABELS: Record<Period, string> = {
  week: 'الأسبوع',
  month: 'الشهر',
  all: 'الكل',
};

const PROVIDER_LABELS: Record<string, string> = {
  fawry: 'فوري',
  paymob: 'بطاقة بنكية',
  vodafone_cash: 'فودافون كاش',
};

function formatAmount(amount: number): string {
  return amount.toLocaleString('ar-EG') + ' ج.م';
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('ar-EG', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PaymentStatsPanel({ tenantId }: { tenantId: string }) {
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [unpaidList, setUnpaidList] = useState<UnpaidTransaction[]>([]);
  const [period, setPeriod] = useState<Period>('month');
  const [loading, setLoading] = useState(true);
  const [showUnpaid, setShowUnpaid] = useState(false);
  const [sendingReminder, setSendingReminder] = useState<string | null>(null);

  const getHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const supabase = getSupabaseBrowser();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await getHeaders();
      const res = await fetch(`/api/admin/payments/summary?period=${period}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setSummary(data);
      }
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }, [period, getHeaders]);

  const fetchUnpaid = useCallback(async () => {
    try {
      const supabase = getSupabaseBrowser();
      const { data } = await supabase
        .from('payment_transactions')
        .select(`
          id, triaji_reference, amount_egp, provider, payable_type, created_at,
          patients:patient_id ( full_name_ar, phone )
        `)
        .eq('status', 'pending')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (data) {
        setUnpaidList(
          data.map((txn) => {
            const patient = txn.patients as unknown as Record<string, string> | null;
            return {
              id: txn.id as string,
              triaji_reference: txn.triaji_reference as string,
              amount_egp: Number(txn.amount_egp),
              provider: txn.provider as string,
              payable_type: txn.payable_type as string,
              patient_name: patient?.full_name_ar ?? '-',
              patient_phone: patient?.phone ?? '',
              created_at: txn.created_at as string,
            };
          }),
        );
      }
    } catch {
      // Silent fail
    }
  }, [tenantId]);

  useEffect(() => {
    fetchSummary();
    fetchUnpaid();
  }, [fetchSummary, fetchUnpaid]);

  const sendReminder = async (txnId: string) => {
    setSendingReminder(txnId);
    try {
      const headers = await getHeaders();
      const res = await fetch('/api/admin/payments/reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ payment_transaction_id: txnId }),
      });
      if (res.ok) {
        alert('تم إرسال التذكير بنجاح');
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? 'فشل إرسال التذكير');
      }
    } catch {
      alert('خطأ في الاتصال');
    } finally {
      setSendingReminder(null);
    }
  };

  if (loading || !summary) {
    return (
      <div className="animate-pulse space-y-3" dir="rtl">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4" dir="rtl">
      {/* Period Selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500">الفترة:</span>
        {(['week', 'month', 'all'] as Period[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriod(p)}
            className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
              period === p
                ? 'bg-teal-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
          <p className="text-xs text-gray-500 mb-1">إجمالي الإيرادات</p>
          <p className="text-xl font-bold text-emerald-700">{formatAmount(summary.totalRevenue)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
          <p className="text-xs text-gray-500 mb-1">كاش / كارت</p>
          <p className="text-xl font-bold text-blue-700">{formatAmount(summary.paidCash)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
          <p className="text-xs text-gray-500 mb-1">دفع أونلاين</p>
          <p className="text-xl font-bold text-teal-700">{formatAmount(summary.paidOnline)}</p>
          {/* Provider breakdown */}
          {summary.paidOnline > 0 && (
            <div className="mt-2 space-y-1">
              {Object.entries(summary.byProvider).map(([provider, data]) =>
                data.amount > 0 ? (
                  <div key={provider} className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">{PROVIDER_LABELS[provider] ?? provider}</span>
                    <span className="text-gray-700 font-medium">{formatAmount(data.amount)}</span>
                  </div>
                ) : null,
              )}
            </div>
          )}
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
          <p className="text-xs text-gray-500 mb-1">غير مدفوع</p>
          <p className="text-xl font-bold text-yellow-700">{formatAmount(summary.unpaid)}</p>
        </div>
      </div>

      {/* Unpaid Invoices Section */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
        <button
          type="button"
          onClick={() => setShowUnpaid(!showUnpaid)}
          className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <span>
            غير مدفوعة ({unpaidList.length})
          </span>
          <span className="text-gray-400">{showUnpaid ? '\u25B2' : '\u25BC'}</span>
        </button>

        {showUnpaid && (
          <div className="border-t border-gray-100">
            {unpaidList.length === 0 ? (
              <div className="text-center py-6 text-gray-400 text-sm">
                لا توجد فواتير غير مدفوعة
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="text-right px-4 py-2 font-medium">المرجع</th>
                      <th className="text-right px-4 py-2 font-medium">المريض</th>
                      <th className="text-right px-4 py-2 font-medium">المبلغ</th>
                      <th className="text-right px-4 py-2 font-medium">طريقة الدفع</th>
                      <th className="text-right px-4 py-2 font-medium">التاريخ</th>
                      <th className="text-right px-4 py-2 font-medium">إجراء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {unpaidList.map((txn) => (
                      <tr key={txn.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 font-mono text-xs" dir="ltr">
                          {txn.triaji_reference}
                        </td>
                        <td className="px-4 py-2">{txn.patient_name}</td>
                        <td className="px-4 py-2">{formatAmount(txn.amount_egp)}</td>
                        <td className="px-4 py-2 text-xs">
                          {PROVIDER_LABELS[txn.provider] ?? txn.provider}
                        </td>
                        <td className="px-4 py-2 text-xs text-gray-500">{formatDate(txn.created_at)}</td>
                        <td className="px-4 py-2">
                          <button
                            type="button"
                            onClick={() => sendReminder(txn.id)}
                            disabled={sendingReminder === txn.id}
                            className="text-teal-600 hover:text-teal-700 text-xs font-medium disabled:opacity-50"
                          >
                            {sendingReminder === txn.id ? 'جاري الإرسال...' : 'إرسال تذكير'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
