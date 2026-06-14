'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { s, t, type Lang } from '@triaji/shared/i18n';

// ─── Types ──────────────────────────────────────────────────────────────────

type RecordType = 'visit' | 'lab' | 'prescription' | 'imaging' | 'follow_up';
type FilterType = 'all' | RecordType;

interface TimelineRecord {
  id: string;
  type: RecordType;
  date: string;
  encounter_id: string | null;
  // Visit fields
  chief_complaint_ar?: string;
  chief_complaint_en?: string;
  specialty_ar?: string;
  specialty_en?: string;
  doctor_name_ar?: string;
  doctor_name_en?: string;
  urgency_level?: string;
  outcome?: string;
  // Lab fields
  test_name_ar?: string;
  test_name_en?: string;
  value?: string;
  unit?: string;
  is_abnormal?: boolean;
  lab_order_id?: string;
  // Prescription fields
  drug_name_ar?: string;
  drug_name_en?: string;
  dose?: string;
  frequency_ar?: string;
  frequency_en?: string;
  status?: string;
  // Imaging fields
  imaging_type_ar?: string;
  imaging_type_en?: string;
  report_summary_ar?: string;
  report_summary_en?: string;
  pdf_url?: string;
  // Follow-up fields
  reason_ar?: string;
  reason_en?: string;
  follow_up_status?: 'scheduled' | 'completed' | 'overdue';
  linked_visit_id?: string;
  days_overdue?: number;
}

interface TimelineGroup {
  date: string;
  encounter_id: string | null;
  records: TimelineRecord[];
}

interface EnhancedTimelineProps {
  lang: Lang;
}

// ─── Filter config ──────────────────────────────────────────────────────────

const FILTER_OPTIONS: { key: FilterType; label_ar: string; label_en: string }[] = [
  { key: 'all', label_ar: 'الكل', label_en: 'All' },
  { key: 'visit', label_ar: 'الزيارات', label_en: 'Visits' },
  { key: 'lab', label_ar: 'التحاليل', label_en: 'Labs' },
  { key: 'prescription', label_ar: 'الروشتات', label_en: 'Prescriptions' },
  { key: 'imaging', label_ar: 'الأشعة', label_en: 'Imaging' },
  { key: 'follow_up', label_ar: 'المتابعات', label_en: 'Follow-ups' },
];

const TYPE_COLORS: Record<RecordType, string> = {
  visit: 'bg-teal-100 text-teal-700 border-teal-200',
  lab: 'bg-blue-100 text-blue-700 border-blue-200',
  prescription: 'bg-purple-100 text-purple-700 border-purple-200',
  imaging: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  follow_up: 'bg-amber-100 text-amber-700 border-amber-200',
};

const TYPE_DOT_COLORS: Record<RecordType, string> = {
  visit: 'bg-teal-500',
  lab: 'bg-blue-500',
  prescription: 'bg-purple-500',
  imaging: 'bg-indigo-500',
  follow_up: 'bg-amber-500',
};

const TYPE_LABELS: Record<RecordType, { ar: string; en: string }> = {
  visit: { ar: 'زيارة', en: 'Visit' },
  lab: { ar: 'تحليل', en: 'Lab' },
  prescription: { ar: 'روشتة', en: 'Prescription' },
  imaging: { ar: 'أشعة', en: 'Imaging' },
  follow_up: { ar: 'متابعة', en: 'Follow-up' },
};

const OUTCOME_COLORS: Record<string, string> = {
  booked: 'bg-green-100 text-green-700',
  emergency_escalated: 'bg-red-100 text-red-700',
  no_booking: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-yellow-100 text-yellow-700',
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatTimelineDate(dateStr: string, lang: Lang): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function getOutcomeLabel(outcome: string | undefined, lang: Lang): string {
  if (!outcome) return '';
  const map: Record<string, { ar: string; en: string }> = {
    booked: s.history.outcomeBooked,
    emergency_escalated: s.history.outcomeEscalated,
    no_booking: s.history.outcomeNoBooking,
    cancelled: s.history.outcomeCancelled,
  };
  return map[outcome]?.[lang] ?? outcome;
}

function matchesSearch(record: TimelineRecord, query: string, lang: Lang): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  const fields = [
    record.chief_complaint_ar,
    record.chief_complaint_en,
    record.doctor_name_ar,
    record.doctor_name_en,
    record.test_name_ar,
    record.test_name_en,
    record.drug_name_ar,
    record.drug_name_en,
    record.imaging_type_ar,
    record.imaging_type_en,
    record.specialty_ar,
    record.specialty_en,
    record.reason_ar,
    record.reason_en,
  ];
  return fields.some((f) => f?.toLowerCase().includes(q));
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function EnhancedTimeline({ lang }: EnhancedTimelineProps) {
  const isRtl = lang === 'ar';
  const router = useRouter();

  const [records, setRecords] = useState<TimelineRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [search, setSearch] = useState('');

  const fetchTimeline = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/patient/medical-record/timeline', {
        credentials: 'include',
      });
      if (res.status === 401) {
        router.push(`/${lang}/login`);
        return;
      }
      if (!res.ok) {
        // Fallback to existing history API
        const fallback = await fetch('/api/patient/history', { credentials: 'include' });
        if (fallback.status === 401) {
          router.push(`/${lang}/login`);
          return;
        }
        if (fallback.ok) {
          const data = await fallback.json() as {
            summaries: Array<{
              id: string;
              session_id: string;
              chief_complaint_ar: string;
              specialty_name_ar: string | null;
              doctor_name_ar: string | null;
              urgency_level: string | null;
              appointment_datetime: string | null;
              outcome: string;
              created_at: string;
            }>;
          };
          // Convert summaries to timeline records
          const converted: TimelineRecord[] = (data.summaries ?? []).map((s) => ({
            id: s.id,
            type: 'visit' as RecordType,
            date: s.created_at,
            encounter_id: s.session_id,
            chief_complaint_ar: s.chief_complaint_ar,
            specialty_ar: s.specialty_name_ar ?? undefined,
            doctor_name_ar: s.doctor_name_ar ?? undefined,
            urgency_level: s.urgency_level ?? undefined,
            outcome: s.outcome,
          }));
          setRecords(converted);
        }
        return;
      }
      const data = await res.json() as { records: TimelineRecord[] };
      setRecords(data.records ?? []);
    } catch {
      // Silent
    } finally {
      setIsLoading(false);
    }
  }, [router, lang]);

  useEffect(() => {
    fetchTimeline();
  }, [fetchTimeline]);

  // ─── Filter + search ──────────────────────────────────────────────────

  const filtered = useMemo(() => {
    return records.filter((r) => {
      if (filter !== 'all' && r.type !== filter) return false;
      if (search && !matchesSearch(r, search, lang)) return false;
      return true;
    });
  }, [records, filter, search, lang]);

  // ─── Group by date + encounter ────────────────────────────────────────

  const groups = useMemo(() => {
    const map = new Map<string, TimelineGroup>();

    for (const r of filtered) {
      const dateKey = r.date.slice(0, 10); // YYYY-MM-DD
      const groupKey = r.encounter_id ? `${dateKey}::${r.encounter_id}` : `${dateKey}::${r.id}`;

      if (!map.has(groupKey)) {
        map.set(groupKey, {
          date: r.date,
          encounter_id: r.encounter_id,
          records: [],
        });
      }
      map.get(groupKey)!.records.push(r);
    }

    // Sort groups by date descending
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [filtered]);

  // Build a map of linked records for connection lines
  const linkedRecordIds = useMemo(() => {
    const linked = new Set<string>();
    for (const r of records) {
      if (r.lab_order_id) linked.add(r.lab_order_id);
      if (r.linked_visit_id) linked.add(r.linked_visit_id);
    }
    return linked;
  }, [records]);

  // ─── Loading ──────────────────────────────────────────────────────────

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

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen flex flex-col bg-gray-50" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Header */}
      <header className="bg-teal-600 text-white py-4 px-6 shadow-md">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold">{s.history.title[lang]}</h1>
          <div className="flex gap-2">
            <a
              href={`/${lang}/medical-record`}
              className="bg-white/20 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-white/30 transition-colors"
            >
              {t('medicalRecord.pageTitle', lang)}
            </a>
            <a
              href={`/${lang}/chat`}
              className="bg-white/20 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-white/30 transition-colors"
            >
              {s.history.newConversation[lang]}
            </a>
          </div>
        </div>
      </header>

      {/* Filter bar + Search */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto space-y-3">
          {/* Search input */}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              lang === 'ar'
                ? 'ابحث بالدكتور، الدواء، التحليل...'
                : 'Search by doctor, drug, test...'
            }
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            dir={isRtl ? 'rtl' : 'ltr'}
          />

          {/* Filter pills */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setFilter(opt.key)}
                className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                  filter === opt.key
                    ? 'bg-teal-600 text-white border-teal-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-teal-400'
                }`}
              >
                {lang === 'ar' ? opt.label_ar : opt.label_en}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto w-full p-4">
          {groups.length === 0 ? (
            <div className="text-center py-16">
              <h2 className="text-xl font-bold text-gray-700 mb-2">
                {filter === 'all' ? s.history.emptyTitle[lang] : (lang === 'ar' ? 'لا توجد نتائج' : 'No results')}
              </h2>
              <p className="text-gray-500 mb-6">
                {filter === 'all'
                  ? s.history.emptyDescription[lang]
                  : lang === 'ar'
                    ? 'جرب فلتر أو بحث مختلف'
                    : 'Try a different filter or search term'}
              </p>
              {filter === 'all' && (
                <a
                  href={`/${lang}/chat`}
                  className="inline-block bg-teal-600 text-white px-8 py-3 rounded-xl font-semibold hover:bg-teal-700 transition-colors"
                >
                  {s.history.startNow[lang]}
                </a>
              )}
            </div>
          ) : (
            <div className="relative">
              {/* Vertical timeline line */}
              <div
                className={`absolute top-0 bottom-0 w-0.5 bg-gray-200 ${
                  isRtl ? 'right-4' : 'left-4'
                }`}
              />

              <div className="space-y-6">
                {groups.map((group, gi) => {
                  const isEncounterGroup = group.encounter_id && group.records.length > 1;
                  return (
                    <div key={`${group.date}-${group.encounter_id ?? gi}`} className="relative">
                      {/* Date header */}
                      <div
                        className={`flex items-center gap-3 mb-3 ${
                          isRtl ? 'pr-0' : 'pl-0'
                        }`}
                      >
                        {/* Timeline dot */}
                        <div
                          className={`relative z-10 w-3 h-3 rounded-full bg-teal-500 ring-4 ring-gray-50 ${
                            isRtl ? 'mr-2.5' : 'ml-2.5'
                          }`}
                        />
                        <span className="text-xs font-semibold text-gray-500">
                          {formatTimelineDate(group.date, lang)}
                        </span>
                      </div>

                      {/* Records in group */}
                      <div
                        className={`space-y-2 ${isRtl ? 'pr-10' : 'pl-10'}`}
                      >
                        {isEncounterGroup && (
                          <div className="border-l-2 border-teal-300 rounded-lg overflow-hidden">
                            {/* Encounter grouping indicator */}
                            <div className="bg-teal-50 px-3 py-1.5 text-xs text-teal-600 font-medium border-b border-teal-100">
                              {lang === 'ar' ? 'زيارة مرتبطة' : 'Related encounter'}
                              {group.records.length > 1 && ` (${group.records.length})`}
                            </div>
                            <div className="space-y-0">
                              {group.records.map((record) => (
                                <TimelineRecordCard
                                  key={record.id}
                                  record={record}
                                  lang={lang}
                                  isLinked={linkedRecordIds.has(record.id)}
                                  grouped
                                />
                              ))}
                            </div>
                          </div>
                        )}
                        {!isEncounterGroup &&
                          group.records.map((record) => (
                            <TimelineRecordCard
                              key={record.id}
                              record={record}
                              lang={lang}
                              isLinked={linkedRecordIds.has(record.id)}
                            />
                          ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Bottom navigation */}
          {groups.length > 0 && (
            <div className="text-center py-6">
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

// ─── Timeline Record Card ───────────────────────────────────────────────────

function TimelineRecordCard({
  record,
  lang,
  isLinked,
  grouped = false,
}: {
  record: TimelineRecord;
  lang: Lang;
  isLinked: boolean;
  grouped?: boolean;
}) {
  const isRtl = lang === 'ar';
  const typeLabel = TYPE_LABELS[record.type]?.[lang] ?? record.type;
  const typeColor = TYPE_COLORS[record.type] ?? 'bg-gray-100 text-gray-600 border-gray-200';
  const dotColor = TYPE_DOT_COLORS[record.type] ?? 'bg-gray-400';

  return (
    <div
      className={`bg-white ${grouped ? 'border-b border-gray-100 last:border-b-0' : 'border border-gray-200 rounded-xl'} p-3 relative`}
    >
      {/* Connection indicator */}
      {isLinked && (
        <div
          className={`absolute top-3 ${isRtl ? '-right-6' : '-left-6'} flex items-center`}
        >
          <div className={`w-2 h-2 rounded-full ${dotColor}`} />
          <div className="w-4 h-px bg-gray-300" />
        </div>
      )}

      {/* Type badge + content */}
      <div className="flex items-start gap-2">
        <span
          className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full border ${typeColor}`}
        >
          {typeLabel}
        </span>
        <div className="flex-1 min-w-0">
          {record.type === 'visit' && (
            <VisitContent record={record} lang={lang} />
          )}
          {record.type === 'lab' && (
            <LabContent record={record} lang={lang} />
          )}
          {record.type === 'prescription' && (
            <PrescriptionContent record={record} lang={lang} />
          )}
          {record.type === 'imaging' && (
            <ImagingContent record={record} lang={lang} />
          )}
          {record.type === 'follow_up' && (
            <FollowUpContent record={record} lang={lang} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Type-specific content renderers ────────────────────────────────────────

function VisitContent({ record, lang }: { record: TimelineRecord; lang: Lang }) {
  const complaint = lang === 'ar' ? record.chief_complaint_ar : (record.chief_complaint_en ?? record.chief_complaint_ar);
  const specialty = lang === 'ar' ? record.specialty_ar : (record.specialty_en ?? record.specialty_ar);
  const doctor = lang === 'ar' ? record.doctor_name_ar : (record.doctor_name_en ?? record.doctor_name_ar);
  const outcomeLabel = getOutcomeLabel(record.outcome, lang);
  const outcomeColor = OUTCOME_COLORS[record.outcome ?? ''] ?? 'bg-gray-100 text-gray-600';

  return (
    <div>
      <p className="text-sm font-semibold text-gray-900">{complaint}</p>
      {specialty && (
        <p className="text-xs text-teal-600 font-medium mt-0.5">
          {s.history.specialty[lang]} {specialty}
        </p>
      )}
      {doctor && (
        <p className="text-xs text-gray-500 mt-0.5">
          {s.history.doctorLabel[lang]} {doctor}
        </p>
      )}
      <div className="flex items-center gap-2 mt-1.5">
        {record.urgency_level === 'urgent' && (
          <span className="bg-amber-100 text-amber-700 text-xs font-semibold px-2 py-0.5 rounded-full">
            {s.history.urgentBadge[lang]}
          </span>
        )}
        {record.urgency_level === 'emergency' && (
          <span className="bg-red-100 text-red-700 text-xs font-semibold px-2 py-0.5 rounded-full">
            {s.history.emergencyBadge[lang]}
          </span>
        )}
        {outcomeLabel && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${outcomeColor}`}>
            {outcomeLabel}
          </span>
        )}
      </div>
    </div>
  );
}

function LabContent({ record, lang }: { record: TimelineRecord; lang: Lang }) {
  const testName = lang === 'ar' ? record.test_name_ar : (record.test_name_en ?? record.test_name_ar);
  return (
    <div>
      <p className="text-sm font-semibold text-gray-900">{testName}</p>
      {record.value != null && (
        <p className="text-xs text-gray-600 mt-0.5 font-mono">
          {record.value} {record.unit ?? ''}
          {record.is_abnormal != null && (
            <span className={`ms-2 font-sans font-semibold ${record.is_abnormal ? 'text-red-600' : 'text-green-600'}`}>
              {record.is_abnormal ? t('medicalRecord.abnormal', lang) : t('medicalRecord.normal', lang)}
            </span>
          )}
        </p>
      )}
    </div>
  );
}

function PrescriptionContent({ record, lang }: { record: TimelineRecord; lang: Lang }) {
  const drugName = lang === 'ar' ? record.drug_name_ar : (record.drug_name_en ?? record.drug_name_ar);
  const freq = lang === 'ar' ? record.frequency_ar : (record.frequency_en ?? record.frequency_ar);
  return (
    <div>
      <p className="text-sm font-semibold text-gray-900">{drugName}</p>
      <p className="text-xs text-gray-500 mt-0.5">
        {record.dose} {freq ? `\u2014 ${freq}` : ''}
      </p>
      {record.status && (
        <span
          className={`inline-block mt-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
            record.status === 'dispensed'
              ? 'bg-green-100 text-green-700'
              : record.status === 'sent_to_pharmacy'
                ? 'bg-yellow-100 text-yellow-700'
                : 'bg-red-100 text-red-700'
          }`}
        >
          {record.status === 'dispensed'
            ? t('medicalRecord.dispensed', lang)
            : record.status === 'sent_to_pharmacy'
              ? t('medicalRecord.sentToPharmacy', lang)
              : t('medicalRecord.notDispensed', lang)}
        </span>
      )}
    </div>
  );
}

function ImagingContent({ record, lang }: { record: TimelineRecord; lang: Lang }) {
  const imagingType = lang === 'ar' ? record.imaging_type_ar : (record.imaging_type_en ?? record.imaging_type_ar);
  const summary = lang === 'ar' ? record.report_summary_ar : (record.report_summary_en ?? record.report_summary_ar);
  return (
    <div>
      <p className="text-sm font-semibold text-gray-900">{imagingType}</p>
      {summary && (
        <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{summary}</p>
      )}
      {record.pdf_url && (
        <a
          href={record.pdf_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-teal-600 font-medium mt-1 hover:underline"
        >
          {s.history.viewPdf[lang]}
        </a>
      )}
    </div>
  );
}

function FollowUpContent({ record, lang }: { record: TimelineRecord; lang: Lang }) {
  const reason = lang === 'ar' ? record.reason_ar : (record.reason_en ?? record.reason_ar);
  const doctor = lang === 'ar' ? record.doctor_name_ar : (record.doctor_name_en ?? record.doctor_name_ar);
  const isOverdue = record.follow_up_status === 'overdue';
  const isCompleted = record.follow_up_status === 'completed';

  return (
    <div>
      {doctor && <p className="text-sm font-semibold text-gray-900">{doctor}</p>}
      {reason && <p className="text-xs text-gray-600 mt-0.5">{reason}</p>}
      <div className="flex items-center gap-2 mt-1.5">
        {isOverdue && (
          <>
            <span className="text-xs font-semibold text-red-600">
              {t('medicalRecord.overdueFollowUp', lang)}
            </span>
            {record.days_overdue != null && (
              <span className="text-xs text-red-500">
                {record.days_overdue} {t('followUp.daysOverdue', lang)}
              </span>
            )}
            <a
              href={`/${lang}/chat`}
              className="text-xs bg-red-600 text-white px-2 py-0.5 rounded-lg font-medium hover:bg-red-700 transition-colors"
            >
              {t('medicalRecord.bookNow', lang)}
            </a>
          </>
        )}
        {isCompleted && (
          <span className="text-xs font-semibold text-green-600">
            {t('followUp.completed', lang)}
          </span>
        )}
        {record.follow_up_status === 'scheduled' && (
          <span className="text-xs font-semibold text-amber-600">
            {t('followUp.scheduled', lang)}
          </span>
        )}
        {record.linked_visit_id && (
          <span className="text-xs text-gray-400">
            {lang === 'ar' ? 'مرتبط بزيارة' : 'Linked to visit'}
          </span>
        )}
      </div>
    </div>
  );
}
