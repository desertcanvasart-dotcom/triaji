'use client';

import { useState, useCallback } from 'react';

interface LabTestRow {
  id: string;
  testNameAr: string;
  testNameEn: string;
  priority: 'normal' | 'urgent';
  fasting: boolean;
  notes: string;
}

interface LabOrderFormData {
  clinicalIndicationAr: string;
  clinicalIndicationEn: string;
  tests: LabTestRow[];
}

interface LabOrderFormProps {
  onPreview: (data: LabOrderFormData) => void;
  onSubmit: (data: LabOrderFormData) => Promise<void>;
  loading: boolean;
}

interface QuickTest {
  nameAr: string;
  nameEn: string;
}

const QUICK_TESTS: QuickTest[] = [
  { nameAr: 'صورة دم كاملة', nameEn: 'CBC' },
  { nameAr: 'HbA1c', nameEn: 'HbA1c' },
  { nameAr: 'سكر صايم', nameEn: 'Fasting glucose' },
  { nameAr: 'دهون', nameEn: 'Lipid profile' },
  { nameAr: 'وظائف كبد', nameEn: 'Liver function' },
  { nameAr: 'وظائف كلى', nameEn: 'Kidney function' },
  { nameAr: 'هرمون الغدة', nameEn: 'TSH' },
  { nameAr: 'CRP', nameEn: 'CRP' },
  { nameAr: 'ESR', nameEn: 'ESR' },
  { nameAr: 'تحليل بول', nameEn: 'Urine analysis' },
  { nameAr: 'Vitamin D', nameEn: 'Vitamin D' },
  { nameAr: 'Vitamin B12', nameEn: 'Vitamin B12' },
  { nameAr: 'Ferritin', nameEn: 'Ferritin' },
  { nameAr: 'INR', nameEn: 'INR' },
];

function createEmptyTest(): LabTestRow {
  return {
    id: crypto.randomUUID(),
    testNameAr: '',
    testNameEn: '',
    priority: 'normal',
    fasting: false,
    notes: '',
  };
}

const inputClass =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-[Cairo] focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500';
const labelClass = 'block text-sm font-medium text-gray-700 font-[Cairo] mb-1';

export default function LabOrderForm({ onPreview, onSubmit, loading }: LabOrderFormProps) {
  const [open, setOpen] = useState(false);
  const [clinicalIndicationAr, setClinicalIndicationAr] = useState('');
  const [clinicalIndicationEn, setClinicalIndicationEn] = useState('');
  const [tests, setTests] = useState<LabTestRow[]>([]);

  const getFormData = useCallback((): LabOrderFormData => ({
    clinicalIndicationAr,
    clinicalIndicationEn,
    tests,
  }), [clinicalIndicationAr, clinicalIndicationEn, tests]);

  const addQuickTest = (qt: QuickTest) => {
    const alreadyAdded = tests.some(
      (t) => t.testNameEn === qt.nameEn && t.testNameAr === qt.nameAr
    );
    if (alreadyAdded) return;

    setTests((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        testNameAr: qt.nameAr,
        testNameEn: qt.nameEn,
        priority: 'normal',
        fasting: false,
        notes: '',
      },
    ]);
  };

  const updateTest = (id: string, field: keyof LabTestRow, value: string | boolean) => {
    setTests((prev) =>
      prev.map((t) => (t.id === id ? { ...t, [field]: value } : t))
    );
  };

  const removeTest = (id: string) => {
    setTests((prev) => prev.filter((t) => t.id !== id));
  };

  const addEmptyTest = () => {
    setTests((prev) => [...prev, createEmptyTest()]);
  };

  const handlePreview = () => {
    onPreview(getFormData());
  };

  const handleSubmit = async () => {
    await onSubmit(getFormData());
  };

  const isQuickTestAdded = (qt: QuickTest) =>
    tests.some((t) => t.testNameEn === qt.nameEn && t.testNameAr === qt.nameAr);

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden" dir="rtl">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between px-5 py-4 text-right font-[Cairo] font-semibold text-base transition-colors ${
          open ? 'bg-white text-teal-700' : 'bg-gray-50 text-gray-800 hover:bg-gray-100'
        }`}
      >
        <span>{open ? '➖ إغلاق' : '➕ طلب تحاليل دم أو مخبرية'}</span>
      </button>

      {open && (
        <div className="p-5 space-y-6 bg-white">
          {/* Clinical indication */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>السبب السريري بالعربي</label>
              <input
                type="text"
                dir="rtl"
                className={inputClass}
                placeholder="مثال: متابعة سكر الدم"
                value={clinicalIndicationAr}
                onChange={(e) => setClinicalIndicationAr(e.target.value)}
              />
            </div>
            <div>
              <label className={`${labelClass} text-left`}>Clinical indication in English</label>
              <input
                type="text"
                dir="ltr"
                className={`${inputClass} text-left`}
                placeholder="e.g. Blood sugar monitoring"
                value={clinicalIndicationEn}
                onChange={(e) => setClinicalIndicationEn(e.target.value)}
              />
            </div>
          </div>

          {/* Quick-add pills */}
          <div>
            <label className={labelClass}>إضافة سريعة</label>
            <div className="flex flex-wrap gap-2">
              {QUICK_TESTS.map((qt) => {
                const added = isQuickTestAdded(qt);
                return (
                  <button
                    key={qt.nameEn}
                    type="button"
                    onClick={() => addQuickTest(qt)}
                    disabled={added}
                    className={`rounded-full px-3 py-1 text-xs font-[Cairo] transition-colors ${
                      added
                        ? 'bg-teal-100 text-teal-700 border border-teal-300'
                        : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
                    }`}
                  >
                    {qt.nameAr} ({qt.nameEn})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Test rows */}
          <div className="space-y-4">
            <h3 className="font-[Cairo] font-semibold text-gray-800">التحاليل المطلوبة</h3>
            {tests.map((test, index) => (
              <div
                key={test.id}
                className="bg-gray-50 rounded-lg p-4 border border-gray-200 space-y-3"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-[Cairo] font-medium text-gray-500">
                    تحليل #{index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeTest(test.id)}
                    className="text-red-500 text-sm font-[Cairo] hover:text-red-700"
                  >
                    🗑 حذف
                  </button>
                </div>

                {/* Test name */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>اسم التحليل بالعربي *</label>
                    <input
                      type="text"
                      dir="rtl"
                      required
                      className={inputClass}
                      value={test.testNameAr}
                      onChange={(e) => updateTest(test.id, 'testNameAr', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={`${labelClass} text-left`}>Test name in English</label>
                    <input
                      type="text"
                      dir="ltr"
                      className={`${inputClass} text-left`}
                      value={test.testNameEn}
                      onChange={(e) => updateTest(test.id, 'testNameEn', e.target.value)}
                    />
                  </div>
                </div>

                {/* Priority + Fasting toggles */}
                <div className="flex flex-wrap items-center gap-6">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-[Cairo] text-gray-600">الأولوية:</span>
                    <div className="flex rounded-lg border border-gray-300 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => updateTest(test.id, 'priority', 'normal')}
                        className={`px-3 py-1 text-xs font-[Cairo] transition-colors ${
                          test.priority === 'normal'
                            ? 'bg-teal-600 text-white'
                            : 'bg-white text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        عادي
                      </button>
                      <button
                        type="button"
                        onClick={() => updateTest(test.id, 'priority', 'urgent')}
                        className={`px-3 py-1 text-xs font-[Cairo] transition-colors ${
                          test.priority === 'urgent'
                            ? 'bg-red-500 text-white'
                            : 'bg-white text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        عاجل
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-sm font-[Cairo] text-gray-600">صايم مطلوب:</span>
                    <div className="flex rounded-lg border border-gray-300 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => updateTest(test.id, 'fasting', true)}
                        className={`px-3 py-1 text-xs font-[Cairo] transition-colors ${
                          test.fasting
                            ? 'bg-teal-600 text-white'
                            : 'bg-white text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        نعم
                      </button>
                      <button
                        type="button"
                        onClick={() => updateTest(test.id, 'fasting', false)}
                        className={`px-3 py-1 text-xs font-[Cairo] transition-colors ${
                          !test.fasting
                            ? 'bg-teal-600 text-white'
                            : 'bg-white text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        لا
                      </button>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className={labelClass}>ملاحظات</label>
                  <input
                    type="text"
                    dir="rtl"
                    className={inputClass}
                    value={test.notes}
                    onChange={(e) => updateTest(test.id, 'notes', e.target.value)}
                  />
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={addEmptyTest}
              className="text-teal-600 font-[Cairo] font-medium text-sm hover:text-teal-700"
            >
              ➕ إضافة تحليل
            </button>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={handlePreview}
              disabled={loading}
              className="flex-1 rounded-lg border-2 border-teal-600 text-teal-600 py-2.5 font-[Cairo] font-semibold text-sm hover:bg-teal-50 transition-colors disabled:opacity-50"
            >
              معاينة الطلب
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 rounded-lg bg-teal-600 text-white py-2.5 font-[Cairo] font-semibold text-sm hover:bg-teal-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'جاري الحفظ...' : 'حفظ وإرسال للمريض'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
