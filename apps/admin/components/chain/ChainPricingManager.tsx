'use client';

import { useState, useEffect, useCallback, Fragment } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BranchException {
  branch_id: string;
  branch_name?: string;
  price_egp: number;
  urgent_price_egp?: number;
}

interface PriceItem {
  id: string;
  service_type: string;
  service_code: string | null;
  service_name_ar: string;
  service_name_en: string | null;
  price_egp: number;
  urgent_price_egp: number | null;
  applies_to_all_branches: boolean;
  branch_exceptions: BranchException[];
  is_active: boolean;
  sort_order: number;
}

interface Branch {
  id: string;
  name: string;
  name_en: string | null;
}

type ServiceType = 'consultation' | 'lab_test' | 'procedure' | 'medication';

const SERVICE_TYPES: { value: ServiceType; labelAr: string; labelEn: string }[] = [
  { value: 'consultation', labelAr: 'كشف', labelEn: 'Consultation' },
  { value: 'lab_test', labelAr: 'تحليل', labelEn: 'Lab test' },
  { value: 'procedure', labelAr: 'إجراء', labelEn: 'Procedure' },
  { value: 'medication', labelAr: 'دواء', labelEn: 'Medication' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function ChainPricingManager({ chainId }: { chainId: string }) {
  const [pricing, setPricing] = useState<PriceItem[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ServiceType>('consultation');
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  // New price form state
  const [newServiceType, setNewServiceType] = useState<ServiceType>('consultation');
  const [newServiceCode, setNewServiceCode] = useState('');
  const [newNameAr, setNewNameAr] = useState('');
  const [newNameEn, setNewNameEn] = useState('');
  const [newPrice, setNewPrice] = useState<number>(0);
  const [newUrgentPrice, setNewUrgentPrice] = useState<number>(0);

  // Exception form state
  const [exceptionBranchId, setExceptionBranchId] = useState('');
  const [exceptionPrice, setExceptionPrice] = useState<number>(0);
  const [exceptionUrgentPrice, setExceptionUrgentPrice] = useState<number>(0);

  // ─── Fetch Data ──────────────────────────────────────────────────────────

  const getAuthHeaders = useCallback(async () => {
    const supabase = getSupabaseBrowser();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    return (token
      ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      : { 'Content-Type': 'application/json' }) as HeadersInit;
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();

      const [pricingRes, branchesRes] = await Promise.all([
        fetch(`/api/admin/chain/${chainId}/pricing`, { headers }),
        fetch(`/api/admin/chain/${chainId}/branches`, { headers }),
      ]);

      if (pricingRes.ok) {
        const data = await pricingRes.json();
        setPricing(data.pricing ?? []);
      }
      if (branchesRes.ok) {
        const data = await branchesRes.json();
        setBranches(
          (data.branches ?? []).map(
            (b: { tenant_id: string; branch_name: string; branch_name_en?: string }) => ({
              id: b.tenant_id,
              name: b.branch_name,
              name_en: b.branch_name_en ?? null,
            })
          )
        );
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [chainId, getAuthHeaders]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─── Filtered Items by Tab ──────────────────────────────────────────────

  const filteredPricing = pricing.filter((p) => p.service_type === activeTab);

  // ─── Add Price ──────────────────────────────────────────────────────────

  async function handleAddPrice() {
    if (!newNameAr || newPrice <= 0) return;
    setSaving(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/admin/chain/${chainId}/pricing`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_type: newServiceType,
          service_code: newServiceCode || null,
          service_name_ar: newNameAr,
          service_name_en: newNameEn || null,
          price_egp: newPrice,
          urgent_price_egp: newUrgentPrice > 0 ? newUrgentPrice : null,
          applies_to_all_branches: true,
        }),
      });

      if (res.ok) {
        setShowAddForm(false);
        setNewServiceCode('');
        setNewNameAr('');
        setNewNameEn('');
        setNewPrice(0);
        setNewUrgentPrice(0);
        fetchData();
      }
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  // ─── Add Branch Exception ──────────────────────────────────────────────

  async function handleAddException(pricingId: string) {
    if (!exceptionBranchId || exceptionPrice <= 0) return;
    setSaving(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/admin/chain/${chainId}/pricing/${pricingId}/exception`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch_id: exceptionBranchId,
          price_egp: exceptionPrice,
          urgent_price_egp: exceptionUrgentPrice > 0 ? exceptionUrgentPrice : undefined,
        }),
      });

      if (res.ok) {
        setExceptionBranchId('');
        setExceptionPrice(0);
        setExceptionUrgentPrice(0);
        fetchData();
      }
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  // ─── Export PDF ──────────────────────────────────────────────────────────

  async function handleExportPdf() {
    setExportingPdf(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(
        `/api/admin/chain/${chainId}/pricing/export?format=pdf`,
        { headers }
      );
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'chain-pricing.pdf';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch {
      // ignore
    } finally {
      setExportingPdf(false);
    }
  }

  // ─── Loading ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl shadow-sm animate-pulse h-16" />
        ))}
      </div>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Chain Pricing</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportPdf}
            disabled={exportingPdf}
            className="px-3 py-1.5 text-sm font-medium rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {exportingPdf ? '...' : 'Export PDF'}
          </button>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-violet-600 text-white px-4 py-2 rounded-lg hover:bg-violet-700 transition-colors text-sm font-medium"
          >
            + Add Price
          </button>
        </div>
      </div>

      {/* Service Type Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {SERVICE_TYPES.map((st) => (
          <button
            key={st.value}
            onClick={() => setActiveTab(st.value)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === st.value
                ? 'bg-white text-violet-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {st.labelEn}
          </button>
        ))}
      </div>

      {/* Add Price Form */}
      {showAddForm && (
        <div className="bg-white rounded-xl shadow-sm p-5 border border-violet-200">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Add New Price</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Service Type</label>
              <select
                value={newServiceType}
                onChange={(e) => setNewServiceType(e.target.value as ServiceType)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
              >
                {SERVICE_TYPES.map((st) => (
                  <option key={st.value} value={st.value}>
                    {st.labelEn}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Service Code (optional)</label>
              <input
                type="text"
                value={newServiceCode}
                onChange={(e) => setNewServiceCode(e.target.value)}
                placeholder="e.g., CBC, RFT"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Name (Arabic)</label>
              <input
                type="text"
                value={newNameAr}
                onChange={(e) => setNewNameAr(e.target.value)}
                placeholder="اسم الخدمة"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Name (English)</label>
              <input
                type="text"
                value={newNameEn}
                onChange={(e) => setNewNameEn(e.target.value)}
                placeholder="Service name"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Price (EGP)</label>
              <input
                type="number"
                value={newPrice || ''}
                onChange={(e) => setNewPrice(Number(e.target.value))}
                min={0}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Urgent Price (EGP)</label>
              <input
                type="number"
                value={newUrgentPrice || ''}
                onChange={(e) => setNewUrgentPrice(Number(e.target.value))}
                min={0}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAddPrice}
              disabled={saving || !newNameAr || newPrice <= 0}
              className="bg-violet-600 text-white px-4 py-2 rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors text-sm font-medium"
            >
              {saving ? 'Saving...' : 'Add'}
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="text-gray-500 px-4 py-2 rounded-lg hover:bg-gray-50 text-sm font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Price Table */}
      {filteredPricing.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <p className="text-gray-500">
            No pricing configured for {SERVICE_TYPES.find((s) => s.value === activeTab)?.labelEn ?? activeTab}.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Service</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Code</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Price (EGP)</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Urgent</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Scope</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Exceptions</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {filteredPricing.map((item) => (
                <Fragment key={item.id}>
                  <tr
                    className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                    onClick={() => setExpandedRow(expandedRow === item.id ? null : item.id)}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{item.service_name_ar}</p>
                      {item.service_name_en && (
                        <p className="text-xs text-gray-400">{item.service_name_en}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                      {item.service_code ?? '-'}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {item.price_egp.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {item.urgent_price_egp ? item.urgent_price_egp.toLocaleString() : '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          item.applies_to_all_branches
                            ? 'bg-green-50 text-green-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {item.applies_to_all_branches ? 'All' : 'Selective'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-500 text-xs">
                      {item.branch_exceptions.length > 0
                        ? `${item.branch_exceptions.length}`
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-400">
                      {expandedRow === item.id ? '&#9650;' : '&#9660;'}
                    </td>
                  </tr>

                  {/* Expanded: Branch Exceptions */}
                  {expandedRow === item.id && (
                    <tr>
                      <td colSpan={7} className="bg-gray-50 px-6 py-4">
                        <div className="space-y-3">
                          <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            Branch Exceptions
                          </h4>

                          {item.branch_exceptions.length > 0 ? (
                            <div className="space-y-1">
                              {item.branch_exceptions.map((ex) => {
                                const branchName =
                                  branches.find((b) => b.id === ex.branch_id)?.name ??
                                  ex.branch_id;
                                return (
                                  <div
                                    key={ex.branch_id}
                                    className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-gray-100"
                                  >
                                    <span className="text-sm text-gray-700">{branchName}</span>
                                    <div className="flex items-center gap-4 text-sm">
                                      <span className="font-medium text-gray-900">
                                        {ex.price_egp.toLocaleString()} EGP
                                      </span>
                                      {ex.urgent_price_egp && (
                                        <span className="text-gray-500">
                                          Urgent: {ex.urgent_price_egp.toLocaleString()} EGP
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-xs text-gray-400">
                              No branch exceptions. All branches use the chain price.
                            </p>
                          )}

                          {/* Add Exception Form */}
                          <div className="flex flex-wrap items-end gap-2 pt-2 border-t border-gray-200">
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">Branch</label>
                              <select
                                value={exceptionBranchId}
                                onChange={(e) => setExceptionBranchId(e.target.value)}
                                className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                              >
                                <option value="">Select branch</option>
                                {branches
                                  .filter(
                                    (b) =>
                                      !item.branch_exceptions.some((ex) => ex.branch_id === b.id)
                                  )
                                  .map((b) => (
                                    <option key={b.id} value={b.id}>
                                      {b.name}
                                    </option>
                                  ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">Price</label>
                              <input
                                type="number"
                                value={exceptionPrice || ''}
                                onChange={(e) => setExceptionPrice(Number(e.target.value))}
                                min={0}
                                placeholder="EGP"
                                className="w-24 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">Urgent</label>
                              <input
                                type="number"
                                value={exceptionUrgentPrice || ''}
                                onChange={(e) => setExceptionUrgentPrice(Number(e.target.value))}
                                min={0}
                                placeholder="EGP"
                                className="w-24 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                              />
                            </div>
                            <button
                              onClick={() => handleAddException(item.id)}
                              disabled={saving || !exceptionBranchId || exceptionPrice <= 0}
                              className="bg-violet-600 text-white px-3 py-1.5 rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors text-sm font-medium"
                            >
                              {saving ? '...' : 'Add Exception'}
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
