'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface ConsultationSummaryFormData {
  historyAr: string;
  historyEn: string;
  examinationAr: string;
  examinationEn: string;
  assessmentAr: string;
  assessmentEn: string;
  planAr: string;
  planEn: string;
  followUpValue: number;
  followUpUnit: 'day' | 'week' | 'month';
}

interface ConsultationSummaryFormProps {
  onAutoSave: (data: ConsultationSummaryFormData) => void;
  onSubmit: (data: ConsultationSummaryFormData) => Promise<void>;
  loading: boolean;
  initialData?: Partial<ConsultationSummaryFormData>;
}

const FOLLOW_UP_UNITS: { value: ConsultationSummaryFormData['followUpUnit']; labelAr: string }[] = [
  { value: 'day', labelAr: 'يوم' },
  { value: 'week', labelAr: 'أسبوع' },
  { value: 'month', labelAr: 'شهر' },
];

const inputClass =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-[Cairo] focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500';
const labelClass = 'block text-sm font-medium text-gray-700 font-[Cairo] mb-1';
const textareaClass = `${inputClass} min-h-[100px] resize-y`;

export default function ConsultationSummaryForm({
  onAutoSave,
  onSubmit,
  loading,
  initialData,
}: ConsultationSummaryFormProps) {
  const [open, setOpen] = useState(false);
  const [historyAr, setHistoryAr] = useState(initialData?.historyAr ?? '');
  const [historyEn, setHistoryEn] = useState(initialData?.historyEn ?? '');
  const [examinationAr, setExaminationAr] = useState(initialData?.examinationAr ?? '');
  const [examinationEn, setExaminationEn] = useState(initialData?.examinationEn ?? '');
  const [assessmentAr, setAssessmentAr] = useState(initialData?.assessmentAr ?? '');
  const [assessmentEn, setAssessmentEn] = useState(initialData?.assessmentEn ?? '');
  const [planAr, setPlanAr] = useState(initialData?.planAr ?? '');
  const [planEn, setPlanEn] = useState(initialData?.planEn ?? '');
  const [followUpValue, setFollowUpValue] = useState(initialData?.followUpValue ?? 0);
  const [followUpUnit, setFollowUpUnit] = useState<ConsultationSummaryFormData['followUpUnit']>(
    initialData?.followUpUnit ?? 'day'
  );
  const [saved, setSaved] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getFormData = useCallback((): ConsultationSummaryFormData => ({
    historyAr,
    historyEn,
    examinationAr,
    examinationEn,
    assessmentAr,
    assessmentEn,
    planAr,
    planEn,
    followUpValue,
    followUpUnit,
  }), [
    historyAr, historyEn, examinationAr, examinationEn,
    assessmentAr, assessmentEn, planAr, planEn,
    followUpValue, followUpUnit,
  ]);

  // Debounced auto-save
  useEffect(() => {
    if (!open) return;

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      onAutoSave(getFormData());
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }, 2000);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [
    open, historyAr, historyEn, examinationAr, examinationEn,
    assessmentAr, assessmentEn, planAr, planEn,
    followUpValue, followUpUnit, onAutoSave, getFormData,
  ]);

  const handleSave = () => {
    onAutoSave(getFormData());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleSubmit = async () => {
    await onSubmit(getFormData());
  };

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden" dir="rtl">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between px-5 py-4 text-right font-[Cairo] font-semibold text-base transition-colors ${
          open ? 'bg-white text-teal-700' : 'bg-gray-50 text-gray-800 hover:bg-gray-100'
        }`}
      >
        <span>{open ? '➖ إغلاق' : '➕ ملاحظات وملخص الكشف'}</span>
        {saved && (
          <span className="text-xs text-teal-600 font-normal">تم الحفظ تلقائيًا</span>
        )}
      </button>

      {open && (
        <div className="p-5 space-y-6 bg-white">
          {/* History */}
          <div>
            <h3 className="font-[Cairo] font-semibold text-gray-800 mb-3">
              الشكوى والتاريخ / History
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>بالعربي</label>
                <textarea
                  dir="rtl"
                  className={textareaClass}
                  placeholder="الشكوى الرئيسية والتاريخ المرضي..."
                  value={historyAr}
                  onChange={(e) => setHistoryAr(e.target.value)}
                />
              </div>
              <div>
                <label className={`${labelClass} text-left`}>In English</label>
                <textarea
                  dir="ltr"
                  className={`${textareaClass} text-left`}
                  placeholder="Chief complaint and medical history..."
                  value={historyEn}
                  onChange={(e) => setHistoryEn(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Examination */}
          <div>
            <h3 className="font-[Cairo] font-semibold text-gray-800 mb-3">
              نتائج الفحص / Examination Findings
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>بالعربي</label>
                <textarea
                  dir="rtl"
                  className={textareaClass}
                  placeholder="نتائج الفحص السريري..."
                  value={examinationAr}
                  onChange={(e) => setExaminationAr(e.target.value)}
                />
              </div>
              <div>
                <label className={`${labelClass} text-left`}>In English</label>
                <textarea
                  dir="ltr"
                  className={`${textareaClass} text-left`}
                  placeholder="Clinical examination findings..."
                  value={examinationEn}
                  onChange={(e) => setExaminationEn(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Assessment */}
          <div>
            <h3 className="font-[Cairo] font-semibold text-gray-800 mb-3">
              التشخيص المبدئي / Assessment
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>بالعربي</label>
                <input
                  type="text"
                  dir="rtl"
                  className={inputClass}
                  placeholder="التشخيص المبدئي..."
                  value={assessmentAr}
                  onChange={(e) => setAssessmentAr(e.target.value)}
                />
              </div>
              <div>
                <label className={`${labelClass} text-left`}>In English</label>
                <input
                  type="text"
                  dir="ltr"
                  className={`${inputClass} text-left`}
                  placeholder="Initial assessment..."
                  value={assessmentEn}
                  onChange={(e) => setAssessmentEn(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Plan */}
          <div>
            <h3 className="font-[Cairo] font-semibold text-gray-800 mb-3">
              خطة العلاج / Plan
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>بالعربي</label>
                <textarea
                  dir="rtl"
                  className={textareaClass}
                  placeholder="خطة العلاج والمتابعة..."
                  value={planAr}
                  onChange={(e) => setPlanAr(e.target.value)}
                />
              </div>
              <div>
                <label className={`${labelClass} text-left`}>In English</label>
                <textarea
                  dir="ltr"
                  className={`${textareaClass} text-left`}
                  placeholder="Treatment and follow-up plan..."
                  value={planEn}
                  onChange={(e) => setPlanEn(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Follow-up */}
          <div>
            <label className={labelClass}>موعد المتابعة</label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={0}
                className={`${inputClass} w-24`}
                value={followUpValue || ''}
                onChange={(e) => setFollowUpValue(Number(e.target.value))}
              />
              <select
                className={`${inputClass} w-32`}
                value={followUpUnit}
                onChange={(e) =>
                  setFollowUpUnit(e.target.value as ConsultationSummaryFormData['followUpUnit'])
                }
              >
                {FOLLOW_UP_UNITS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.labelAr}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={handleSave}
              disabled={loading}
              className="flex-1 rounded-lg border-2 border-teal-600 text-teal-600 py-2.5 font-[Cairo] font-semibold text-sm hover:bg-teal-50 transition-colors disabled:opacity-50"
            >
              {saved ? 'تم الحفظ' : 'حفظ الملاحظات'}
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 rounded-lg bg-teal-600 text-white py-2.5 font-[Cairo] font-semibold text-sm hover:bg-teal-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'جاري الإرسال...' : 'إرسال نسخة للمريض'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
