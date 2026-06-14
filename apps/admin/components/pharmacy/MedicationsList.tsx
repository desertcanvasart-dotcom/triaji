'use client';

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Medication {
  id: string;
  drug_name_ar: string;
  drug_name_en: string | null;
  form: string | null;
  strength: string | null;
  price_egp: number | null;
  in_stock: boolean;
}

interface NewMedication {
  drug_name_ar: string;
  drug_name_en: string;
  form: string;
  strength: string;
  price_egp: string;
  in_stock: boolean;
}

const EMPTY_MED: NewMedication = {
  drug_name_ar: '',
  drug_name_en: '',
  form: '',
  strength: '',
  price_egp: '',
  in_stock: true,
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function MedicationsList({ tenantId }: { tenantId: string }) {
  const [medications, setMedications] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);
  const [newMed, setNewMed] = useState<NewMedication>(EMPTY_MED);
  const [saving, setSaving] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogResults, setCatalogResults] = useState<Medication[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const supabase = getSupabaseBrowser();
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const fetchMedications = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const params = new URLSearchParams();
      if (search) params.set('search', search);

      const res = await fetch(`/api/admin/pharmacy/medications?${params.toString()}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setMedications(data.medications ?? data ?? []);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [search, getAuthHeaders]);

  useEffect(() => {
    const timer = setTimeout(fetchMedications, 300);
    return () => clearTimeout(timer);
  }, [fetchMedications]);

  // ─── Add Medication ───────────────────────────────────────────────────────

  async function handleAddMedication() {
    if (!newMed.drug_name_ar.trim()) return;
    setSaving(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/admin/pharmacy/medications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          drug_name_ar: newMed.drug_name_ar,
          drug_name_en: newMed.drug_name_en || null,
          form: newMed.form || null,
          strength: newMed.strength || null,
          price_egp: newMed.price_egp ? Number(newMed.price_egp) : null,
          in_stock: newMed.in_stock,
        }),
      });

      if (res.ok) {
        setNewMed(EMPTY_MED);
        setShowAddForm(false);
        fetchMedications();
      }
    } catch {
      // Silently fail
    } finally {
      setSaving(false);
    }
  }

  // ─── Toggle Stock ──────────────────────────────────────────────────────────

  async function handleToggleStock(medId: string, currentState: boolean) {
    try {
      const headers = await getAuthHeaders();
      await fetch(`/api/admin/pharmacy/medications/${medId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ in_stock: !currentState }),
      });

      setMedications((prev) =>
        prev.map((m) => (m.id === medId ? { ...m, in_stock: !currentState } : m))
      );
    } catch {
      // Silently fail
    }
  }

  // ─── Catalog Search ────────────────────────────────────────────────────────

  async function searchCatalog() {
    if (!catalogSearch.trim()) return;
    setCatalogLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(
        `/api/admin/pharmacy/catalog?search=${encodeURIComponent(catalogSearch)}`,
        { headers }
      );
      if (res.ok) {
        const data = await res.json();
        setCatalogResults(data.medications ?? data ?? []);
      }
    } catch {
      // Silently fail
    } finally {
      setCatalogLoading(false);
    }
  }

  async function importFromCatalog(med: Medication) {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/admin/pharmacy/medications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          drug_name_ar: med.drug_name_ar,
          drug_name_en: med.drug_name_en,
          form: med.form,
          strength: med.strength,
          price_egp: med.price_egp,
          in_stock: true,
        }),
      });

      if (res.ok) {
        fetchMedications();
        setCatalogResults((prev) => prev.filter((m) => m.id !== med.id));
      }
    } catch {
      // Silently fail
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4" dir="rtl">
      {/* Search + Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث عن دواء..."
          className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => { setShowAddForm(!showAddForm); setShowCatalog(false); }}
            className="px-4 py-2.5 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
          >
            إضافة دواء
          </button>
          <button
            type="button"
            onClick={() => { setShowCatalog(!showCatalog); setShowAddForm(false); }}
            className="px-4 py-2.5 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            استيراد من الكتالوج
          </button>
        </div>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
          <h3 className="font-semibold text-gray-900">إضافة دواء جديد</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">اسم الدواء (عربي) *</label>
              <input
                type="text"
                value={newMed.drug_name_ar}
                onChange={(e) => setNewMed({ ...newMed, drug_name_ar: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">اسم الدواء (إنجليزي)</label>
              <input
                type="text"
                value={newMed.drug_name_en}
                onChange={(e) => setNewMed({ ...newMed, drug_name_en: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">الشكل الدوائي</label>
              <input
                type="text"
                value={newMed.form}
                onChange={(e) => setNewMed({ ...newMed, form: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                placeholder="أقراص، شراب، حقن..."
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">التركيز</label>
              <input
                type="text"
                value={newMed.strength}
                onChange={(e) => setNewMed({ ...newMed, strength: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                placeholder="500mg"
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">السعر (ج.م)</label>
              <input
                type="number"
                min={0}
                value={newMed.price_egp}
                onChange={(e) => setNewMed({ ...newMed, price_egp: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                dir="ltr"
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={newMed.in_stock}
                  onChange={(e) => setNewMed({ ...newMed, in_stock: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                />
                متوفر في المخزون
              </label>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleAddMedication}
              disabled={saving || !newMed.drug_name_ar.trim()}
              className="bg-emerald-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'جاري الحفظ...' : 'إضافة'}
            </button>
            <button
              type="button"
              onClick={() => { setShowAddForm(false); setNewMed(EMPTY_MED); }}
              className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}

      {/* Catalog Search Modal */}
      {showCatalog && (
        <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
          <h3 className="font-semibold text-gray-900">استيراد من كتالوج الأدوية</h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={catalogSearch}
              onChange={(e) => setCatalogSearch(e.target.value)}
              placeholder="ابحث في الكتالوج..."
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              onKeyDown={(e) => e.key === 'Enter' && searchCatalog()}
            />
            <button
              type="button"
              onClick={searchCatalog}
              disabled={catalogLoading}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {catalogLoading ? '...' : 'بحث'}
            </button>
          </div>
          {catalogResults.length > 0 && (
            <div className="divide-y divide-gray-100 max-h-60 overflow-y-auto">
              {catalogResults.map((med) => (
                <div key={med.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{med.drug_name_ar}</p>
                    <p className="text-xs text-gray-400" dir="ltr">
                      {[med.drug_name_en, med.form, med.strength].filter(Boolean).join(' — ')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => importFromCatalog(med)}
                    className="text-xs bg-blue-50 text-blue-700 px-3 py-1 rounded-full hover:bg-blue-100 transition-colors"
                  >
                    استيراد
                  </button>
                </div>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => { setShowCatalog(false); setCatalogSearch(''); setCatalogResults([]); }}
            className="text-sm text-gray-500 hover:underline"
          >
            إغلاق
          </button>
        </div>
      )}

      {/* Medications Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="animate-pulse p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 bg-gray-100 rounded" />
            ))}
          </div>
        ) : medications.length === 0 ? (
          <div className="text-center py-16">
            <span className="text-4xl mb-3 block">💊</span>
            <p className="text-gray-500 text-sm">لا توجد أدوية</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-right px-4 py-3 font-medium">اسم الدواء</th>
                  <th className="text-right px-4 py-3 font-medium">الاسم بالإنجليزي</th>
                  <th className="text-right px-4 py-3 font-medium">الشكل</th>
                  <th className="text-right px-4 py-3 font-medium">التركيز</th>
                  <th className="text-right px-4 py-3 font-medium">السعر</th>
                  <th className="text-center px-4 py-3 font-medium">متوفر</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {medications.map((med) => (
                  <tr key={med.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{med.drug_name_ar}</td>
                    <td className="px-4 py-3 text-gray-600" dir="ltr">{med.drug_name_en ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{med.form ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600" dir="ltr">{med.strength ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {med.price_egp != null ? `${med.price_egp} ج.م` : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleStock(med.id, med.in_stock)}
                        className={`relative w-10 h-5 rounded-full transition-colors ${
                          med.in_stock ? 'bg-emerald-600' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                            med.in_stock ? 'right-0.5' : 'right-[22px]'
                          }`}
                        />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
