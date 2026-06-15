'use client';

import { useState, useEffect, useCallback } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PendingOrder {
  id: string;
  routing_id: string;
  patient_name: string;
  doctor_name: string;
  order_date: string;
  status: string;
  item_count: number;
  tests: string[];
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function LabResultsPage() {
  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/lab/orders?status=received&status=processing');
      if (res.ok) {
        const data = await res.json();
        // Map the nested lab_order_routing rows to this list's flat shape.
        const normalized: PendingOrder[] = (data.orders ?? []).map((o: Record<string, any>) => {
          const hr = Array.isArray(o.health_records) ? o.health_records[0] : o.health_records;
          const tests = (hr?.lab_order_items ?? []).map(
            (it: Record<string, any>) => it.test_name_ar ?? it.test_name_en ?? ''
          );
          return {
            id: o.id,
            routing_id: o.id,
            patient_name: o.patients?.name_ar ?? '',
            doctor_name: o.doctors?.name_ar ?? '',
            order_date: o.created_at,
            status: o.status,
            item_count: tests.length,
            tests,
          };
        });
        setOrders(normalized);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  return (
    <div dir="rtl">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">رفع النتائج</h1>

      {loading ? (
        <div className="animate-pulse space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-xl" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-20">
          <span className="text-4xl mb-3 block">&#9989;</span>
          <p className="text-gray-500">لا توجد طلبات تحتاج رفع نتائج</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <a
              key={order.id}
              href={`/lab/results/upload/${order.routing_id}`}
              className="block bg-white rounded-xl border border-gray-200 p-4 hover:border-teal-300 hover:bg-teal-50/30 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-gray-900">{order.patient_name}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                    <span>الطبيب: {order.doctor_name}</span>
                    <span className="text-gray-300">|</span>
                    <span>
                      {new Date(order.order_date).toLocaleDateString('ar-EG', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                    <span className="text-gray-300">|</span>
                    <span>{order.item_count} تحليل</span>
                  </div>
                  {order.tests.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {order.tests.slice(0, 5).map((test, i) => (
                        <span
                          key={i}
                          className="bg-indigo-50 text-indigo-700 text-[10px] px-1.5 py-0.5 rounded-full border border-indigo-100"
                        >
                          {test}
                        </span>
                      ))}
                      {order.tests.length > 5 && (
                        <span className="text-xs text-gray-400">+{order.tests.length - 5}</span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex-shrink-0 text-teal-600">
                  <span className="text-sm font-medium">رفع النتائج &#8592;</span>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
