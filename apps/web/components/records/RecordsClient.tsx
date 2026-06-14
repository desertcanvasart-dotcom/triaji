'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { s, type Lang } from '@triaji/shared/i18n';
import type { RecordType, HealthRecord, Medication, LabValue } from '@/lib/records/types';

interface RecordsClientProps {
  lang: Lang;
}

const RECORD_TYPE_ICONS: Record<string, string> = {
  prescription: '💊',
  lab_result: '🧪',
  scan: '📄',
  discharge_summary: '📋',
  other: '📎',
};

const RECORD_TYPE_LABELS: Record<string, Record<Lang, string>> = {
  prescription: { ar: 'روشتة', en: 'Prescription' },
  lab_result: { ar: 'نتيجة تحليل', en: 'Lab Result' },
  scan: { ar: 'أشعة', en: 'Scan' },
  discharge_summary: { ar: 'تقرير خروج', en: 'Discharge Summary' },
  other: { ar: 'أخرى', en: 'Other' },
};

export default function RecordsClient({ lang }: RecordsClientProps) {
  const isRtl = lang === 'ar';
  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Upload state
  const [uploadStep, setUploadStep] = useState<'idle' | 'type' | 'file' | 'analysing' | 'review'>('idle');
  const [selectedType, setSelectedType] = useState<RecordType | null>(null);
  const [uploadingFile, setUploadingFile] = useState<File | null>(null);
  const [uploadedRecord, setUploadedRecord] = useState<HealthRecord | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Detail modal
  const [viewingRecord, setViewingRecord] = useState<HealthRecord | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch records
  const loadRecords = useCallback(async () => {
    try {
      const res = await fetch('/api/patient/records');
      if (res.status === 401) {
        window.location.href = `/${lang}/login`;
        return;
      }
      const data = (await res.json()) as { records: HealthRecord[] };
      setRecords(data.records ?? []);
    } catch {
      setError(lang === 'ar' ? 'فشل تحميل السجلات' : 'Failed to load records');
    } finally {
      setIsLoading(false);
    }
  }, [lang]);

  useEffect(() => { loadRecords(); }, [loadRecords]);

  // Upload flow
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedType) return;

    setUploadingFile(file);
    setUploadStep('analysing');
    setUploadError(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('recordType', selectedType);

    fetch('/api/patient/records', { method: 'POST', body: formData })
      .then(async (res) => {
        const data = (await res.json()) as { record?: HealthRecord; error?: string };
        if (!res.ok) throw new Error(data.error ?? 'Upload failed');
        setUploadedRecord(data.record ?? null);
        // Poll for analysis completion
        if (data.record) pollAnalysis(data.record.id);
      })
      .catch((err) => {
        setUploadError(err instanceof Error ? err.message : 'Upload failed');
        setUploadStep('idle');
      });

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const pollAnalysis = async (recordId: string) => {
    const maxAttempts = 30; // 30 seconds
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      try {
        const res = await fetch(`/api/patient/records/${recordId}`);
        const data = (await res.json()) as { record?: HealthRecord };
        if (data.record?.analysed) {
          setUploadedRecord(data.record);
          setUploadStep('review');
          loadRecords();
          return;
        }
      } catch { /* continue polling */ }
    }
    // Timeout — still show review with partial data
    setUploadStep('review');
    loadRecords();
  };

  const handleDelete = async (recordId: string) => {
    const confirmMsg = lang === 'ar' ? 'هل أنت متأكد من الحذف؟' : 'Are you sure you want to delete?';
    if (!confirm(confirmMsg)) return;

    await fetch(`/api/patient/records/${recordId}`, { method: 'DELETE' });
    setRecords((prev) => prev.filter((r) => r.id !== recordId));
    if (viewingRecord?.id === recordId) setViewingRecord(null);
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return lang === 'en'
      ? date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
      : date.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  return (
    <main className={`min-h-screen flex flex-col bg-gray-50 ${!isRtl ? 'font-sans' : ''}`} dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Header */}
      <header className="bg-teal-600 text-white py-4 px-6 shadow-md">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold">{s.common.appName[lang]}</h1>
          <span className="text-sm opacity-80">
            {lang === 'ar' ? 'سجلاتي الطبية' : 'My Health Records'}
          </span>
        </div>
      </header>

      <div className="flex-1 max-w-2xl mx-auto w-full p-4">
        {/* Upload Button */}
        <button
          onClick={() => setUploadStep('type')}
          className="w-full bg-teal-600 text-white py-3 rounded-xl font-semibold hover:bg-teal-700 transition-colors mb-6"
        >
          {lang === 'ar' ? '📤 رفع سجل طبي' : '📤 Upload Health Record'}
        </button>

        {/* Upload Type Selection */}
        {uploadStep === 'type' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 mb-4">
            <h3 className="font-semibold mb-3">{lang === 'ar' ? 'اختر نوع السجل' : 'Select record type'}</h3>
            <div className="grid grid-cols-2 gap-2">
              {(['prescription', 'lab_result', 'scan', 'other'] as RecordType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => {
                    setSelectedType(type);
                    setUploadStep('file');
                    setTimeout(() => fileInputRef.current?.click(), 100);
                  }}
                  className="flex items-center gap-2 p-3 rounded-xl border border-gray-200 hover:border-teal-500 hover:bg-teal-50 transition-colors"
                >
                  <span className="text-xl">{RECORD_TYPE_ICONS[type]}</span>
                  <span className="text-sm font-medium">{RECORD_TYPE_LABELS[type]?.[lang] ?? type}</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => setUploadStep('idle')}
              className="mt-3 text-sm text-gray-500 hover:text-gray-700"
            >
              {s.common.cancel[lang]}
            </button>
          </div>
        )}

        {/* Analysing State */}
        {uploadStep === 'analysing' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-4 text-center">
            <div className="animate-pulse text-4xl mb-3">🔍</div>
            <p className="text-gray-700 font-medium">
              {lang === 'ar' ? 'جارٍ تحليل المستند...' : 'Analysing document...'}
            </p>
            <p className="text-sm text-gray-400 mt-1">
              {lang === 'ar' ? 'ده ممكن ياخد شوية ثواني' : 'This may take a few seconds'}
            </p>
          </div>
        )}

        {/* Review Analysed Record */}
        {uploadStep === 'review' && uploadedRecord && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 mb-4">
            <h3 className="font-semibold mb-3">{lang === 'ar' ? 'نتيجة التحليل' : 'Analysis Result'}</h3>

            {uploadedRecord.record_type === 'prescription' && uploadedRecord.medications.length > 0 && (
              <div className="mb-3">
                <p className="text-sm font-medium text-gray-600 mb-1">{lang === 'ar' ? 'الأدوية:' : 'Medications:'}</p>
                {(uploadedRecord.medications as Medication[]).map((med, i) => (
                  <div key={i} className="bg-gray-50 rounded-lg p-2 mb-1 text-sm">
                    <span className="font-medium">{med.name_en ?? med.name_ar ?? '—'}</span>
                    {med.dose && <span className="text-gray-500"> • {med.dose}</span>}
                    {med.frequency && <span className="text-gray-500"> • {med.frequency}</span>}
                  </div>
                ))}
              </div>
            )}

            {uploadedRecord.record_type === 'lab_result' && uploadedRecord.lab_values.length > 0 && (
              <div className="mb-3">
                <p className="text-sm font-medium text-gray-600 mb-1">{lang === 'ar' ? 'النتائج:' : 'Results:'}</p>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-500 border-b">
                      <th className={`pb-1 ${isRtl ? 'text-right' : 'text-left'}`}>{lang === 'ar' ? 'التحليل' : 'Test'}</th>
                      <th className={`pb-1 ${isRtl ? 'text-right' : 'text-left'}`}>{lang === 'ar' ? 'النتيجة' : 'Value'}</th>
                      <th className={`pb-1 ${isRtl ? 'text-right' : 'text-left'}`}>{lang === 'ar' ? 'المرجعي' : 'Ref'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(uploadedRecord.lab_values as LabValue[]).map((val, i) => (
                      <tr key={i} className={val.is_abnormal ? 'text-red-600 font-medium' : ''}>
                        <td className="py-1">{val.test_name}</td>
                        <td className="py-1">{val.value} {val.unit}</td>
                        <td className="py-1 text-gray-400">{val.reference_range ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {(uploadedRecord.summary_ar || uploadedRecord.summary_en) && (
              <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-2 mb-3">
                {lang === 'en' ? uploadedRecord.summary_en : uploadedRecord.summary_ar}
              </p>
            )}

            {uploadedRecord.has_abnormal_values && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-sm text-red-700 mb-3">
                {lang === 'ar' ? '⚠️ يوجد نتائج غير طبيعية' : '⚠️ Abnormal values detected'}
              </div>
            )}

            <button
              onClick={() => { setUploadStep('idle'); setUploadedRecord(null); }}
              className="w-full bg-teal-600 text-white py-2 rounded-xl font-semibold hover:bg-teal-700 transition-colors"
            >
              {lang === 'ar' ? 'تأكيد وحفظ' : 'Confirm and Save'}
            </button>
          </div>
        )}

        {/* Upload Error */}
        {uploadError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">
            {uploadError}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="hidden"
          onChange={handleFileSelect}
        />

        {/* Records List */}
        {isLoading ? (
          <div className="text-center py-12 text-gray-400 animate-pulse">{s.common.loading[lang]}</div>
        ) : error ? (
          <div className="text-center py-12 text-red-500">{error}</div>
        ) : records.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-gray-500">
              {lang === 'ar' ? 'لا توجد سجلات طبية بعد' : 'No health records yet'}
            </p>
            <p className="text-sm text-gray-400 mt-1">
              {lang === 'ar' ? 'ارفع روشتة أو نتيجة تحليل' : 'Upload a prescription or lab result'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {records.map((record) => (
              <div
                key={record.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-4"
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{RECORD_TYPE_ICONS[record.record_type]}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">
                        {RECORD_TYPE_LABELS[record.record_type]?.[lang] ?? record.record_type}
                      </span>
                      {record.has_abnormal_values && (
                        <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full">
                          {lang === 'ar' ? 'يحتاج انتباه' : 'Needs attention'}
                        </span>
                      )}
                      {!record.analysed && (
                        <span className="bg-yellow-100 text-yellow-700 text-xs px-2 py-0.5 rounded-full animate-pulse">
                          {lang === 'ar' ? 'جارٍ التحليل' : 'Analysing'}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 truncate">
                      {lang === 'en'
                        ? record.summary_en ?? record.file_name
                        : record.summary_ar ?? record.file_name}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">{formatDate(record.uploaded_at)}</p>
                  </div>
                </div>

                <div className={`flex gap-2 mt-3 ${isRtl ? '' : ''}`}>
                  <button
                    onClick={() => setViewingRecord(record)}
                    className="text-xs text-teal-600 font-medium hover:text-teal-700"
                  >
                    {lang === 'ar' ? 'عرض التفاصيل' : 'View Details'}
                  </button>
                  <button
                    onClick={() => handleDelete(record.id)}
                    className="text-xs text-red-500 font-medium hover:text-red-600"
                  >
                    {s.common.delete[lang]}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {viewingRecord && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-white rounded-t-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">
                {RECORD_TYPE_ICONS[viewingRecord.record_type]}{' '}
                {RECORD_TYPE_LABELS[viewingRecord.record_type]?.[lang]}
              </h3>
              <button onClick={() => setViewingRecord(null)} className="text-gray-400 hover:text-gray-600 text-xl">
                ✕
              </button>
            </div>

            <p className="text-sm text-gray-400 mb-3">{formatDate(viewingRecord.uploaded_at)}</p>

            {(viewingRecord.summary_ar || viewingRecord.summary_en) && (
              <div className="bg-gray-50 rounded-lg p-3 mb-4">
                <p className="text-sm">{lang === 'en' ? viewingRecord.summary_en : viewingRecord.summary_ar}</p>
              </div>
            )}

            {viewingRecord.record_type === 'prescription' && (viewingRecord.medications as Medication[]).length > 0 && (
              <div className="mb-4">
                <h4 className="font-medium text-sm mb-2">{lang === 'ar' ? 'الأدوية' : 'Medications'}</h4>
                {(viewingRecord.medications as Medication[]).map((med, i) => (
                  <div key={i} className="bg-blue-50 rounded-lg p-3 mb-2">
                    <p className="font-medium">{med.name_en ?? med.name_ar ?? '—'}</p>
                    <div className="text-sm text-gray-600 mt-1">
                      {med.dose && <span>{lang === 'ar' ? 'الجرعة: ' : 'Dose: '}{med.dose}</span>}
                      {med.frequency && <span> • {lang === 'ar' ? 'التكرار: ' : 'Frequency: '}{med.frequency}</span>}
                      {med.duration && <span> • {lang === 'ar' ? 'المدة: ' : 'Duration: '}{med.duration}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {viewingRecord.record_type === 'lab_result' && (viewingRecord.lab_values as LabValue[]).length > 0 && (
              <div className="mb-4">
                <h4 className="font-medium text-sm mb-2">{lang === 'ar' ? 'النتائج' : 'Results'}</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500">
                        <th className={`p-2 ${isRtl ? 'text-right' : 'text-left'}`}>{lang === 'ar' ? 'التحليل' : 'Test'}</th>
                        <th className={`p-2 ${isRtl ? 'text-right' : 'text-left'}`}>{lang === 'ar' ? 'النتيجة' : 'Value'}</th>
                        <th className={`p-2 ${isRtl ? 'text-right' : 'text-left'}`}>{lang === 'ar' ? 'الوحدة' : 'Unit'}</th>
                        <th className={`p-2 ${isRtl ? 'text-right' : 'text-left'}`}>{lang === 'ar' ? 'المرجعي' : 'Ref Range'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(viewingRecord.lab_values as LabValue[]).map((val, i) => (
                        <tr key={i} className={`border-t ${val.is_abnormal ? 'bg-red-50 text-red-700 font-medium' : ''}`}>
                          <td className="p-2">{val.test_name}</td>
                          <td className="p-2">{val.value}</td>
                          <td className="p-2">{val.unit}</td>
                          <td className="p-2 text-gray-400">{val.reference_range ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {viewingRecord.prescribing_doctor && (
              <p className="text-sm text-gray-500 mb-2">
                {lang === 'ar' ? 'الدكتور: ' : 'Doctor: '}{viewingRecord.prescribing_doctor}
              </p>
            )}

            {viewingRecord.lab_name && (
              <p className="text-sm text-gray-500 mb-2">
                {lang === 'ar' ? 'المعمل: ' : 'Lab: '}{viewingRecord.lab_name}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="border-t bg-white py-3 px-6">
        <div className="max-w-2xl mx-auto flex items-center justify-around text-sm">
          <a href={`/${lang}/chat`} className="text-gray-500 hover:text-teal-600">{lang === 'ar' ? 'محادثة' : 'Chat'}</a>
          <a href={`/${lang}/records`} className="text-teal-600 font-semibold">{lang === 'ar' ? 'سجلاتي' : 'Records'}</a>
          <a href={`/${lang}/history`} className="text-gray-500 hover:text-teal-600">{lang === 'ar' ? 'السجل' : 'History'}</a>
        </div>
      </nav>
    </main>
  );
}
