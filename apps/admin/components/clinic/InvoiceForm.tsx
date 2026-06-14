'use client';

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  price: number;
  /** Set when chain pricing was used to pre-fill this item */
  chainPriceSource?: 'chain_price' | 'branch_exception' | null;
}

interface Doctor {
  id: string;
  name_ar: string;
}

interface InvoiceFormProps {
  tenantId: string;
  doctors: Doctor[];
  queueEntryId?: string;
  patientName?: string;
  doctorId?: string;
  onSaved: () => void;
  onCancel: () => void;
}

type PaymentMethod = 'cash' | 'card' | 'insurance' | 'bank_transfer';

interface ChainPriceResult {
  price_egp: number;
  urgent_price_egp: number | null;
  source: 'branch_exception' | 'chain_price' | 'branch_fallback' | 'manual';
}

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'كاش' },
  { value: 'card', label: 'كارت' },
  { value: 'insurance', label: 'تأمين' },
  { value: 'bank_transfer', label: 'تحويل بنكي' },
];

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

export default function InvoiceForm({
  tenantId,
  doctors,
  queueEntryId,
  patientName: initialPatientName,
  doctorId: initialDoctorId,
  onSaved,
  onCancel,
}: InvoiceFormProps) {
  const [patientName, setPatientName] = useState(initialPatientName ?? '');
  const [doctorId, setDoctorId] = useState(initialDoctorId ?? '');
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: generateId(), description: 'كشف طبي', quantity: 1, price: 0, chainPriceSource: null },
  ]);
  const [discount, setDiscount] = useState(0);
  const [insuranceCoverage, setInsuranceCoverage] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [chainPriceLoaded, setChainPriceLoaded] = useState(false);

  // ─── Chain Price Resolution ───────────────────────────────────────────────
  // Fetch chain pricing on mount for 'consultation' service type (default line item)

  const fetchChainPrice = useCallback(async () => {
    try {
      const supabase = getSupabaseBrowser();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch(
        `/api/admin/chain/price?tenant_id=${tenantId}&service_type=consultation`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );

      if (!res.ok) return;

      const data = (await res.json()) as ChainPriceResult | null;
      if (data && data.source !== 'branch_fallback' && data.source !== 'manual') {
        // Pre-fill the first line item with chain price
        setLineItems((prev) => {
          const updated = [...prev];
          if (updated[0] && updated[0].price === 0) {
            updated[0] = {
              ...updated[0],
              price: data.price_egp,
              chainPriceSource: data.source as 'chain_price' | 'branch_exception',
            };
          }
          return updated;
        });
        setChainPriceLoaded(true);
      }
    } catch {
      // Silently fail — chain pricing is optional
    }
  }, [tenantId]);

  useEffect(() => {
    fetchChainPrice();
  }, [fetchChainPrice]);

  const subtotal = lineItems.reduce((sum, item) => sum + item.quantity * item.price, 0);
  const patientPays = Math.max(0, subtotal - discount - insuranceCoverage);

  function updateLineItem(id: string, field: keyof LineItem, value: string | number) {
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value };
        // If staff manually changes price, mark as manual override (clears chain source)
        if (field === 'price') {
          updated.chainPriceSource = null;
        }
        return updated;
      })
    );
  }

  function removeLineItem(id: string) {
    if (lineItems.length <= 1) return;
    setLineItems((prev) => prev.filter((item) => item.id !== id));
  }

  function addLineItem() {
    setLineItems((prev) => [
      ...prev,
      { id: generateId(), description: '', quantity: 1, price: 0, chainPriceSource: null },
    ]);
  }

  async function submit(status: 'draft' | 'issued') {
    setSaving(true);
    try {
      const supabase = getSupabaseBrowser();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      const body = {
        tenant_id: tenantId,
        queue_entry_id: queueEntryId || null,
        patient_name: patientName,
        doctor_id: doctorId || null,
        line_items: lineItems.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unit_price: item.price,
          total: item.quantity * item.price,
          price_source: item.chainPriceSource ?? 'manual',
        })),
        subtotal,
        discount,
        insurance_coverage: insuranceCoverage,
        patient_pays: patientPays,
        payment_method: paymentMethod,
        notes: notes || null,
        status,
      };

      const res = await fetch('/api/admin/invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        onSaved();
      }
    } catch {
      // Silently fail
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5" dir="rtl">
      {/* Chain Price Indicator */}
      {chainPriceLoaded && (
        <div className="flex items-center gap-2 bg-violet-50 border border-violet-200 rounded-lg px-3 py-2 text-xs text-violet-700">
          <span>&#127973;</span>
          <span className="font-medium">سعر السلسلة المشترك</span>
          <span className="text-violet-500">— يمكن تعديل السعر يدوياً</span>
        </div>
      )}

      {/* Patient & Doctor */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">اسم المريض</label>
          <input
            type="text"
            value={patientName}
            onChange={(e) => setPatientName(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
            placeholder="اسم المريض"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">الطبيب</label>
          <select
            value={doctorId}
            onChange={(e) => setDoctorId(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
          >
            <option value="">اختر الطبيب</option>
            {doctors.map((doc) => (
              <option key={doc.id} value={doc.id}>
                {doc.name_ar}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Line Items */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">بنود الفاتورة</label>
        <div className="space-y-2">
          {/* Header row */}
          <div className="hidden md:grid md:grid-cols-12 gap-2 text-xs text-gray-500 px-1">
            <div className="col-span-5">وصف الخدمة</div>
            <div className="col-span-2">الكمية</div>
            <div className="col-span-2">السعر</div>
            <div className="col-span-2">الإجمالي</div>
            <div className="col-span-1"></div>
          </div>

          {lineItems.map((item) => (
            <div key={item.id}>
              <div className="grid grid-cols-12 gap-2 items-center">
                <input
                  type="text"
                  value={item.description}
                  onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                  placeholder="وصف الخدمة"
                  className="col-span-12 md:col-span-5 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                />
                <div className="col-span-4 md:col-span-2 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      updateLineItem(item.id, 'quantity', Math.max(1, item.quantity - 1))
                    }
                    className="w-7 h-7 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 text-sm font-bold"
                  >
                    -
                  </button>
                  <span className="w-8 text-center text-sm">{item.quantity}</span>
                  <button
                    type="button"
                    onClick={() => updateLineItem(item.id, 'quantity', item.quantity + 1)}
                    className="w-7 h-7 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 text-sm font-bold"
                  >
                    +
                  </button>
                </div>
                <input
                  type="number"
                  value={item.price || ''}
                  onChange={(e) => updateLineItem(item.id, 'price', Number(e.target.value))}
                  placeholder="السعر"
                  min={0}
                  className={`col-span-4 md:col-span-2 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none ${
                    item.chainPriceSource
                      ? 'border-violet-300 bg-violet-50'
                      : 'border-gray-300'
                  }`}
                />
                <div className="col-span-3 md:col-span-2 text-sm font-medium text-gray-700 px-2">
                  {(item.quantity * item.price).toLocaleString('ar-EG')} ج.م
                </div>
                <button
                  type="button"
                  onClick={() => removeLineItem(item.id)}
                  disabled={lineItems.length <= 1}
                  className="col-span-1 text-red-400 hover:text-red-600 disabled:opacity-30 text-lg"
                  title="حذف"
                >
                  &#128465;
                </button>
              </div>
              {/* Chain price source indicator per line */}
              {item.chainPriceSource && (
                <div className="mt-0.5 mr-0 md:mr-[41.667%] text-xs text-violet-500">
                  {item.chainPriceSource === 'chain_price'
                    ? '&#127973; سعر السلسلة المشترك'
                    : '&#127973; استثناء فرعي'}
                </div>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addLineItem}
          className="mt-2 text-sm text-teal-600 hover:text-teal-700 font-medium"
        >
          &#10133; إضافة بند
        </button>
      </div>

      {/* Discount & Insurance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">الخصم (ج.م)</label>
          <input
            type="number"
            value={discount || ''}
            onChange={(e) => setDiscount(Number(e.target.value))}
            min={0}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">تغطية التأمين (ج.م)</label>
          <input
            type="number"
            value={insuranceCoverage || ''}
            onChange={(e) => setInsuranceCoverage(Number(e.target.value))}
            min={0}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
          />
        </div>
      </div>

      {/* Totals */}
      <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">الإجمالي الفرعي</span>
          <span className="font-medium">{subtotal.toLocaleString('ar-EG')} ج.م</span>
        </div>
        {discount > 0 && (
          <div className="flex justify-between text-red-600">
            <span>خصم</span>
            <span>- {discount.toLocaleString('ar-EG')} ج.م</span>
          </div>
        )}
        {insuranceCoverage > 0 && (
          <div className="flex justify-between text-blue-600">
            <span>تغطية تأمين</span>
            <span>- {insuranceCoverage.toLocaleString('ar-EG')} ج.م</span>
          </div>
        )}
        <div className="flex justify-between border-t border-gray-200 pt-2 text-base font-bold">
          <span>المريض يدفع</span>
          <span className="text-emerald-700">{patientPays.toLocaleString('ar-EG')} ج.م</span>
        </div>
      </div>

      {/* Payment Method */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">طريقة الدفع</label>
        <div className="flex flex-wrap gap-2">
          {PAYMENT_METHODS.map((pm) => (
            <button
              key={pm.value}
              type="button"
              onClick={() => setPaymentMethod(pm.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                paymentMethod === pm.value
                  ? 'bg-teal-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {pm.label}
            </button>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">ملاحظات</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none resize-none"
          placeholder="ملاحظات إضافية (اختياري)"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={() => submit('issued')}
          disabled={saving || !patientName}
          className="flex-1 bg-teal-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50 transition-colors"
        >
          {saving ? 'جارٍ الحفظ...' : 'إصدار الفاتورة'}
        </button>
        <button
          type="button"
          onClick={() => submit('draft')}
          disabled={saving || !patientName}
          className="px-6 bg-gray-100 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-50 transition-colors"
        >
          حفظ كمسودة
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-6 text-gray-500 py-2.5 rounded-lg text-sm hover:bg-gray-50 transition-colors"
        >
          إلغاء
        </button>
      </div>
    </div>
  );
}
