'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { s, type Lang } from '@triaji/shared/i18n';

interface SessionSummary {
  id: string;
  session_id: string;
  chief_complaint_ar: string;
  symptoms_ar: string[];
  specialty_name_ar: string | null;
  urgency_level: string | null;
  doctor_name_ar: string | null;
  appointment_datetime: string | null;
  outcome: string;
  patient_notes_ar: string | null;
  created_at: string;
  // Payment fields (populated when a booking has a payment transaction)
  payment_status?: 'pending' | 'completed' | 'expired' | null;
  payment_reference?: string | null;
  payment_amount_egp?: number | null;
  payment_completed_at?: string | null;
}

// ─── Payment Status Badge ─────────────────────────────────────────────────────

const PAYMENT_BADGE_MAP: Record<string, { ar: string; en: string; className: string }> = {
  completed: {
    ar: 'مدفوع',
    en: 'Paid',
    className: 'bg-green-100 text-green-700',
  },
  pending: {
    ar: 'غير مدفوع',
    en: 'Unpaid',
    className: 'bg-yellow-100 text-yellow-700',
  },
  expired: {
    ar: 'انتهت المدة',
    en: 'Expired',
    className: 'bg-red-100 text-red-700',
  },
  processing: {
    ar: 'قيد المعالجة',
    en: 'Processing',
    className: 'bg-gray-100 text-gray-600',
  },
};

function PaymentStatusBadge({
  status,
  reference,
  completedAt,
  lang,
}: {
  status: string;
  reference?: string | null;
  completedAt?: string | null;
  lang: Lang;
}) {
  const badge = PAYMENT_BADGE_MAP[status] ?? PAYMENT_BADGE_MAP['processing']!;
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${badge.className}`}>
        {status === 'completed' && '\u2705 '}
        {status === 'pending' && '\u23F3 '}
        {status === 'processing' && '\uD83D\uDCB3 '}
        {badge[lang]}
      </span>
      {status === 'completed' && completedAt && (
        <span className="text-xs text-gray-400">
          {new Date(completedAt).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', {
            month: 'short',
            day: 'numeric',
          })}
        </span>
      )}
      {status === 'pending' && reference && (
        <a
          href={`/${lang}/pay/${reference}`}
          className="inline-flex items-center gap-1 bg-teal-600 text-white text-xs font-semibold px-3 py-1 rounded-full hover:bg-teal-700 transition-colors"
        >
          {lang === 'ar' ? 'ادفع أونلاين' : 'Pay Online'}
        </a>
      )}
    </div>
  );
}

type ClinicalDocumentType = 'prescription' | 'lab_order' | 'imaging_order' | 'consultation_summary';

interface ClinicalDocument {
  id: string;
  session_id: string | null;
  record_type: string;
  file_name: string;
  uploaded_at: string;
  summary_ar: string | null;
  summary_en: string | null;
  doctor_authored: boolean;
  document_type: ClinicalDocumentType | null;
  document_number: string | null;
  whatsapp_sent: boolean;
  whatsapp_sent_at: string | null;
  pdf_url: string | null;
  authored_by: string | null;
}

function getDocumentTypeLabel(docType: ClinicalDocumentType | null, lang: Lang): string {
  if (!docType) return '';
  const map: Record<ClinicalDocumentType, { ar: string; en: string }> = {
    prescription: s.history.documentTypes.prescription,
    lab_order: s.history.documentTypes.lab_order,
    imaging_order: s.history.documentTypes.imaging_order,
    consultation_summary: s.history.documentTypes.consultation_summary,
  };
  return map[docType]?.[lang] ?? docType;
}

function ClinicalDocumentCard({ doc, lang }: { doc: ClinicalDocument; lang: Lang }) {
  const isRtl = lang === 'ar';
  return (
    <div className="bg-white border border-teal-200 rounded-lg p-3 space-y-2" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="flex flex-wrap items-center gap-2">
        {/* Doctor-authored badge */}
        <span className="inline-flex items-center gap-1 bg-teal-50 text-teal-700 text-xs font-semibold px-2 py-0.5 rounded-full">
          {s.history.doctorAuthored[lang]}
        </span>

        {/* Document type */}
        {doc.document_type && (
          <span className="bg-gray-100 text-gray-700 text-xs font-medium px-2 py-0.5 rounded-full">
            {getDocumentTypeLabel(doc.document_type, lang)}
          </span>
        )}

        {/* WhatsApp sent badge */}
        {doc.whatsapp_sent && (
          <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 text-xs font-semibold px-2 py-0.5 rounded-full">
            {s.history.whatsappSent[lang]} &#10003;
          </span>
        )}
      </div>

      {/* Document number */}
      {doc.document_number && (
        <p className="text-xs text-gray-500 font-mono">{doc.document_number}</p>
      )}

      {/* Summary */}
      {(lang === 'ar' ? doc.summary_ar : doc.summary_en) && (
        <p className="text-sm text-gray-700">
          {lang === 'ar' ? doc.summary_ar : doc.summary_en}
        </p>
      )}

      {/* PDF link */}
      {doc.pdf_url && (
        <a
          href={doc.pdf_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-teal-600 font-medium hover:underline"
        >
          {s.history.viewPdf[lang]}
        </a>
      )}
    </div>
  );
}

const OUTCOME_COLORS: Record<string, string> = {
  booked: 'bg-green-100 text-green-700',
  emergency_escalated: 'bg-red-100 text-red-700',
  no_booking: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-yellow-100 text-yellow-700',
};

function getOutcomeLabel(outcome: string, lang: Lang): string {
  const map: Record<string, { ar: string; en: string }> = {
    booked: s.history.outcomeBooked,
    emergency_escalated: s.history.outcomeEscalated,
    no_booking: s.history.outcomeNoBooking,
    cancelled: s.history.outcomeCancelled,
  };
  return map[outcome]?.[lang] ?? outcome;
}

function formatDateAr(dateStr: string): string {
  const date = new Date(dateStr);
  const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  const day = days[date.getDay()] ?? '';
  const month = months[date.getMonth()] ?? '';
  return `${day} ${date.getDate()} ${month} ${date.getFullYear()}`;
}

function formatDateEn(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatDate(dateStr: string, lang: Lang): string {
  return lang === 'ar' ? formatDateAr(dateStr) : formatDateEn(dateStr);
}

interface HistoryClientProps {
  lang: Lang;
}

export default function HistoryClient({ lang }: HistoryClientProps) {
  const [summaries, setSummaries] = useState<SessionSummary[]>([]);
  const [clinicalDocuments, setClinicalDocuments] = useState<ClinicalDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesText, setNotesText] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const router = useRouter();

  const isRtl = lang === 'ar';

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/patient/history', { credentials: 'include' });
      if (res.status === 401) {
        router.push(`/${lang}/login`);
        return;
      }
      const data = (await res.json()) as {
        summaries: SessionSummary[];
        clinical_documents: ClinicalDocument[];
      };
      setSummaries(data.summaries ?? []);
      setClinicalDocuments(data.clinical_documents ?? []);
    } catch {
      // Will show empty state
    } finally {
      setIsLoading(false);
    }
  }, [router, lang]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const saveNotes = async (sessionId: string) => {
    setSavingNotes(true);
    try {
      await fetch(`/api/patient/history/${sessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ notes: notesText }),
      });
      setSummaries((prev) =>
        prev.map((item) =>
          item.session_id === sessionId ? { ...item, patient_notes_ar: notesText } : item
        )
      );
      setEditingNotes(null);
    } catch {
      // Silent fail
    } finally {
      setSavingNotes(false);
    }
  };

  if (isLoading) {
    return (
      <main className="min-h-screen flex flex-col bg-gray-50" dir={isRtl ? 'rtl' : 'ltr'}>
        <header className="bg-teal-600 text-white py-4 px-6 shadow-md">
          <div className="max-w-2xl mx-auto">
            <h1 className="text-xl font-bold">{s.history.title[lang]}</h1>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-gray-400 animate-pulse">{s.common.loading[lang]}</div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col bg-gray-50" dir={isRtl ? 'rtl' : 'ltr'}>
      <header className="bg-teal-600 text-white py-4 px-6 shadow-md">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold">{s.history.title[lang]}</h1>
          <a
            href={`/${lang}/chat`}
            className="bg-white/20 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-white/30 transition-colors"
          >
            {s.history.newConversation[lang]}
          </a>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto w-full p-4 space-y-4">
          {summaries.length === 0 ? (
            <div className="text-center py-16">
              <h2 className="text-xl font-bold text-gray-700 mb-2">{s.history.emptyTitle[lang]}</h2>
              <p className="text-gray-500 mb-6">
                {s.history.emptyDescription[lang]}
              </p>
              <a
                href={`/${lang}/chat`}
                className="inline-block bg-teal-600 text-white px-8 py-3 rounded-xl font-semibold hover:bg-teal-700 transition-colors"
              >
                {s.history.startNow[lang]}
              </a>
            </div>
          ) : (
            summaries.map((summary) => {
              const isExpanded = expandedId === summary.id;
              const outcomeLabel = getOutcomeLabel(summary.outcome, lang);
              const outcomeColor = OUTCOME_COLORS[summary.outcome] ?? 'bg-gray-100 text-gray-600';

              return (
                <div
                  key={summary.id}
                  className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
                >
                  <div className="p-4">
                    {/* Date + Badges */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm text-gray-500">
                        {formatDate(summary.created_at, lang)}
                      </span>
                      <div className="flex gap-2">
                        {summary.urgency_level === 'urgent' && (
                          <span className="bg-amber-100 text-amber-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                            {s.history.urgentBadge[lang]}
                          </span>
                        )}
                        {summary.urgency_level === 'emergency' && (
                          <span className="bg-red-100 text-red-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                            {s.history.emergencyBadge[lang]}
                          </span>
                        )}
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${outcomeColor}`}>
                          {outcomeLabel}
                        </span>
                      </div>
                    </div>

                    {/* Chief complaint */}
                    <h3 className="text-base font-bold text-gray-900 mb-1">
                      {summary.chief_complaint_ar}
                    </h3>

                    {/* Specialty */}
                    {summary.specialty_name_ar && (
                      <p className="text-sm text-teal-700 font-medium mb-1">
                        {s.history.specialty[lang]} {summary.specialty_name_ar}
                      </p>
                    )}

                    {/* Doctor + Appointment */}
                    {summary.doctor_name_ar && (
                      <p className="text-sm text-gray-600">
                        {s.history.doctorLabel[lang]} {summary.doctor_name_ar}
                        {summary.appointment_datetime && (
                          <span className="text-gray-400"> — {formatDate(summary.appointment_datetime, lang)}</span>
                        )}
                      </p>
                    )}

                    {/* Payment Status Badge */}
                    {summary.payment_status && (
                      <div className="mt-2">
                        <PaymentStatusBadge
                          status={summary.payment_status}
                          reference={summary.payment_reference}
                          completedAt={summary.payment_completed_at}
                          lang={lang}
                        />
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : summary.id)}
                        className="text-sm text-teal-600 font-medium hover:underline"
                      >
                        {isExpanded ? s.history.hideDetails[lang] : s.history.showDetails[lang]}
                      </button>
                    </div>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 bg-gray-50 p-4 space-y-3">
                      {/* Symptoms */}
                      {summary.symptoms_ar.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 mb-1">{s.history.symptoms[lang]}</p>
                          <div className="flex flex-wrap gap-1">
                            {summary.symptoms_ar.map((symptom, i) => (
                              <span key={i} className="bg-white border border-gray-200 text-gray-700 text-xs px-2 py-0.5 rounded-full">
                                {symptom}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Doctor-authored clinical documents for this session */}
                      {(() => {
                        const sessionDocs = clinicalDocuments.filter(
                          (doc) => doc.session_id === summary.session_id
                        );
                        if (sessionDocs.length === 0) return null;
                        return (
                          <div>
                            <p className="text-xs font-semibold text-gray-500 mb-2">
                              {s.history.clinicalDocuments[lang]}
                            </p>
                            <div className="space-y-2">
                              {sessionDocs.map((doc) => (
                                <ClinicalDocumentCard key={doc.id} doc={doc} lang={lang} />
                              ))}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Patient notes */}
                      <div>
                        <p className="text-xs font-semibold text-gray-500 mb-1">{s.history.myNotes[lang]}</p>
                        {editingNotes === summary.session_id ? (
                          <div className="space-y-2">
                            <textarea
                              value={notesText}
                              onChange={(e) => setNotesText(e.target.value)}
                              placeholder={s.history.notesPlaceholder[lang]}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                              rows={3}
                              dir={isRtl ? 'rtl' : 'ltr'}
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => saveNotes(summary.session_id)}
                                disabled={savingNotes}
                                className="bg-teal-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50"
                              >
                                {savingNotes ? s.history.saving[lang] : s.common.save[lang]}
                              </button>
                              <button
                                onClick={() => setEditingNotes(null)}
                                className="text-gray-500 text-sm hover:text-gray-700"
                              >
                                {s.common.cancel[lang]}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            {summary.patient_notes_ar ? (
                              <p className="text-sm text-gray-700 bg-white border border-gray-200 rounded-lg px-3 py-2">
                                {summary.patient_notes_ar}
                              </p>
                            ) : (
                              <p className="text-sm text-gray-400">{s.history.noNotesYet[lang]}</p>
                            )}
                            <button
                              onClick={() => {
                                setEditingNotes(summary.session_id);
                                setNotesText(summary.patient_notes_ar ?? '');
                              }}
                              className="text-xs text-teal-600 mt-1 hover:underline"
                            >
                              {summary.patient_notes_ar ? s.history.editNotes[lang] : s.history.addNotes[lang]}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}

          {/* Standalone clinical documents (not linked to a session) */}
          {(() => {
            const sessionIds = new Set(summaries.map((item) => item.session_id));
            const unlinkedDocs = clinicalDocuments.filter(
              (doc) => !doc.session_id || !sessionIds.has(doc.session_id)
            );
            if (unlinkedDocs.length === 0) return null;
            return (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden p-4 space-y-3">
                <h3 className="text-base font-bold text-gray-900">
                  {s.history.clinicalDocuments[lang]}
                </h3>
                <div className="space-y-2">
                  {unlinkedDocs.map((doc) => (
                    <ClinicalDocumentCard key={doc.id} doc={doc} lang={lang} />
                  ))}
                </div>
              </div>
            );
          })()}

          {/* New session button at bottom */}
          {(summaries.length > 0 || clinicalDocuments.length > 0) && (
            <div className="text-center py-4">
              <a
                href={`/${lang}/chat`}
                className="inline-block bg-teal-600 text-white px-8 py-3 rounded-xl font-semibold hover:bg-teal-700 transition-colors"
              >
                {s.history.bookNewAppointment[lang]}
              </a>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
