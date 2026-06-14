'use client';

import { useState, useEffect, useCallback, Fragment } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

type OrderStatus = 'routed' | 'received' | 'processing' | 'results_ready';

interface OrderItem {
  id: string;
  test_name: string;
  service_type: 'lab_test' | 'radiology';
  status: string;
  result_value: string | null;
  unit: string | null;
  reference_range: string | null;
}

interface LabOrder {
  id: string;
  routing_id: string;
  order_date: string;
  patient_name: string;
  patient_phone: string;
  doctor_name: string;
  status: OrderStatus;
  urgency: 'routine' | 'urgent' | 'stat';
  items: OrderItem[];
}

// ─── Status Config ───────────────────────────────────────────────────────────

const STATUS_BADGES: Record<OrderStatus, { label: string; className: string }> = {
  routed: { label: 'محوّل', className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  received: { label: 'مستلم', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  processing: { label: 'قيد المعالجة', className: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  results_ready: { label: 'النتائج جاهزة', className: 'bg-green-100 text-green-700 border-green-200' },
};

const URGENCY_BADGES: Record<string, { label: string; className: string }> = {
  routine: { label: 'عادي', className: 'bg-gray-100 text-gray-600' },
  urgent: { label: 'عاجل', className: 'bg-orange-100 text-orange-700' },
  stat: { label: 'طوارئ', className: 'bg-red-100 text-red-700' },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function LabOrders({ tenantId }: { tenantId: string }) {
  const [orders, setOrders] = useState<LabOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);

      const res = await fetch(`/api/admin/lab/orders?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders ?? data ?? []);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // ─── Render ────────────────────────────────────────────────────────────────

  const filters: Array<{ value: 'all' | OrderStatus; label: string }> = [
    { value: 'all', label: 'الكل' },
    { value: 'routed', label: 'محوّل' },
    { value: 'received', label: 'مستلم' },
    { value: 'processing', label: 'قيد المعالجة' },
    { value: 'results_ready', label: 'جاهز' },
  ];

  return (
    <div className="space-y-4" dir="rtl">
      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === f.value
                ? 'bg-teal-600 text-white shadow-sm'
                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="animate-pulse p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 bg-gray-100 rounded" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16">
            <span className="text-4xl mb-3 block">📋</span>
            <p className="text-gray-500 text-sm">لا توجد طلبات</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-right px-4 py-3 font-medium">التاريخ</th>
                  <th className="text-right px-4 py-3 font-medium">المريض</th>
                  <th className="text-right px-4 py-3 font-medium">الطبيب</th>
                  <th className="text-right px-4 py-3 font-medium">التحاليل</th>
                  <th className="text-right px-4 py-3 font-medium">الحالة</th>
                  <th className="text-right px-4 py-3 font-medium">الأولوية</th>
                  <th className="text-right px-4 py-3 font-medium w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.map((order) => {
                  const statusBadge = STATUS_BADGES[order.status] ?? { label: 'موجّه', className: 'bg-yellow-100 text-yellow-700' };
                  const urgencyBadge = URGENCY_BADGES[order.urgency] ?? { label: 'عادي', className: 'bg-gray-100 text-gray-600' };
                  const isExpanded = expandedId === order.id;

                  return (
                    <Fragment key={order.id}>
                      <tr
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => setExpandedId(isExpanded ? null : order.id)}
                      >
                        <td className="px-4 py-3 text-xs text-gray-600">
                          {formatDate(order.order_date)}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {order.patient_name}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{order.doctor_name}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {order.items.slice(0, 3).map((item, i) => (
                              <span
                                key={i}
                                className="bg-indigo-50 text-indigo-700 text-[10px] px-1.5 py-0.5 rounded-full border border-indigo-100"
                              >
                                {item.test_name}
                              </span>
                            ))}
                            {order.items.length > 3 && (
                              <span className="text-xs text-gray-400">
                                +{order.items.length - 3}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium border ${statusBadge.className}`}
                          >
                            {statusBadge.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${urgencyBadge.className}`}
                          >
                            {urgencyBadge.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-400">
                          {isExpanded ? '▲' : '▼'}
                        </td>
                      </tr>

                      {/* Expanded Detail */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={7} className="bg-gray-50 px-6 py-4">
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <p className="text-xs text-gray-500">
                                  رقم التحويل: <span className="font-mono" dir="ltr">{order.routing_id}</span>
                                </p>
                                {order.status !== 'results_ready' && (
                                  <a
                                    href={`/lab/results/upload/${order.routing_id}`}
                                    className="px-3 py-1.5 text-xs font-medium rounded-md bg-teal-600 text-white hover:bg-teal-700 transition-colors"
                                  >
                                    رفع النتائج
                                  </a>
                                )}
                              </div>
                              <table className="w-full text-xs">
                                <thead className="text-gray-500">
                                  <tr>
                                    <th className="text-right py-1 font-medium">التحليل</th>
                                    <th className="text-right py-1 font-medium">النوع</th>
                                    <th className="text-right py-1 font-medium">الحالة</th>
                                    <th className="text-right py-1 font-medium">النتيجة</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                  {order.items.map((item) => (
                                    <tr key={item.id}>
                                      <td className="py-2 font-medium text-gray-800">
                                        {item.test_name}
                                      </td>
                                      <td className="py-2 text-gray-600">
                                        {item.service_type === 'lab_test' ? 'تحليل' : 'أشعة'}
                                      </td>
                                      <td className="py-2 text-gray-600">{item.status}</td>
                                      <td className="py-2 text-gray-600">
                                        {item.result_value
                                          ? `${item.result_value} ${item.unit ?? ''}`
                                          : '—'}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
