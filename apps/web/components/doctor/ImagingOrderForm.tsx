'use client';

import { useState, useCallback } from 'react';

type ImagingType =
  | 'xray'
  | 'mri'
  | 'ct'
  | 'ultrasound'
  | 'mammography'
  | 'dexa'
  | 'pet'
  | 'other';

type BodySide = 'right' | 'left' | 'both' | 'na';

interface ImagingRow {
  id: string;
  imagingType: ImagingType;
  bodyRegionAr: string;
  bodyRegionEn: string;
  side: BodySide;
  withContrast: boolean;
  priority: 'normal' | 'urgent';
  clinicalReason: string;
}

interface ImagingOrderFormData {
  clinicalIndicationAr: string;
  clinicalIndicationEn: string;
  imagingRequests: ImagingRow[];
}

interface ImagingOrderFormProps {
  onPreview: (data: ImagingOrderFormData) => void;
  onSubmit: (data: ImagingOrderFormData) => Promise<void>;
  loading: boolean;
}

const IMAGING_TYPES: { value: ImagingType; labelAr: string; labelEn: string }[] = [
  { value: 'xray', labelAr: 'أشعة سينية', labelEn: 'X-Ray' },
  { value: 'mri', labelAr: 'رنين مغناطيسي', labelEn: 'MRI' },
  { value: 'ct', labelAr: 'أشعة مقطعية', labelEn: 'CT Scan' },
  { value: 'ultrasound', labelAr: 'موجات صوتية', labelEn: 'Ultrasound' },
  { value: 'mammography', labelAr: 'ماموجرام', labelEn: 'Mammography' },
  { value: 'dexa', labelAr: 'قياس كثافة العظام', labelEn: 'Bone Density/DEXA' },
  { value: 'pet', labelAr: 'PET Scan', labelEn: 'PET Scan' },
  { value: 'other', labelAr: 'أخرى', labelEn: 'Other' },
];

const BODY_SIDES: { value: BodySide; labelAr: string }[] = [
  { value: 'right', labelAr: 'أيمن' },
  { value: 'left', labelAr: 'أيسر' },
  { value: 'both', labelAr: 'كلاهما' },
  { value: 'na', labelAr: 'لا ينطبق' },
];

const CONTRAST_ELIGIBLE_TYPES: ImagingType[] = ['mri', 'ct'];

function createEmptyImaging(): ImagingRow {
  return {
    id: crypto.randomUUID(),
    imagingType: 'xray',
    bodyRegionAr: '',
    bodyRegionEn: '',
    side: 'na',
    withContrast: false,
    priority: 'normal',
    clinicalReason: '',
  };
}

const inputClass =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-[Cairo] focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500';
const labelClass = 'block text-sm font-medium text-gray-700 font-[Cairo] mb-1';

export default function ImagingOrderForm({ onPreview, onSubmit, loading }: ImagingOrderFormProps) {
  const [open, setOpen] = useState(false);
  const [clinicalIndicationAr, setClinicalIndicationAr] = useState('');
  const [clinicalIndicationEn, setClinicalIndicationEn] = useState('');
  const [imagingRequests, setImagingRequests] = useState<ImagingRow[]>([createEmptyImaging()]);

  const getFormData = useCallback((): ImagingOrderFormData => ({
    clinicalIndicationAr,
    clinicalIndicationEn,
    imagingRequests,
  }), [clinicalIndicationAr, clinicalIndicationEn, imagingRequests]);

  const updateImaging = (id: string, field: keyof ImagingRow, value: string | boolean) => {
    setImagingRequests((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const updated = { ...r, [field]: value };
        // Reset contrast when switching to non-eligible type
        if (
          field === 'imagingType' &&
          !CONTRAST_ELIGIBLE_TYPES.includes(value as ImagingType)
        ) {
          updated.withContrast = false;
        }
        return updated;
      })
    );
  };

  const removeImaging = (id: string) => {
    setImagingRequests((prev) => prev.filter((r) => r.id !== id));
  };

  const addImaging = () => {
    setImagingRequests((prev) => [...prev, createEmptyImaging()]);
  };

  const handlePreview = () => {
    onPreview(getFormData());
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
        <span>{open ? '➖ إغلاق' : '➕ طلب أشعة أو تصوير طبي'}</span>
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
                placeholder="مثال: ألم أسفل الظهر مزمن"
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
                placeholder="e.g. Chronic lower back pain"
                value={clinicalIndicationEn}
                onChange={(e) => setClinicalIndicationEn(e.target.value)}
              />
            </div>
          </div>

          {/* Imaging rows */}
          <div className="space-y-4">
            <h3 className="font-[Cairo] font-semibold text-gray-800">طلبات الأشعة</h3>
            {imagingRequests.map((req, index) => (
              <div
                key={req.id}
                className="bg-gray-50 rounded-lg p-4 border border-gray-200 space-y-3"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-[Cairo] font-medium text-gray-500">
                    طلب #{index + 1}
                  </span>
                  {imagingRequests.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeImaging(req.id)}
                      className="text-red-500 text-sm font-[Cairo] hover:text-red-700"
                    >
                      🗑 حذف
                    </button>
                  )}
                </div>

                {/* Imaging type */}
                <div>
                  <label className={labelClass}>نوع الأشعة *</label>
                  <select
                    className={inputClass}
                    value={req.imagingType}
                    onChange={(e) => updateImaging(req.id, 'imagingType', e.target.value)}
                  >
                    {IMAGING_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.labelAr} ({t.labelEn})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Body region */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>منطقة الجسم بالعربي *</label>
                    <input
                      type="text"
                      dir="rtl"
                      required
                      className={inputClass}
                      placeholder="مثال: الفقرات القطنية"
                      value={req.bodyRegionAr}
                      onChange={(e) => updateImaging(req.id, 'bodyRegionAr', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={`${labelClass} text-left`}>Body region in English</label>
                    <input
                      type="text"
                      dir="ltr"
                      className={`${inputClass} text-left`}
                      placeholder="e.g. Lumbar spine"
                      value={req.bodyRegionEn}
                      onChange={(e) => updateImaging(req.id, 'bodyRegionEn', e.target.value)}
                    />
                  </div>
                </div>

                {/* Side */}
                <div>
                  <label className={labelClass}>الجانب</label>
                  <select
                    className={inputClass}
                    value={req.side}
                    onChange={(e) => updateImaging(req.id, 'side', e.target.value)}
                  >
                    {BODY_SIDES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.labelAr}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Contrast toggle - only for MRI and CT */}
                {CONTRAST_ELIGIBLE_TYPES.includes(req.imagingType) && (
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-[Cairo] text-gray-600">مع صبغة:</span>
                    <div className="flex rounded-lg border border-gray-300 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => updateImaging(req.id, 'withContrast', true)}
                        className={`px-3 py-1 text-xs font-[Cairo] transition-colors ${
                          req.withContrast
                            ? 'bg-teal-600 text-white'
                            : 'bg-white text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        نعم
                      </button>
                      <button
                        type="button"
                        onClick={() => updateImaging(req.id, 'withContrast', false)}
                        className={`px-3 py-1 text-xs font-[Cairo] transition-colors ${
                          !req.withContrast
                            ? 'bg-teal-600 text-white'
                            : 'bg-white text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        لا
                      </button>
                    </div>
                  </div>
                )}

                {/* Priority */}
                <div className="flex items-center gap-3">
                  <span className="text-sm font-[Cairo] text-gray-600">الأولوية:</span>
                  <div className="flex rounded-lg border border-gray-300 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => updateImaging(req.id, 'priority', 'normal')}
                      className={`px-3 py-1 text-xs font-[Cairo] transition-colors ${
                        req.priority === 'normal'
                          ? 'bg-teal-600 text-white'
                          : 'bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      عادي
                    </button>
                    <button
                      type="button"
                      onClick={() => updateImaging(req.id, 'priority', 'urgent')}
                      className={`px-3 py-1 text-xs font-[Cairo] transition-colors ${
                        req.priority === 'urgent'
                          ? 'bg-red-500 text-white'
                          : 'bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      عاجل
                    </button>
                  </div>
                </div>

                {/* Clinical reason */}
                <div>
                  <label className={labelClass}>السبب السريري</label>
                  <input
                    type="text"
                    dir="rtl"
                    className={inputClass}
                    value={req.clinicalReason}
                    onChange={(e) => updateImaging(req.id, 'clinicalReason', e.target.value)}
                  />
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={addImaging}
              className="text-teal-600 font-[Cairo] font-medium text-sm hover:text-teal-700"
            >
              ➕ إضافة طلب أشعة
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
