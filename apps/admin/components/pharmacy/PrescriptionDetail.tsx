'use client';

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';

// ─── Types ───────────────────────────────────────────────────────────────────

type StockStatus = 'in_stock' | 'out_of_stock' | 'substitute';

interface MedicationItem {
  id: string;
  drug_name_ar: string;
  drug_name_en: string | null;
  dose: string;
  frequency: string;
  duration: string;
  stock_status: StockStatus | null;
  substitute_name: string | null;
}

interface PrescriptionData {
  id: string;
  routing_id: string;
  status: string;
  patient_name: string;
  doctor_name: string;
  doctor_note: string | null;
  routed_at: string;
  items: MedicationItem[];
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function PrescriptionDetail({ routingId }: { routingId: string }) {
  const [prescription, setPrescription] = useState<PrescriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [stockStatuses, setStockStatuses] = useState<Record<string, StockStatus>>({});
  const [substituteNames, setSubstituteNames] = useState<Record<string, string>>({});
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const supabase = getSupabaseBrowser();
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const fetchPrescription = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/admin/pharmacy/prescriptions/${routingId}`, { headers });
      if (res.ok) {
        const data = await res.json();
        // The API returns { prescription: <routing row with nested joins> }. Patient/doctor
        // come from joins, items from health_records.prescription_items (real columns), and
        // per-item stock state from the stock_confirmation jsonb on the routing.
        const p = data.prescription ?? data;
        const hr = Array.isArray(p.health_records) ? p.health_records[0] : p.health_records;
        const stockConf: Array<Record<string, any>> = Array.isArray(p.stock_confirmation) ? p.stock_confirmation : [];
        const stockByItem = new Map(stockConf.map((s) => [s.item_id, s]));
        const normalized: PrescriptionData = {
          id: p.id,
          routing_id: p.id,
          status: p.status,
          patient_name: p.patients?.name_ar ?? '',
          doctor_name: p.doctors?.name_ar ?? '',
          doctor_note: p.routing_note_ar ?? null,
          routed_at: p.routed_at,
          items: (hr?.prescription_items ?? []).map((it: Record<string, any>) => {
            const sc = stockByItem.get(it.id);
            return {
              id: it.id,
              drug_name_ar: it.drug_name_ar,
              drug_name_en: it.drug_name_en ?? null,
              dose: it.dose ?? '',
              frequency: it.frequency_ar ?? '',
              duration: it.duration_ar ?? '',
              stock_status: (sc?.stock_status as StockStatus) ?? null,
              substitute_name: sc?.substitute_name ?? null,
            };
          }),
        };
        setPrescription(normalized);

        // Initialize stock statuses from existing stock_confirmation
        const statuses: Record<string, StockStatus> = {};
        const subs: Record<string, string> = {};
        normalized.items.forEach((item) => {
          if (item.stock_status) statuses[item.id] = item.stock_status;
          if (item.substitute_name) subs[item.id] = item.substitute_name;
        });
        setStockStatuses(statuses);
        setSubstituteNames(subs);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [routingId, getAuthHeaders]);

  useEffect(() => {
    fetchPrescription();
  }, [fetchPrescription]);

  // ─── Actions ──────────────────────────────────────────────────────────────

  async function handleAction(action: string) {
    setActionLoading(action);
    setSuccessMessage(null);
    try {
      const headers = await getAuthHeaders();
      const body: Record<string, unknown> = {};

      if (action === 'stock') {
        // The stock route expects { stock_confirmation: [...] } (stored as jsonb).
        body.stock_confirmation = Object.entries(stockStatuses).map(([itemId, status]) => ({
          item_id: itemId,
          stock_status: status,
          substitute_name: status === 'substitute' ? substituteNames[itemId] ?? null : null,
        }));
      }

      const res = await fetch(`/api/admin/pharmacy/prescriptions/${routingId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setSuccessMessage(
          action === 'confirm' ? 'تم تأكيد الاستلام' :
          action === 'stock' ? 'تم حفظ فحص المخزون' :
          action === 'ready' ? 'تم التحديث — جاهزة للاستلام' :
          action === 'collect' ? 'تم تأكيد استلام المريض' : 'تم'
        );
        fetchPrescription();
      }
    } catch {
      // Silently fail
    } finally {
      setActionLoading(null);
    }
  }

  function updateStockStatus(itemId: string, status: StockStatus) {
    setStockStatuses((prev) => ({ ...prev, [itemId]: status }));
  }

  function updateSubstituteName(itemId: string, name: string) {
    setSubstituteNames((prev) => ({ ...prev, [itemId]: name }));
  }

  // ─── Loading ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl shadow-sm p-5 animate-pulse h-20" />
        ))}
      </div>
    );
  }

  if (!prescription) {
    return (
      <div className="text-center py-16">
        <span className="text-4xl mb-3 block">❌</span>
        <p className="text-gray-500 text-sm">لم يتم العثور على الوصفة</p>
      </div>
    );
  }

  const isRouted = prescription.status === 'routed';
  const isReady = prescription.status === 'ready' || prescription.status === 'partial_ready';
  const isCollected = prescription.status === 'collected';

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6" dir="rtl">
      {/* Success Message */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
          <p className="text-sm text-green-700 font-medium">{successMessage}</p>
        </div>
      )}

      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-5 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">{prescription.patient_name}</h2>
          <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">
            {prescription.status}
          </span>
        </div>
        <p className="text-sm text-gray-600">الطبيب: {prescription.doctor_name}</p>
        <p className="text-xs text-gray-400">
          التاريخ: {new Date(prescription.routed_at).toLocaleDateString('ar-EG')}
        </p>
        <p className="text-xs text-gray-400">
          رقم المرجع: <span className="font-mono" dir="ltr">{prescription.routing_id}</span>
        </p>
      </div>

      {/* Doctor's Note */}
      {prescription.doctor_note && (
        <div className="bg-blue-50 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-blue-900 mb-1">ملاحظات الطبيب</h3>
          <p className="text-sm text-blue-800">{prescription.doctor_note}</p>
        </div>
      )}

      {/* Medication List */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="bg-gray-50 px-5 py-3 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">الأدوية ({prescription.items.length})</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {prescription.items.map((item) => {
            const currentStock = stockStatuses[item.id] ?? null;

            return (
              <div key={item.id} className="px-5 py-4 space-y-3">
                {/* Drug Info */}
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {item.drug_name_ar}
                    {item.drug_name_en && (
                      <span className="text-gray-400 font-normal mr-2" dir="ltr">
                        ({item.drug_name_en})
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {item.dose} — {item.frequency} — {item.duration}
                  </p>
                </div>

                {/* Stock Status Buttons */}
                {!isCollected && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => updateStockStatus(item.id, 'in_stock')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        currentStock === 'in_stock'
                          ? 'bg-green-600 text-white'
                          : 'bg-green-50 text-green-700 hover:bg-green-100'
                      }`}
                    >
                      ✓ متوفر
                    </button>
                    <button
                      type="button"
                      onClick={() => updateStockStatus(item.id, 'out_of_stock')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        currentStock === 'out_of_stock'
                          ? 'bg-red-600 text-white'
                          : 'bg-red-50 text-red-700 hover:bg-red-100'
                      }`}
                    >
                      ✗ غير متوفر
                    </button>
                    <button
                      type="button"
                      onClick={() => updateStockStatus(item.id, 'substitute')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        currentStock === 'substitute'
                          ? 'bg-amber-600 text-white'
                          : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                      }`}
                    >
                      بديل متاح
                    </button>
                  </div>
                )}

                {/* Substitute Name Input */}
                {currentStock === 'substitute' && !isCollected && (
                  <input
                    type="text"
                    value={substituteNames[item.id] ?? ''}
                    onChange={(e) => updateSubstituteName(item.id, e.target.value)}
                    placeholder="اسم البديل المتاح"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      {!isCollected && (
        <div className="flex flex-wrap gap-3">
          {isRouted && (
            <button
              type="button"
              onClick={() => handleAction('confirm')}
              disabled={actionLoading === 'confirm'}
              className="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {actionLoading === 'confirm' ? 'جاري...' : 'تأكيد الاستلام'}
            </button>
          )}

          {!isRouted && !isReady && (
            <>
              <button
                type="button"
                onClick={() => handleAction('stock')}
                disabled={actionLoading === 'stock'}
                className="bg-amber-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors"
              >
                {actionLoading === 'stock' ? 'جاري...' : 'حفظ فحص المخزون'}
              </button>

              <button
                type="button"
                onClick={() => handleAction('ready')}
                disabled={actionLoading === 'ready'}
                className="bg-green-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {actionLoading === 'ready' ? 'جاري...' : 'كل الأدوية جاهزة ✓'}
              </button>
            </>
          )}

          {isReady && (
            <button
              type="button"
              onClick={() => handleAction('collect')}
              disabled={actionLoading === 'collect'}
              className="bg-emerald-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {actionLoading === 'collect' ? 'جاري...' : 'تأكيد استلام المريض'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
