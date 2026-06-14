'use client';

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';

interface PriceItem {
  id: string;
  service_type: string;
  service_code: string | null;
  service_name_ar: string;
  service_name_en: string | null;
  price_egp: number;
  urgent_price_egp: number | null;
  applies_to_all_branches: boolean;
  branch_exceptions: Array<{ branch_id: string; price_egp: number }>;
  is_active: boolean;
  sort_order: number;
}

export default function ChainPricingPage() {
  const [pricing, setPricing] = useState<PriceItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
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

      const verifyRes = await fetch('/api/admin/auth/verify', { headers });
      if (verifyRes.ok) {
        const verifyData = await verifyRes.json();
        const chainId = verifyData.chain_id;
        if (chainId) {
          const res = await fetch(`/api/admin/chain/${chainId}/pricing`, { headers });
          if (res.ok) {
            const data = await res.json();
            setPricing(data.pricing ?? []);
          }
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl shadow-sm animate-pulse h-16" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Chain Pricing</h1>
        <button className="bg-violet-600 text-white px-4 py-2.5 rounded-lg hover:bg-violet-700 transition-colors text-sm font-medium">
          + Add Price
        </button>
      </div>

      {pricing.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <p className="text-gray-500">No pricing configured yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Service</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Price (EGP)</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Urgent Price</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Scope</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Exceptions</th>
              </tr>
            </thead>
            <tbody>
              {pricing.map((item) => (
                <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{item.service_name_ar}</p>
                    {item.service_code && (
                      <p className="text-xs text-gray-400">{item.service_code}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{item.service_type}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {item.price_egp.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {item.urgent_price_egp ? item.urgent_price_egp.toLocaleString() : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${
                        item.applies_to_all_branches
                          ? 'bg-green-50 text-green-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {item.applies_to_all_branches ? 'All branches' : 'Selective'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {item.branch_exceptions.length > 0
                      ? `${item.branch_exceptions.length} exception(s)`
                      : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
