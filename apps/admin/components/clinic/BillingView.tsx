'use client';

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import InvoiceForm from './InvoiceForm';

interface Doctor {
  id: string;
  name_ar: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  patient_name: string;
  doctor_id: string | null;
  subtotal: number;
  patient_pays: number;
  status: 'draft' | 'issued' | 'paid' | 'cancelled';
  payment_method: string;
  created_at: string;
}

interface DailySummary {
  total_revenue: number;
  total_invoices: number;
  by_payment_method: Record<string, { count: number; amount: number }>;
}

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  draft: { label: 'مسودة', className: 'bg-gray-100 text-gray-600' },
  issued: { label: 'صادرة', className: 'bg-yellow-100 text-yellow-700' },
  paid: { label: 'مدفوعة', className: 'bg-green-100 text-green-700' },
  cancelled: { label: 'ملغاة', className: 'bg-red-100 text-red-600' },
};

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'كاش',
  card: 'كارت',
  insurance: 'تأمين',
  bank_transfer: 'تحويل بنكي',
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function BillingView({
  tenantId,
  doctors,
}: {
  tenantId: string;
  doctors: Doctor[];
}) {
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  const getHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const supabase = getSupabaseBrowser();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await getHeaders();
      const res = await fetch(`/api/admin/invoices?date=${selectedDate}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setInvoices(data.invoices ?? data ?? []);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [selectedDate, getHeaders]);

  const fetchSummary = useCallback(async () => {
    try {
      const headers = await getHeaders();
      const res = await fetch(`/api/admin/invoices/daily-summary?date=${selectedDate}`, {
        headers,
      });
      if (res.ok) {
        setSummary(await res.json());
      }
    } catch {
      // Silently fail
    }
  }, [selectedDate, getHeaders]);

  useEffect(() => {
    fetchInvoices();
    fetchSummary();
  }, [fetchInvoices, fetchSummary]);

  async function markAsPaid(invoiceId: string) {
    try {
      const headers = await getHeaders();
      const res = await fetch(`/api/admin/invoices/${invoiceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ status: 'paid' }),
      });
      if (res.ok) {
        fetchInvoices();
        fetchSummary();
      }
    } catch {
      // Silently fail
    }
  }

  function getDoctorName(doctorId: string | null) {
    if (!doctorId) return '-';
    return doctors.find((d) => d.id === doctorId)?.name_ar ?? '-';
  }

  return (
    <div className="space-y-5" dir="rtl">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
          dir="ltr"
        />
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors"
        >
          &#10133; فاتورة جديدة
        </button>
      </div>

      {/* Invoice Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center pt-10 px-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 my-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">فاتورة جديدة</h2>
            <InvoiceForm
              tenantId={tenantId}
              doctors={doctors}
              onSaved={() => {
                setShowForm(false);
                fetchInvoices();
                fetchSummary();
              }}
              onCancel={() => setShowForm(false)}
            />
          </div>
        </div>
      )}

      {/* Invoice Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="animate-pulse p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 bg-gray-100 rounded" />
            ))}
          </div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400 text-sm">لا توجد فواتير لهذا التاريخ</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-right px-4 py-3 font-medium">رقم الفاتورة</th>
                  <th className="text-right px-4 py-3 font-medium">المريض</th>
                  <th className="text-right px-4 py-3 font-medium">الطبيب</th>
                  <th className="text-right px-4 py-3 font-medium">الإجمالي</th>
                  <th className="text-right px-4 py-3 font-medium">المريض يدفع</th>
                  <th className="text-right px-4 py-3 font-medium">الحالة</th>
                  <th className="text-right px-4 py-3 font-medium">الدفع</th>
                  <th className="text-right px-4 py-3 font-medium">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invoices.map((inv) => {
                  const badge = STATUS_BADGES[inv.status] ?? { label: 'مسودة', className: 'bg-gray-100 text-gray-600' };
                  return (
                    <tr key={inv.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs" dir="ltr">
                        {inv.invoice_number}
                      </td>
                      <td className="px-4 py-3">{inv.patient_name}</td>
                      <td className="px-4 py-3">{getDoctorName(inv.doctor_id)}</td>
                      <td className="px-4 py-3">{inv.subtotal.toLocaleString('ar-EG')} ج.م</td>
                      <td className="px-4 py-3 font-medium">
                        {inv.patient_pays.toLocaleString('ar-EG')} ج.م
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {PAYMENT_LABELS[inv.payment_method] ?? inv.payment_method}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <a
                            href={`/api/admin/invoices/${inv.id}/pdf`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-teal-600 hover:text-teal-700 text-xs font-medium"
                          >
                            PDF
                          </a>
                          {inv.status !== 'paid' && inv.status !== 'cancelled' && (
                            <button
                              type="button"
                              onClick={() => markAsPaid(inv.id)}
                              className="text-green-600 hover:text-green-700 text-xs font-medium"
                            >
                              تحصيل
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Daily Summary (Collapsible) */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setShowSummary(!showSummary)}
          className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <span>ملخص اليوم</span>
          <span className="text-gray-400">{showSummary ? '▲' : '▼'}</span>
        </button>
        {showSummary && summary && (
          <div className="px-5 pb-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-emerald-50 rounded-lg p-4">
                <p className="text-xs text-gray-500">إجمالي الإيرادات</p>
                <p className="text-xl font-bold text-emerald-700 mt-1">
                  {summary.total_revenue.toLocaleString('ar-EG')} ج.م
                </p>
              </div>
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-xs text-gray-500">عدد الفواتير</p>
                <p className="text-xl font-bold text-blue-700 mt-1">{summary.total_invoices}</p>
              </div>
            </div>

            {Object.keys(summary.by_payment_method).length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-2">حسب طريقة الدفع</p>
                <div className="space-y-2">
                  {Object.entries(summary.by_payment_method).map(([method, data]) => (
                    <div
                      key={method}
                      className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-2"
                    >
                      <span className="text-sm text-gray-700">
                        {PAYMENT_LABELS[method] ?? method}
                      </span>
                      <div className="flex items-center gap-3 text-sm">
                        <span className="text-gray-500">{data.count} فاتورة</span>
                        <span className="font-medium">
                          {data.amount.toLocaleString('ar-EG')} ج.م
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
