'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import Image from 'next/image';

// The documents workflow (and its PDF preview) is behind a non-default tab, so
// these heavy forms are code-split out of the consultation route's initial JS.
const formLoader = () => (
  <div className="h-64 animate-pulse rounded-xl bg-gray-100" />
);
const PrescriptionForm = dynamic(() => import('@/components/doctor/PrescriptionForm'), { ssr: false, loading: formLoader });
const LabOrderForm = dynamic(() => import('@/components/doctor/LabOrderForm'), { ssr: false, loading: formLoader });
const ImagingOrderForm = dynamic(() => import('@/components/doctor/ImagingOrderForm'), { ssr: false, loading: formLoader });
const ConsultationSummaryForm = dynamic(() => import('@/components/doctor/ConsultationSummaryForm'), { ssr: false, loading: formLoader });
const PDFPreviewModal = dynamic(() => import('@/components/doctor/PDFPreviewModal'), { ssr: false });

// ─── Types ──────────────────────────────────────────────────────────────────

interface BookingData {
  id: string;
  appointment_datetime: string;
  appointment_type: string;
  status: string;
}

interface PatientData {
  phone_number: string;
  name_ar: string | null;
}

interface ProfileData {
  age: number | null;
  biological_sex: string | null;
  governorate_name_ar: string | null;
  bmi: number | null;
  smoking_status: string;
  blood_pressure: string;
  bp_on_medication: boolean;
  diabetes_type: string;
  diabetes_control: string;
  heart_condition: string;
  previous_heart_attack: boolean;
  kidney_disease: string;
  liver_disease: string;
  current_medications: string | null;
  known_allergies: string | null;
  background_risk_score: number;
  risk_level: string;
  chronic_conditions: string[];
}

interface SummaryData {
  chief_complaint_ar: string;
  symptoms_ar: string[];
  urgency_level: string;
  specialty_name_ar: string;
  doctor_notes_ar: string | null;
}

interface HealthRecord {
  id: string;
  record_type: string;
  file_url: string;
  summary_ar: string | null;
  medications: unknown;
  lab_values: unknown;
  has_abnormal_values: boolean;
  uploaded_at: string;
}

interface ConsultationData {
  booking: BookingData;
  patient: PatientData;
  profile: ProfileData | null;
  summary: SummaryData | null;
  images: string[];
  healthRecords: HealthRecord[];
  hasConsent: boolean;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDateAr(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('ar-EG', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getAppointmentTypeBadge(type: string): { label: string; className: string } {
  switch (type) {
    case 'telehealth':
      return { label: 'مكالمة فيديو', className: 'bg-blue-50 text-blue-700' };
    case 'in_person':
      return { label: 'كشف في العيادة', className: 'bg-green-50 text-green-700' };
    default:
      return { label: type, className: 'bg-gray-50 text-gray-700' };
  }
}

function getUrgencyBadge(level: string): { label: string; className: string } {
  switch (level) {
    case 'emergency':
      return { label: 'طوارئ', className: 'bg-red-100 text-red-800' };
    case 'urgent':
      return { label: 'عاجل', className: 'bg-orange-100 text-orange-800' };
    case 'semi_urgent':
      return { label: 'شبه عاجل', className: 'bg-yellow-100 text-yellow-800' };
    case 'routine':
      return { label: 'عادي', className: 'bg-green-100 text-green-800' };
    default:
      return { label: level, className: 'bg-gray-100 text-gray-700' };
  }
}

function getBmiCategory(bmi: number): string {
  if (bmi < 18.5) return 'نقص وزن';
  if (bmi < 25) return 'طبيعي';
  if (bmi < 30) return 'وزن زائد';
  return 'سمنة';
}

function getBrsColor(score: number): string {
  if (score <= 2) return 'bg-green-500';
  if (score <= 5) return 'bg-amber-500';
  return 'bg-red-500';
}

function getBrsTextColor(score: number): string {
  if (score <= 2) return 'text-green-700';
  if (score <= 5) return 'text-amber-700';
  return 'text-red-700';
}

function getSexLabel(sex: string | null): string {
  if (sex === 'male') return 'ذكر';
  if (sex === 'female') return 'أنثى';
  return 'غير محدد';
}

function getSmokingLabel(status: string): string {
  switch (status) {
    case 'current': return 'مدخن حاليا';
    case 'former': return 'مدخن سابق';
    case 'never': return 'غير مدخن';
    default: return status;
  }
}

function getBpLabel(bp: string, onMed: boolean): string {
  const labels: Record<string, string> = {
    normal: 'طبيعي',
    elevated: 'مرتفع',
    high_stage1: 'مرتفع - مرحلة أولى',
    high_stage2: 'مرتفع - مرحلة ثانية',
    unknown: 'غير معروف',
  };
  const label = labels[bp] ?? bp;
  return onMed ? `${label} (بيتعالج)` : label;
}

function getDiabetesLabel(type: string, control: string): string {
  if (type === 'none') return 'لا يوجد';
  const types: Record<string, string> = {
    type1: 'نوع أول',
    type2: 'نوع ثاني',
    gestational: 'سكر حمل',
  };
  const controls: Record<string, string> = {
    controlled: 'متحكم',
    uncontrolled: 'غير متحكم',
    unknown: 'غير محدد',
  };
  return `${types[type] ?? type} - ${controls[control] ?? control}`;
}

function getHeartLabel(condition: string, previousAttack: boolean): string {
  if (condition === 'none') return 'لا يوجد';
  const label = condition === 'heart_failure' ? 'قصور في القلب' : condition;
  return previousAttack ? `${label} (جلطة سابقة)` : label;
}

function getKidneyLabel(disease: string): string {
  const labels: Record<string, string> = {
    none: 'لا يوجد',
    mild: 'خفيف',
    moderate: 'متوسط',
    severe: 'حاد',
    dialysis: 'غسيل كلوي',
  };
  return labels[disease] ?? disease;
}

function getLiverLabel(disease: string): string {
  const labels: Record<string, string> = {
    none: 'لا يوجد',
    mild: 'خفيف',
    moderate: 'متوسط',
    severe: 'حاد',
    cirrhosis: 'تليف',
  };
  return labels[disease] ?? disease;
}

function getRecordTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    prescription: 'روشتة',
    lab_result: 'تحليل',
    radiology: 'أشعة',
    report: 'تقرير طبي',
  };
  return labels[type] ?? type;
}

// ─── Skeleton ───────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="p-6 sm:p-8 max-w-4xl mx-auto space-y-6 animate-pulse">
      <div className="h-5 bg-gray-200 rounded w-32" />
      <div className="h-8 bg-gray-200 rounded w-64" />
      <div className="h-4 bg-gray-200 rounded w-48" />
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-white rounded-2xl p-6 space-y-4">
          <div className="h-6 bg-gray-200 rounded w-40" />
          <div className="h-4 bg-gray-100 rounded w-full" />
          <div className="h-4 bg-gray-100 rounded w-3/4" />
        </div>
      ))}
    </div>
  );
}

// ─── Lightbox ───────────────────────────────────────────────────────────────

function Lightbox({
  src,
  onClose,
}: {
  src: string;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
      role="button"
      tabIndex={0}
      aria-label="إغلاق الصورة"
    >
      <div className="relative max-w-3xl max-h-[90vh] w-full" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={onClose}
          className="absolute -top-10 left-0 text-white text-sm hover:text-gray-300 transition-colors"
        >
          إغلاق
        </button>
        <Image
          src={src}
          alt="صورة مرفوعة"
          width={1200}
          height={800}
          className="rounded-lg object-contain max-h-[85vh] w-auto mx-auto"
        />
      </div>
    </div>
  );
}

// ─── Page Component ─────────────────────────────────────────────────────────

export default function ConsultationPage() {
  const params = useParams();
  const router = useRouter();
  const bookingId = params.bookingId as string;

  const [data, setData] = useState<ConsultationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [notes, setNotes] = useState('');
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cancel the pending notes autosave on unmount so it can't setState after
  // the component is gone (e.g. navigating away right after typing).
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const [completing, setCompleting] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  // Tab system
  type TabKey = 'summary' | 'documents';
  const [activeTab, setActiveTab] = useState<TabKey>('summary');

  // Clinical documents state
  const [openAccordion, setOpenAccordion] = useState<string | null>(null);
  const [docLoading, setDocLoading] = useState(false);
  const [docError, setDocError] = useState('');
  const [docSuccess, setDocSuccess] = useState('');
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [pendingDocType, setPendingDocType] = useState<string | null>(null);
  const [pendingDocData, setPendingDocData] = useState<Record<string, unknown> | null>(null);

  // Fetch consultation data
  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/doctor/consultation/${bookingId}`);
        if (!res.ok) {
          setError('تعذر تحميل بيانات الاستشارة');
          return;
        }
        const json = (await res.json()) as ConsultationData;
        setData(json);
        setNotes(json.summary?.doctor_notes_ar ?? '');
      } catch {
        setError('مفيش اتصال بالسيرفر');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [bookingId]);

  // Auto-save notes with debounce
  const saveNotes = useCallback(
    async (value: string) => {
      setNotesSaving(true);
      setNotesSaved(false);
      try {
        const res = await fetch(`/api/doctor/consultation/${bookingId}/notes`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notes: value }),
        });
        if (res.ok) {
          setNotesSaved(true);
          setTimeout(() => setNotesSaved(false), 2000);
        }
      } catch {
        // Silent fail for auto-save
      } finally {
        setNotesSaving(false);
      }
    },
    [bookingId]
  );

  function handleNotesChange(value: string) {
    setNotes(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => saveNotes(value), 2000);
  }

  async function handleComplete() {
    setCompleting(true);
    try {
      const res = await fetch(`/api/doctor/consultation/${bookingId}/complete`, {
        method: 'POST',
      });
      if (res.ok) {
        router.push('/ar/doctor/dashboard');
      } else {
        setError('تعذر إنهاء الموعد');
        setCompleting(false);
      }
    } catch {
      setError('مفيش اتصال بالسيرفر');
      setCompleting(false);
    }
  }

  // ─── Clinical Document Handlers ──────────────────────────────────────────

  function toggleAccordion(key: string) {
    setOpenAccordion((prev) => (prev === key ? null : key));
    setDocError('');
    setDocSuccess('');
  }

  async function handleDocPreview(documentType: string, formData: Record<string, unknown>) {
    setPendingDocType(documentType);
    setPendingDocData(formData);
    setDocError('');

    try {
      setDocLoading(true);
      const res = await fetch('/api/doctor/clinical-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId,
          documentType,
          data: formData,
          previewOnly: true,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setDocError(err.error || 'خطأ في إنشاء المعاينة');
        return;
      }

      const result = await res.json();
      if (result.pdfBase64) {
        const binary = atob(result.pdfBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        setPdfBytes(bytes);
        setPdfPreviewOpen(true);
      }
    } catch {
      setDocError('خطأ في الاتصال بالسيرفر');
    } finally {
      setDocLoading(false);
    }
  }

  async function handleDocSubmit(documentType: string, formData: Record<string, unknown>) {
    setDocError('');
    setDocSuccess('');
    setDocLoading(true);

    try {
      const res = await fetch('/api/doctor/clinical-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId,
          documentType,
          data: formData,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setDocError(err.error || 'خطأ في حفظ المستند');
        return;
      }

      const result = await res.json();
      const typeLabels: Record<string, string> = {
        prescription: 'الروشتة',
        lab_order: 'طلب التحاليل',
        imaging_order: 'طلب الأشعة',
        consultation_summary: 'ملخص الكشف',
      };
      const sent = result.whatsappSent ? ' وتم الإرسال على واتساب' : '';
      setDocSuccess(`تم حفظ ${typeLabels[documentType] ?? 'المستند'} بنجاح (${result.documentNumber})${sent}`);
      setOpenAccordion(null);
    } catch {
      setDocError('خطأ في الاتصال بالسيرفر');
    } finally {
      setDocLoading(false);
    }
  }

  async function handlePdfSend() {
    if (!pendingDocType || !pendingDocData) return;
    setPdfPreviewOpen(false);
    await handleDocSubmit(pendingDocType, pendingDocData);
    setPdfBytes(null);
    setPendingDocType(null);
    setPendingDocData(null);
  }

  if (loading) return <PageSkeleton />;

  if (error && !data) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="bg-red-50 text-red-700 rounded-xl p-4 text-center">{error}</div>
        <Link
          href="/ar/doctor/dashboard"
          className="block mt-4 text-teal-600 hover:text-teal-700 text-sm font-medium text-center"
        >
          العودة للمواعيد
        </Link>
      </div>
    );
  }

  if (!data) return null;

  const { booking, patient, profile, summary, images, healthRecords, hasConsent } = data;
  const typeBadge = getAppointmentTypeBadge(booking.appointment_type);

  return (
    <div className="p-6 sm:p-8 max-w-4xl mx-auto space-y-6 pb-32">
      {/* Lightbox */}
      {lightboxSrc && <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}

      {/* PDF Preview Modal */}
      <PDFPreviewModal
        open={pdfPreviewOpen}
        onClose={() => { setPdfPreviewOpen(false); setPdfBytes(null); }}
        onSend={handlePdfSend}
        pdfBytes={pdfBytes}
        sending={docLoading}
      />

      {/* Back link */}
      <Link
        href="/ar/doctor/dashboard"
        className="inline-flex items-center gap-1 text-sm text-teal-600 hover:text-teal-700 font-medium transition-colors"
      >
        <span className="text-lg leading-none">&larr;</span>
        العودة للمواعيد
      </Link>

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-[#1A2F4A]">استشارة المريض</h1>
        <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-gray-600">
          <span>{formatDateAr(booking.appointment_datetime)}</span>
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${typeBadge.className}`}>
            {typeBadge.label}
          </span>
          {patient.name_ar && (
            <span className="font-semibold text-[#1A2F4A]">{patient.name_ar}</span>
          )}
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex border-b border-gray-200">
        <button
          type="button"
          onClick={() => setActiveTab('summary')}
          className={`px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'summary'
              ? 'border-teal-500 text-teal-700'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          ملخص ما قبل الكشف
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('documents')}
          className={`px-6 py-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'documents'
              ? 'border-teal-500 text-teal-700'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          <span>📄</span>
          وثائق الكشف
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-red-50 text-red-700 rounded-xl p-3 text-sm">{error}</div>
      )}

      {/* ═══════════ TAB: Summary ═══════════ */}
      {activeTab === 'summary' && (<>

      {/* Card 1: Patient basic info */}
      {profile && (
        <section className="bg-white rounded-2xl shadow-sm border-t-4 border-teal-500 p-6 space-y-5">
          <h2 className="text-lg font-bold text-[#1A2F4A]">معلومات المريض الأساسية</h2>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-500 block mb-0.5">الجنس</span>
              <span className="font-medium text-[#1A2F4A]">{getSexLabel(profile.biological_sex)}</span>
            </div>
            <div>
              <span className="text-gray-500 block mb-0.5">العمر</span>
              <span className="font-medium text-[#1A2F4A]">
                {profile.age !== null ? `${profile.age} سنة` : 'غير محدد'}
              </span>
            </div>
            <div>
              <span className="text-gray-500 block mb-0.5">المحافظة</span>
              <span className="font-medium text-[#1A2F4A]">
                {profile.governorate_name_ar ?? 'غير محددة'}
              </span>
            </div>
            <div>
              <span className="text-gray-500 block mb-0.5">مؤشر كتلة الجسم</span>
              <span className="font-medium text-[#1A2F4A]">
                {profile.bmi !== null ? `${profile.bmi} (${getBmiCategory(profile.bmi)})` : 'غير محدد'}
              </span>
            </div>
          </div>

          {/* BRS display */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-[#1A2F4A]">
                درجة الخطورة الأساسية
              </span>
              <span className={`text-lg font-bold ${getBrsTextColor(profile.background_risk_score)}`}>
                {profile.background_risk_score}/10
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${getBrsColor(profile.background_risk_score)}`}
                style={{ width: `${(profile.background_risk_score / 10) * 100}%` }}
              />
            </div>

            {/* Risk tags */}
            {profile.chronic_conditions.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {profile.chronic_conditions.map((condition) => (
                  <span
                    key={condition}
                    className="px-2.5 py-1 bg-red-50 text-red-700 rounded-full text-xs font-medium"
                  >
                    {condition}
                  </span>
                ))}
                {profile.smoking_status === 'current' && (
                  <span className="px-2.5 py-1 bg-orange-50 text-orange-700 rounded-full text-xs font-medium">
                    مدخن
                  </span>
                )}
                {profile.blood_pressure !== 'normal' && profile.blood_pressure !== 'unknown' && (
                  <span className="px-2.5 py-1 bg-orange-50 text-orange-700 rounded-full text-xs font-medium">
                    ضغط مرتفع
                  </span>
                )}
                {profile.diabetes_type !== 'none' && (
                  <span className="px-2.5 py-1 bg-orange-50 text-orange-700 rounded-full text-xs font-medium">
                    سكري
                  </span>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Card 2: Chief complaint & symptoms */}
      {summary && (
        <section className="bg-white rounded-2xl shadow-sm border-t-4 border-teal-500 p-6 space-y-4">
          <h2 className="text-lg font-bold text-[#1A2F4A]">الشكوى الرئيسية والأعراض</h2>

          <p className="text-xl font-bold text-[#1A2F4A] leading-relaxed">
            {summary.chief_complaint_ar}
          </p>

          {summary.symptoms_ar.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {summary.symptoms_ar.map((symptom) => (
                <span
                  key={symptom}
                  className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full text-sm"
                >
                  {symptom}
                </span>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-4 pt-2 text-sm">
            <div className="flex items-center gap-2">
              <span>التخصص الموصى به:</span>
              <span className="font-semibold text-teal-700">{summary.specialty_name_ar}</span>
            </div>
            <div className="flex items-center gap-2">
              <span>درجة الإلحاح:</span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${getUrgencyBadge(summary.urgency_level).className}`}
              >
                {getUrgencyBadge(summary.urgency_level).label}
              </span>
            </div>
          </div>
        </section>
      )}

      {/* Card 3: Medical history */}
      {profile && (
        <section className="bg-white rounded-2xl shadow-sm border-t-4 border-teal-500 p-6 space-y-4">
          <h2 className="text-lg font-bold text-[#1A2F4A]">التاريخ الطبي</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">التدخين</span>
              <span className="font-medium text-[#1A2F4A]">{getSmokingLabel(profile.smoking_status)}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">ضغط الدم</span>
              <span className="font-medium text-[#1A2F4A]">
                {getBpLabel(profile.blood_pressure, profile.bp_on_medication)}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">السكري</span>
              <span className="font-medium text-[#1A2F4A]">
                {getDiabetesLabel(profile.diabetes_type, profile.diabetes_control)}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">أمراض القلب</span>
              <span className="font-medium text-[#1A2F4A]">
                {getHeartLabel(profile.heart_condition, profile.previous_heart_attack)}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">أمراض الكلى</span>
              <span className="font-medium text-[#1A2F4A]">{getKidneyLabel(profile.kidney_disease)}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">أمراض الكبد</span>
              <span className="font-medium text-[#1A2F4A]">{getLiverLabel(profile.liver_disease)}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">الأدوية الحالية</span>
              <span className="font-medium text-[#1A2F4A]">
                {profile.current_medications ?? 'لا يوجد'}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">الحساسية</span>
              <span className="font-medium text-[#1A2F4A]">
                {profile.known_allergies ?? 'لا يوجد'}
              </span>
            </div>
          </div>
        </section>
      )}

      {/* Card 4: Health records (consent-gated) */}
      <section className="bg-white rounded-2xl shadow-sm border-t-4 border-teal-500 p-6 space-y-4">
        <h2 className="text-lg font-bold text-[#1A2F4A]">السجل الصحي</h2>

        {hasConsent ? (
          healthRecords.length > 0 ? (
            <div className="space-y-3">
              {healthRecords.map((record) => (
                <div
                  key={record.id}
                  className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium px-2 py-0.5 bg-teal-50 text-teal-700 rounded-full">
                        {getRecordTypeLabel(record.record_type)}
                      </span>
                      {record.has_abnormal_values && (
                        <span className="text-xs font-medium px-2 py-0.5 bg-red-50 text-red-700 rounded-full">
                          قيم غير طبيعية
                        </span>
                      )}
                      <span className="text-xs text-gray-400">
                        {new Date(record.uploaded_at).toLocaleDateString('ar-EG')}
                      </span>
                    </div>
                    {record.summary_ar && (
                      <p className="text-sm text-gray-700 leading-relaxed">{record.summary_ar}</p>
                    )}
                  </div>
                  <a
                    href={record.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-teal-600 hover:text-teal-700 text-sm font-medium"
                  >
                    عرض
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">لا توجد سجلات صحية مرفوعة</p>
          )
        ) : (
          <div className="bg-gray-50 rounded-xl p-6 text-center">
            <p className="text-sm text-gray-500 leading-relaxed">
              المريض لم يوافق على مشاركة سجله الطبي بعد. سيتم عرضه هنا تلقائيا لو وافق قبل الموعد.
            </p>
          </div>
        )}
      </section>

      {/* Card 5: Triage images */}
      {images.length > 0 && (
        <section className="bg-white rounded-2xl shadow-sm border-t-4 border-teal-500 p-6 space-y-4">
          <h2 className="text-lg font-bold text-[#1A2F4A]">الصور المرفوعة في جلسة الفرز</h2>
          <div className="grid grid-cols-3 gap-3">
            {images.map((src) => (
              <button
                key={src}
                type="button"
                onClick={() => setLightboxSrc(src)}
                className="aspect-square rounded-xl overflow-hidden border border-gray-200 hover:border-teal-400 transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <Image
                  src={src}
                  alt="صورة مرفوعة"
                  width={300}
                  height={300}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Card 6: Doctor notes */}
      <section className="bg-white rounded-2xl shadow-sm border-t-4 border-teal-500 p-6 space-y-4">
        <h2 className="text-lg font-bold text-[#1A2F4A]">ملاحظات الطبيب</h2>

        <textarea
          value={notes}
          onChange={(e) => handleNotesChange(e.target.value)}
          placeholder="اكتب ملاحظاتك هنا..."
          rows={5}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none transition-colors focus:border-teal-500 bg-white resize-y leading-relaxed"
        />

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => saveNotes(notes)}
            disabled={notesSaving}
            className="px-5 py-2.5 bg-teal-600 text-white text-sm font-semibold rounded-xl hover:bg-teal-700 transition-colors disabled:opacity-50"
          >
            {notesSaving ? 'جارٍ الحفظ...' : 'حفظ الملاحظات'}
          </button>
          {notesSaved && (
            <span className="text-sm text-green-600 font-medium animate-pulse">
              تم الحفظ
            </span>
          )}
        </div>
      </section>

      {/* Close summary tab fragment */}
      </>)}

      {/* ═══════════ TAB: Documents ═══════════ */}
      {activeTab === 'documents' && (
        <div className="space-y-4">
          {/* Document success/error banners */}
          {docSuccess && (
            <div className="bg-green-50 text-green-700 rounded-xl p-3 text-sm font-medium">
              ✅ {docSuccess}
            </div>
          )}
          {docError && (
            <div className="bg-red-50 text-red-700 rounded-xl p-3 text-sm">
              {docError}
            </div>
          )}

          {/* Accordion: Prescription */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <button
              type="button"
              onClick={() => toggleAccordion('prescription')}
              className="w-full flex items-center justify-between px-6 py-4 text-right hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">💊</span>
                <span className="font-bold text-[#1A2F4A]">روشتة طبية</span>
              </div>
              <span className={`text-gray-400 transition-transform ${openAccordion === 'prescription' ? 'rotate-180' : ''}`}>
                ▼
              </span>
            </button>
            {openAccordion === 'prescription' && (
              <div className="px-6 pb-6 border-t border-gray-100">
                <PrescriptionForm
                  onPreview={(formData) => handleDocPreview('prescription', formData as unknown as Record<string, unknown>)}
                  onSubmit={(formData) => handleDocSubmit('prescription', formData as unknown as Record<string, unknown>)}
                  loading={docLoading}
                />
              </div>
            )}
          </div>

          {/* Accordion: Lab Order */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <button
              type="button"
              onClick={() => toggleAccordion('lab_order')}
              className="w-full flex items-center justify-between px-6 py-4 text-right hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">🧪</span>
                <span className="font-bold text-[#1A2F4A]">طلب تحاليل</span>
              </div>
              <span className={`text-gray-400 transition-transform ${openAccordion === 'lab_order' ? 'rotate-180' : ''}`}>
                ▼
              </span>
            </button>
            {openAccordion === 'lab_order' && (
              <div className="px-6 pb-6 border-t border-gray-100">
                <LabOrderForm
                  onPreview={(formData) => handleDocPreview('lab_order', formData as unknown as Record<string, unknown>)}
                  onSubmit={(formData) => handleDocSubmit('lab_order', formData as unknown as Record<string, unknown>)}
                  loading={docLoading}
                />
              </div>
            )}
          </div>

          {/* Accordion: Imaging Order */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <button
              type="button"
              onClick={() => toggleAccordion('imaging_order')}
              className="w-full flex items-center justify-between px-6 py-4 text-right hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">📡</span>
                <span className="font-bold text-[#1A2F4A]">طلب أشعة</span>
              </div>
              <span className={`text-gray-400 transition-transform ${openAccordion === 'imaging_order' ? 'rotate-180' : ''}`}>
                ▼
              </span>
            </button>
            {openAccordion === 'imaging_order' && (
              <div className="px-6 pb-6 border-t border-gray-100">
                <ImagingOrderForm
                  onPreview={(formData) => handleDocPreview('imaging_order', formData as unknown as Record<string, unknown>)}
                  onSubmit={(formData) => handleDocSubmit('imaging_order', formData as unknown as Record<string, unknown>)}
                  loading={docLoading}
                />
              </div>
            )}
          </div>

          {/* Accordion: Consultation Summary */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <button
              type="button"
              onClick={() => toggleAccordion('consultation_summary')}
              className="w-full flex items-center justify-between px-6 py-4 text-right hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">📋</span>
                <span className="font-bold text-[#1A2F4A]">ملخص الكشف</span>
              </div>
              <span className={`text-gray-400 transition-transform ${openAccordion === 'consultation_summary' ? 'rotate-180' : ''}`}>
                ▼
              </span>
            </button>
            {openAccordion === 'consultation_summary' && (
              <div className="px-6 pb-6 border-t border-gray-100">
                <ConsultationSummaryForm
                  onAutoSave={() => {/* auto-save handled by form */}}
                  onSubmit={(formData) => handleDocSubmit('consultation_summary', formData as unknown as Record<string, unknown>)}
                  loading={docLoading}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="fixed bottom-0 left-0 right-0 md:right-64 bg-white border-t border-gray-200 p-4 z-20">
        <div className="max-w-4xl mx-auto flex gap-3">
          {booking.appointment_type === 'telehealth' ? (
            <Link
              href={`/ar/telehealth/${bookingId}`}
              className="flex-1 text-center bg-teal-600 text-white font-semibold py-3 rounded-xl hover:bg-teal-700 transition-colors"
            >
              ابدأ مكالمة الفيديو
            </Link>
          ) : (
            <button
              type="button"
              onClick={handleComplete}
              disabled={completing}
              className="flex-1 bg-teal-600 text-white font-semibold py-3 rounded-xl hover:bg-teal-700 transition-colors disabled:opacity-50"
            >
              {completing ? 'جارٍ الإنهاء...' : 'تم الكشف — أنهِ الموعد'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
