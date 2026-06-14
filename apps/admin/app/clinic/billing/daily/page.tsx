'use client';

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';

interface DailySummary {
  total_revenue: number;
  total_invoices: number;
  paid_count: number;
  unpaid_count: number;
  by_payment_method: Record<string, { count: number; amount: number }>;
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'كاش',
  card: 'كارت',
  insurance: 'تأمين',
  bank_transfer: 'تحويل بنكي',
};

const PAYMENT_COLORS: Record<string, string> = {
  cash: 'bg-green-50 border-green-200',
  card: 'bg-blue-50 border-blue-200',
  insurance: 'bg-purple-50 border-purple-200',
  bank_transfer: 'bg-amber-50 border-amber-200',
};

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function DailySummaryPage() {
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseBrowser();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch(`/api/admin/invoices/daily-summary?date=${selectedDate}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (res.ok) {
        setSummary(await res.json());
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">تقرير يومي</h1>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
          dir="ltr"
        />
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm animate-pulse h-24" />
          ))}
        </div>
      ) : !summary ? (
        <div className="text-center py-12">
          <p className="text-gray-400 text-sm">لا توجد بيانات لهذا التاريخ</p>
        </div>
      ) : (
        <>
          {/* Main Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl shadow-sm p-5">
              <p className="text-xs text-gray-500">إجمالي الإيرادات</p>
              <p className="text-2xl font-bold text-emerald-700 mt-1">
                {summary.total_revenue.toLocaleString('ar-EG')} ج.م
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-5">
              <p className="text-xs text-gray-500">عدد الفواتير</p>
              <p className="text-2xl font-bold text-blue-700 mt-1">{summary.total_invoices}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-5">
              <p className="text-xs text-gray-500">مدفوعة</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{summary.paid_count}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-5">
              <p className="text-xs text-gray-500">غير مدفوعة</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">{summary.unpaid_count}</p>
            </div>
          </div>

          {/* Breakdown by Payment Method */}
          {Object.keys(summary.by_payment_method).length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">حسب طريقة الدفع</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(summary.by_payment_method).map(([method, data]) => (
                  <div
                    key={method}
                    className={`rounded-xl border p-5 ${PAYMENT_COLORS[method] ?? 'bg-gray-50 border-gray-200'}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-700">
                          {PAYMENT_LABELS[method] ?? method}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">{data.count} فاتورة</p>
                      </div>
                      <p className="text-xl font-bold text-gray-900">
                        {data.amount.toLocaleString('ar-EG')} ج.م
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state for no payment methods */}
          {summary.total_invoices === 0 && (
            <div className="bg-white rounded-xl shadow-sm text-center py-12">
              <p className="text-gray-400 text-sm">لا توجد فواتير لهذا التاريخ</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
