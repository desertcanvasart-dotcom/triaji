'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { showToast } from '@/components/ui/Toast';

// ─── Types ───────────────────────────────────────────────────────────────────

interface OrderItem {
  id: string;
  test_name: string;
  test_code: string;
  service_type: 'lab_test' | 'radiology';
  unit: string | null;
  reference_range_min: number | null;
  reference_range_max: number | null;
  reference_range_text: string | null;
}

interface OrderDetails {
  routing_id: string;
  patient_name: string;
  patient_phone: string;
  doctor_name: string;
  doctor_phone: string | null;
  order_date: string;
  items: OrderItem[];
}

interface LabResultEntry {
  item_id: string;
  value: string;
  unit: string;
  flag: 'normal' | 'abnormal_high' | 'abnormal_low' | '';
}

interface RadiologyResultEntry {
  item_id: string;
  report_text: string;
  finding: 'normal' | 'abnormal' | 'follow_up';
  file: File | null;
}

// ─── Unit Options ────────────────────────────────────────────────────────────

const COMMON_UNITS = [
  'mg/dL', 'g/dL', 'mmol/L', 'mEq/L', 'U/L', 'IU/L', 'ng/mL', 'pg/mL',
  'mIU/mL', '%', 'x10^3/uL', 'x10^6/uL', 'mm/hr', 'sec', 'INR',
  'cells/uL', 'mg/L', 'mcg/dL', 'nmol/L', 'pmol/L', 'kU/L',
];

const FINDING_OPTIONS = [
  { value: 'normal', label: 'طبيعي', className: 'bg-green-50 border-green-300 text-green-700' },
  { value: 'abnormal', label: 'غير طبيعي', className: 'bg-red-50 border-red-300 text-red-700' },
  { value: 'follow_up', label: 'يحتاج متابعة', className: 'bg-yellow-50 border-yellow-300 text-yellow-700' },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function ResultsUpload({ routingId }: { routingId: string }) {
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Lab test results
  const [labResults, setLabResults] = useState<Record<string, LabResultEntry>>({});

  // Radiology results
  const [radioResults, setRadioResults] = useState<Record<string, RadiologyResultEntry>>({});

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // ─── Fetch Order ───────────────────────────────────────────────────────────

  const fetchOrder = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/lab/orders/${routingId}`);
      if (!res.ok) {
        throw new Error('Order not found');
      }
      const data = await res.json();
      // API returns { order: <routing row with nested joins> }. Ordered tests are under
      // health_records.lab_order_items (all lab tests — radiology isn't modelled there);
      // results are entered here and stored in health_records.lab_values.
      const o = data.order ?? data;
      const hr = Array.isArray(o.health_records) ? o.health_records[0] : o.health_records;
      const normalized: OrderDetails = {
        routing_id: o.id,
        patient_name: o.patients?.name_ar ?? '',
        patient_phone: o.patients?.phone_number ?? '',
        doctor_name: o.doctors?.name_ar ?? '',
        doctor_phone: null,
        order_date: o.created_at,
        items: (hr?.lab_order_items ?? []).map((it: Record<string, any>) => ({
          id: it.id,
          test_name: it.test_name_ar ?? it.test_name_en ?? '',
          test_code: '',
          service_type: 'lab_test' as const,
          unit: null,
          reference_range_min: null,
          reference_range_max: null,
          reference_range_text: null,
        })),
      };
      setOrder(normalized);

      // Initialize result entries
      const labInit: Record<string, LabResultEntry> = {};
      const radioInit: Record<string, RadiologyResultEntry> = {};

      for (const item of normalized.items) {
        if (item.service_type === 'lab_test') {
          labInit[item.id] = {
            item_id: item.id,
            value: '',
            unit: item.unit ?? 'mg/dL',
            flag: '',
          };
        } else {
          radioInit[item.id] = {
            item_id: item.id,
            report_text: '',
            finding: 'normal',
            file: null,
          };
        }
      }

      setLabResults(labInit);
      setRadioResults(radioInit);
    } catch {
      showToast('لم يتم العثور على الطلب', 'error');
    } finally {
      setLoading(false);
    }
  }, [routingId]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  // ─── Lab Result Helpers ────────────────────────────────────────────────────

  function updateLabResult(itemId: string, field: keyof LabResultEntry, value: string) {
    setLabResults((prev) => {
      const entry = prev[itemId];
      if (!entry) return prev;

      const updated = { ...entry, [field]: value };

      // Auto-flag based on reference range
      if (field === 'value') {
        const item = order?.items.find((i) => i.id === itemId);
        if (item && item.reference_range_min != null && item.reference_range_max != null) {
          const numValue = parseFloat(value);
          if (!isNaN(numValue)) {
            if (numValue < item.reference_range_min) {
              updated.flag = 'abnormal_low';
            } else if (numValue > item.reference_range_max) {
              updated.flag = 'abnormal_high';
            } else {
              updated.flag = 'normal';
            }
          } else {
            updated.flag = '';
          }
        }
      }

      return { ...prev, [itemId]: updated };
    });
  }

  function updateRadioResult(itemId: string, field: keyof RadiologyResultEntry, value: string | File | null) {
    setRadioResults((prev) => {
      const entry = prev[itemId];
      if (!entry) return prev;
      return { ...prev, [itemId]: { ...entry, [field]: value } };
    });
  }

  // ─── File Drop Handler ─────────────────────────────────────────────────────

  function handleFileDrop(itemId: string, e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      updateRadioResult(itemId, 'file', file);
    }
  }

  function handleFileSelect(itemId: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    updateRadioResult(itemId, 'file', file);
  }

  // ─── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!order) return;

    // Validate that all lab tests have values
    const labItems = order.items.filter((i) => i.service_type === 'lab_test');
    for (const item of labItems) {
      const result = labResults[item.id];
      if (!result || !result.value.trim()) {
        showToast(`يرجى إدخال نتيجة: ${item.test_name}`, 'error');
        return;
      }
    }

    // Validate radiology items have reports
    const radioItems = order.items.filter((i) => i.service_type === 'radiology');
    for (const item of radioItems) {
      const result = radioResults[item.id];
      if (!result || !result.report_text.trim()) {
        showToast(`يرجى كتابة التقرير: ${item.test_name}`, 'error');
        return;
      }
    }

    setSubmitting(true);
    try {
      // POST JSON { routing_id, results } — the route stores results in the
      // health_records.lab_values jsonb (item_id carried per entry). Radiology
      // imaging files aren't persisted (not modelled in lab_order_items); any
      // radiology report text is folded into results as a text value.
      const results = Object.values(labResults)
        .filter((r) => r.value.trim())
        .map((r) => {
          const item = order.items.find((i) => i.id === r.item_id);
          return {
            item_id: r.item_id,
            test_name: item?.test_name ?? '',
            value: r.value,
            unit: r.unit,
            abnormal: r.flag === 'abnormal_high' || r.flag === 'abnormal_low',
          };
        });

      const radioAsResults = Object.values(radioResults)
        .filter((r) => r.report_text.trim())
        .map((r) => {
          const item = order.items.find((i) => i.id === r.item_id);
          return {
            item_id: r.item_id,
            test_name: item?.test_name ?? '',
            value: r.report_text,
            unit: '',
            abnormal: r.finding !== 'normal',
          };
        });

      const res = await fetch('/api/admin/lab/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ routing_id: routingId, results: [...results, ...radioAsResults] }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'فشل في حفظ النتائج');
      }

      showToast('تم حفظ النتائج وإرسالها بنجاح', 'success');

      // Redirect back to results page after short delay
      setTimeout(() => {
        window.location.href = '/lab/results';
      }, 1500);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'حدث خطأ غير متوقع',
        'error'
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Loading State ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="animate-pulse space-y-4">
          <div className="h-20 bg-gray-100 rounded-xl" />
          <div className="h-40 bg-gray-100 rounded-xl" />
          <div className="h-40 bg-gray-100 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-20">
        <span className="text-4xl mb-3 block">❌</span>
        <p className="text-gray-500">لم يتم العثور على الطلب</p>
        <a
          href="/lab/results"
          className="inline-block mt-4 text-teal-600 hover:text-teal-700 text-sm font-medium"
        >
          العودة للطلبات
        </a>
      </div>
    );
  }

  const labItems = order.items.filter((i) => i.service_type === 'lab_test');
  const radioItems = order.items.filter((i) => i.service_type === 'radiology');

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-3xl mx-auto space-y-6" dir="rtl">
      {/* Order Header */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{order.patient_name}</h2>
            <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
              <span>الطبيب: {order.doctor_name}</span>
              <span className="text-gray-300">|</span>
              <span dir="ltr" className="font-mono text-xs">{order.routing_id}</span>
            </div>
          </div>
          <span className="text-xs text-gray-400">
            {new Date(order.order_date).toLocaleDateString('ar-EG')}
          </span>
        </div>
      </div>

      {/* Lab Test Results */}
      {labItems.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-5 space-y-5">
          <h3 className="text-base font-semibold text-gray-900">نتائج التحاليل</h3>

          {labItems.map((item) => {
            const result = labResults[item.id];
            const isAbnormal = result?.flag === 'abnormal_high' || result?.flag === 'abnormal_low';
            const refText = item.reference_range_text
              ?? (item.reference_range_min != null && item.reference_range_max != null
                ? `${item.reference_range_min} - ${item.reference_range_max}`
                : null);

            return (
              <div
                key={item.id}
                className={`border rounded-lg p-4 space-y-3 transition-colors ${
                  isAbnormal ? 'border-red-300 bg-red-50/50' : 'border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">{item.test_name}</span>
                    {item.test_code && (
                      <span className="text-[10px] font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                        {item.test_code}
                      </span>
                    )}
                    {isAbnormal && <span className="text-red-500 text-lg">&#9888;</span>}
                  </div>
                  {refText && (
                    <span className="text-xs text-gray-400">
                      المرجع: {refText} {item.unit ?? ''}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  {/* Value Input */}
                  <div className="flex-1">
                    <input
                      type="number"
                      step="any"
                      placeholder="النتيجة"
                      value={result?.value ?? ''}
                      onChange={(e) => updateLabResult(item.id, 'value', e.target.value)}
                      className={`w-full h-11 px-3 rounded-lg border text-base focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-colors ${
                        isAbnormal ? 'border-red-400' : 'border-gray-300'
                      }`}
                      dir="ltr"
                    />
                  </div>

                  {/* Unit Selector */}
                  <div className="w-28">
                    <select
                      value={result?.unit ?? item.unit ?? 'mg/dL'}
                      onChange={(e) => updateLabResult(item.id, 'unit', e.target.value)}
                      className="w-full h-11 px-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                      dir="ltr"
                    >
                      {COMMON_UNITS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Auto-flag indicator */}
                {result?.flag === 'abnormal_high' && (
                  <p className="text-xs text-red-600 font-medium">
                    &#9650; القيمة أعلى من المرجع
                  </p>
                )}
                {result?.flag === 'abnormal_low' && (
                  <p className="text-xs text-red-600 font-medium">
                    &#9660; القيمة أقل من المرجع
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Radiology Results */}
      {radioItems.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-5 space-y-5">
          <h3 className="text-base font-semibold text-gray-900">نتائج الأشعة</h3>

          {radioItems.map((item) => {
            const result = radioResults[item.id];

            return (
              <div key={item.id} className="border border-gray-200 rounded-lg p-4 space-y-4">
                <span className="text-sm font-semibold text-gray-900">{item.test_name}</span>

                {/* Radiologist Report */}
                <div>
                  <label className="block text-sm text-gray-600 mb-1">تقرير الأشعة</label>
                  <textarea
                    value={result?.report_text ?? ''}
                    onChange={(e) => updateRadioResult(item.id, 'report_text', e.target.value)}
                    placeholder="اكتب تقرير الأشعة هنا..."
                    rows={5}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none resize-y"
                    dir="rtl"
                  />
                </div>

                {/* File Upload */}
                <div>
                  <label className="block text-sm text-gray-600 mb-1">صورة الأشعة</label>
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleFileDrop(item.id, e)}
                    onClick={() => fileInputRefs.current[item.id]?.click()}
                    className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-teal-400 hover:bg-teal-50/30 transition-colors"
                  >
                    <input
                      ref={(el) => { fileInputRefs.current[item.id] = el; }}
                      type="file"
                      accept="image/*,.dcm,.pdf"
                      className="hidden"
                      onChange={(e) => handleFileSelect(item.id, e)}
                    />
                    {result?.file ? (
                      <div className="space-y-1">
                        <span className="text-2xl block">&#128206;</span>
                        <p className="text-sm text-gray-700 font-medium">{result.file.name}</p>
                        <p className="text-xs text-gray-400">
                          {(result.file.size / 1024 / 1024).toFixed(1)} MB
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <span className="text-2xl block">&#128247;</span>
                        <p className="text-sm text-gray-500">اسحب الملف هنا أو اضغط للاختيار</p>
                        <p className="text-xs text-gray-400">DICOM, JPEG, PNG, PDF</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Finding Radio Buttons */}
                <div>
                  <label className="block text-sm text-gray-600 mb-2">التقييم</label>
                  <div className="flex gap-2">
                    {FINDING_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => updateRadioResult(item.id, 'finding', opt.value)}
                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border-2 transition-colors ${
                          result?.finding === opt.value
                            ? opt.className
                            : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Submit Button */}
      <div className="sticky bottom-4">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full h-14 rounded-xl bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white text-lg font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
        >
          {submitting ? 'جارٍ الحفظ والإرسال...' : 'حفظ النتائج وإرسال &#9993;'}
        </button>
      </div>
    </div>
  );
}
