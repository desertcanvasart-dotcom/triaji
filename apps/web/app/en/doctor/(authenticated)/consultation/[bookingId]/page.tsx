'use client';

// TODO: Phase 17 — Add lab order routing UI here.
// After doctor creates a lab/imaging order, show a "Route to Lab" button
// that calls POST /api/lab/route-order with the health_record_id + selected lab_tenant_id.
// Use the GET /api/lab/nearby endpoint to let the doctor pick a lab.

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import PrescriptionForm from '@/components/doctor/PrescriptionForm';
import LabOrderForm from '@/components/doctor/LabOrderForm';
import ImagingOrderForm from '@/components/doctor/ImagingOrderForm';
import ConsultationSummaryForm from '@/components/doctor/ConsultationSummaryForm';
import PDFPreviewModal from '@/components/doctor/PDFPreviewModal';

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

function formatDateEn(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
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
      return { label: 'Video call', className: 'bg-blue-50 text-blue-700' };
    case 'in_person':
      return { label: 'In-person visit', className: 'bg-green-50 text-green-700' };
    default:
      return { label: type, className: 'bg-gray-50 text-gray-700' };
  }
}

function getUrgencyBadge(level: string): { label: string; className: string } {
  switch (level) {
    case 'emergency':
      return { label: 'Emergency', className: 'bg-red-100 text-red-800' };
    case 'urgent':
      return { label: 'Urgent', className: 'bg-orange-100 text-orange-800' };
    case 'semi_urgent':
      return { label: 'Semi-urgent', className: 'bg-yellow-100 text-yellow-800' };
    case 'routine':
      return { label: 'Routine', className: 'bg-green-100 text-green-800' };
    default:
      return { label: level, className: 'bg-gray-100 text-gray-700' };
  }
}

function getBmiCategory(bmi: number): string {
  if (bmi < 18.5) return 'Underweight';
  if (bmi < 25) return 'Normal';
  if (bmi < 30) return 'Overweight';
  return 'Obese';
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
  if (sex === 'male') return 'Male';
  if (sex === 'female') return 'Female';
  return 'Not specified';
}

function getSmokingLabel(status: string): string {
  switch (status) {
    case 'current': return 'Current smoker';
    case 'former': return 'Former smoker';
    case 'never': return 'Non-smoker';
    default: return status;
  }
}

function getBpLabel(bp: string, onMed: boolean): string {
  const labels: Record<string, string> = {
    normal: 'Normal',
    elevated: 'Elevated',
    high_stage1: 'High — Stage 1',
    high_stage2: 'High — Stage 2',
    unknown: 'Unknown',
  };
  const label = labels[bp] ?? bp;
  return onMed ? `${label} (on medication)` : label;
}

function getDiabetesLabel(type: string, control: string): string {
  if (type === 'none') return 'None';
  const types: Record<string, string> = {
    type1: 'Type 1',
    type2: 'Type 2',
    gestational: 'Gestational',
  };
  const controls: Record<string, string> = {
    controlled: 'Controlled',
    uncontrolled: 'Uncontrolled',
    unknown: 'Unknown',
  };
  return `${types[type] ?? type} — ${controls[control] ?? control}`;
}

function getHeartLabel(condition: string, previousAttack: boolean): string {
  if (condition === 'none') return 'None';
  const label = condition === 'heart_failure' ? 'Heart failure' : condition;
  return previousAttack ? `${label} (previous heart attack)` : label;
}

function getKidneyLabel(disease: string): string {
  const labels: Record<string, string> = {
    none: 'None',
    mild: 'Mild',
    moderate: 'Moderate',
    severe: 'Severe',
    dialysis: 'Dialysis',
  };
  return labels[disease] ?? disease;
}

function getLiverLabel(disease: string): string {
  const labels: Record<string, string> = {
    none: 'None',
    mild: 'Mild',
    moderate: 'Moderate',
    severe: 'Severe',
    cirrhosis: 'Cirrhosis',
  };
  return labels[disease] ?? disease;
}

function getRecordTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    prescription: 'Prescription',
    lab_result: 'Lab result',
    radiology: 'Radiology',
    report: 'Medical report',
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
      aria-label="Close image"
    >
      <div className="relative max-w-3xl max-h-[90vh] w-full" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={onClose}
          className="absolute -top-10 right-0 text-white text-sm hover:text-gray-300 transition-colors"
        >
          Close
        </button>
        <Image
          src={src}
          alt="Uploaded image"
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
          setError('Failed to load consultation data');
          return;
        }
        const json = (await res.json()) as ConsultationData;
        setData(json);
        setNotes(json.summary?.doctor_notes_ar ?? '');
      } catch {
        setError('Cannot connect to server');
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
        router.push('/en/doctor/dashboard');
      } else {
        setError('Failed to complete appointment');
        setCompleting(false);
      }
    } catch {
      setError('Cannot connect to server');
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
        setDocError(err.error || 'Error generating preview');
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
      setDocError('Error connecting to server');
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
        setDocError(err.error || 'Error saving document');
        return;
      }

      const result = await res.json();
      const typeLabels: Record<string, string> = {
        prescription: 'Prescription',
        lab_order: 'Lab order',
        imaging_order: 'Imaging order',
        consultation_summary: 'Consultation summary',
      };
      const sent = result.whatsappSent ? ' and sent via WhatsApp' : '';
      setDocSuccess(`${typeLabels[documentType] ?? 'Document'} saved successfully (${result.documentNumber})${sent}`);
      setOpenAccordion(null);
    } catch {
      setDocError('Error connecting to server');
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
      <div className="p-8 max-w-4xl mx-auto" dir="ltr">
        <div className="bg-red-50 text-red-700 rounded-xl p-4 text-center">{error}</div>
        <Link
          href="/en/doctor/dashboard"
          className="block mt-4 text-teal-600 hover:text-teal-700 text-sm font-medium text-center"
        >
          Back to appointments
        </Link>
      </div>
    );
  }

  if (!data) return null;

  const { booking, patient, profile, summary, images, healthRecords, hasConsent } = data;
  const typeBadge = getAppointmentTypeBadge(booking.appointment_type);

  return (
    <div className="p-6 sm:p-8 max-w-4xl mx-auto space-y-6 pb-32" dir="ltr">
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
        href="/en/doctor/dashboard"
        className="inline-flex items-center gap-1 text-sm text-teal-600 hover:text-teal-700 font-medium transition-colors"
      >
        <span className="text-lg leading-none">&larr;</span>
        Back to appointments
      </Link>

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-[#1A2F4A]">Patient consultation</h1>
        <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-gray-600">
          <span>{formatDateEn(booking.appointment_datetime)}</span>
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
          Pre-consultation summary
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
          Consultation documents
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
          <h2 className="text-lg font-bold text-[#1A2F4A]">Basic patient information</h2>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-500 block mb-0.5">Sex</span>
              <span className="font-medium text-[#1A2F4A]">{getSexLabel(profile.biological_sex)}</span>
            </div>
            <div>
              <span className="text-gray-500 block mb-0.5">Age</span>
              <span className="font-medium text-[#1A2F4A]">
                {profile.age !== null ? `${profile.age} years` : 'Not specified'}
              </span>
            </div>
            <div>
              <span className="text-gray-500 block mb-0.5">Governorate</span>
              <span className="font-medium text-[#1A2F4A]">
                {profile.governorate_name_ar ?? 'Not specified'}
              </span>
            </div>
            <div>
              <span className="text-gray-500 block mb-0.5">BMI</span>
              <span className="font-medium text-[#1A2F4A]">
                {profile.bmi !== null ? `${profile.bmi} (${getBmiCategory(profile.bmi)})` : 'Not specified'}
              </span>
            </div>
          </div>

          {/* BRS display */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-[#1A2F4A]">
                Background risk score
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
                    Smoker
                  </span>
                )}
                {profile.blood_pressure !== 'normal' && profile.blood_pressure !== 'unknown' && (
                  <span className="px-2.5 py-1 bg-orange-50 text-orange-700 rounded-full text-xs font-medium">
                    High blood pressure
                  </span>
                )}
                {profile.diabetes_type !== 'none' && (
                  <span className="px-2.5 py-1 bg-orange-50 text-orange-700 rounded-full text-xs font-medium">
                    Diabetes
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
          <h2 className="text-lg font-bold text-[#1A2F4A]">Chief complaint and symptoms</h2>

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
              <span>Recommended specialty:</span>
              <span className="font-semibold text-teal-700">{summary.specialty_name_ar}</span>
            </div>
            <div className="flex items-center gap-2">
              <span>Urgency level:</span>
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
          <h2 className="text-lg font-bold text-[#1A2F4A]">Medical history</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">Smoking</span>
              <span className="font-medium text-[#1A2F4A]">{getSmokingLabel(profile.smoking_status)}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">Blood pressure</span>
              <span className="font-medium text-[#1A2F4A]">
                {getBpLabel(profile.blood_pressure, profile.bp_on_medication)}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">Diabetes</span>
              <span className="font-medium text-[#1A2F4A]">
                {getDiabetesLabel(profile.diabetes_type, profile.diabetes_control)}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">Heart disease</span>
              <span className="font-medium text-[#1A2F4A]">
                {getHeartLabel(profile.heart_condition, profile.previous_heart_attack)}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">Kidney disease</span>
              <span className="font-medium text-[#1A2F4A]">{getKidneyLabel(profile.kidney_disease)}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">Liver disease</span>
              <span className="font-medium text-[#1A2F4A]">{getLiverLabel(profile.liver_disease)}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">Current medications</span>
              <span className="font-medium text-[#1A2F4A]">
                {profile.current_medications ?? 'None'}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">Allergies</span>
              <span className="font-medium text-[#1A2F4A]">
                {profile.known_allergies ?? 'None'}
              </span>
            </div>
          </div>
        </section>
      )}

      {/* Card 4: Health records (consent-gated) */}
      <section className="bg-white rounded-2xl shadow-sm border-t-4 border-teal-500 p-6 space-y-4">
        <h2 className="text-lg font-bold text-[#1A2F4A]">Health records</h2>

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
                          Abnormal values
                        </span>
                      )}
                      <span className="text-xs text-gray-400">
                        {new Date(record.uploaded_at).toLocaleDateString('en-US')}
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
                    View
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No health records uploaded</p>
          )
        ) : (
          <div className="bg-gray-50 rounded-xl p-6 text-center">
            <p className="text-sm text-gray-500 leading-relaxed">
              The patient has not consented to sharing their medical record yet. It will be displayed here automatically if they consent before the appointment.
            </p>
          </div>
        )}
      </section>

      {/* Card 5: Triage images */}
      {images.length > 0 && (
        <section className="bg-white rounded-2xl shadow-sm border-t-4 border-teal-500 p-6 space-y-4">
          <h2 className="text-lg font-bold text-[#1A2F4A]">Images uploaded during triage</h2>
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
                  alt="Uploaded image"
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
        <h2 className="text-lg font-bold text-[#1A2F4A]">Doctor notes</h2>

        <textarea
          value={notes}
          onChange={(e) => handleNotesChange(e.target.value)}
          placeholder="Write your notes here..."
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
            {notesSaving ? 'Saving...' : 'Save notes'}
          </button>
          {notesSaved && (
            <span className="text-sm text-green-600 font-medium animate-pulse">
              Saved
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
              {docSuccess}
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
              className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">💊</span>
                <span className="font-bold text-[#1A2F4A]">Prescription</span>
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
              className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">🧪</span>
                <span className="font-bold text-[#1A2F4A]">Lab order</span>
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
              className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">📡</span>
                <span className="font-bold text-[#1A2F4A]">Imaging order</span>
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
              className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">📋</span>
                <span className="font-bold text-[#1A2F4A]">Consultation summary</span>
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
      <div className="fixed bottom-0 left-0 right-0 md:left-64 bg-white border-t border-gray-200 p-4 z-20">
        <div className="max-w-4xl mx-auto flex gap-3">
          {booking.appointment_type === 'telehealth' ? (
            <Link
              href={`/en/telehealth/${bookingId}`}
              className="flex-1 text-center bg-teal-600 text-white font-semibold py-3 rounded-xl hover:bg-teal-700 transition-colors"
            >
              Start video call
            </Link>
          ) : (
            <button
              type="button"
              onClick={handleComplete}
              disabled={completing}
              className="flex-1 bg-teal-600 text-white font-semibold py-3 rounded-xl hover:bg-teal-700 transition-colors disabled:opacity-50"
            >
              {completing ? 'Completing...' : 'Consultation done — close appointment'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
