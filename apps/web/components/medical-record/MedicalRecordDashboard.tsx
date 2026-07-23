'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { t, type Lang } from '@triaji/shared/i18n';
import AllergiesBanner from './AllergiesBanner';
import MedicationAdherenceList, { type AdherenceRecord } from './MedicationAdherenceList';
import PatientInteractionNote from './PatientInteractionNote';
import dynamic from 'next/dynamic';
import { type VitalTrendPoint } from './VitalTrendChart';

// recharts is heavy — load the chart only when it's actually rendered.
const VitalTrendChart = dynamic(() => import('./VitalTrendChart'), {
  ssr: false,
  loading: () => <div className="h-[220px] animate-pulse rounded-lg bg-gray-100" />,
});
import VitalSelfReport from './VitalSelfReport';
import ChildMedicalRecordDashboard from '../paediatric/ChildMedicalRecordDashboard';
import FollowUpList, { type FollowUpEntry } from './FollowUpList';
import LatestResults, { type LabResult } from './LatestResults';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Allergy {
  name_ar: string;
  name_en: string;
}

interface ChronicCondition {
  name_ar: string;
  name_en: string;
  since?: string;
}

interface Surgery {
  name_ar: string;
  name_en: string;
  date?: string;
}

interface FamilyHistoryEntry {
  relation_ar: string;
  relation_en: string;
  condition_ar: string;
  condition_en: string;
}

interface VitalTrend {
  type: string;
  title_ar: string;
  title_en: string;
  unit: string;
  data: VitalTrendPoint[];
  reference_min?: number;
  reference_max?: number;
}

interface MedicalRecordData {
  patient_name_ar: string;
  patient_name_en: string | null;
  last_updated: string;
  brs_score: number;
  upcoming_appointments_count: number;
  active_medications_count: number;
  days_since_last_lab: number | null;
  allergies: Allergy[];
  medications: AdherenceRecord[];
  chronic_conditions: ChronicCondition[];
  vital_trends: VitalTrend[];
  follow_ups: FollowUpEntry[];
  latest_results: LabResult[];
  surgeries: Surgery[];
  family_history: FamilyHistoryEntry[];
  is_paediatric?: boolean;
  child_id?: string;
}

interface MedicalRecordDashboardProps {
  lang: Lang;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function MedicalRecordDashboard({ lang }: MedicalRecordDashboardProps) {
  const isRtl = lang === 'ar';
  const router = useRouter();
  const [data, setData] = useState<MedicalRecordData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  const fetchRecord = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/patient/medical-record', { credentials: 'include' });
      if (res.status === 401) {
        router.push(`/${lang}/login`);
        return;
      }
      if (!res.ok) throw new Error('Failed to load');
      const json = await res.json() as MedicalRecordData;
      setData(json);
    } catch {
      setError(t('common.error', lang));
    } finally {
      setIsLoading(false);
    }
  }, [router, lang]);

  useEffect(() => {
    fetchRecord();
  }, [fetchRecord]);

  const handleShare = async () => {
    setSharing(true);
    try {
      const res = await fetch('/api/patient/medical-record/share', {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        const json = await res.json() as { share_url: string };
        setShareUrl(json.share_url);
      }
    } catch {
      // Silent
    } finally {
      setSharing(false);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      const res = await fetch('/api/patient/medical-record/pdf', {
        credentials: 'include',
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'medical-record.pdf';
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      // Silent
    }
  };

  // ─── Loading ────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <main className="min-h-screen flex flex-col bg-gray-50" dir={isRtl ? 'rtl' : 'ltr'}>
        <header className="bg-teal-600 text-white py-4 px-6 shadow-md">
          <div className="max-w-2xl mx-auto">
            <h1 className="text-xl font-bold">{t('medicalRecord.pageTitle', lang)}</h1>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-gray-400 animate-pulse">{t('common.loading', lang)}</div>
        </div>
      </main>
    );
  }

  // ─── Error ──────────────────────────────────────────────────────────────

  if (error || !data) {
    return (
      <main className="min-h-screen flex flex-col bg-gray-50" dir={isRtl ? 'rtl' : 'ltr'}>
        <header className="bg-teal-600 text-white py-4 px-6 shadow-md">
          <div className="max-w-2xl mx-auto">
            <h1 className="text-xl font-bold">{t('medicalRecord.pageTitle', lang)}</h1>
          </div>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <p className="text-gray-500">{error ?? t('common.error', lang)}</p>
          <button
            onClick={() => fetchRecord()}
            className="bg-teal-600 text-white px-6 py-2 rounded-xl font-semibold text-sm hover:bg-teal-700 transition-colors"
          >
            {t('common.tryAgain', lang)}
          </button>
        </div>
      </main>
    );
  }

  // ─── Paediatric redirect ────────────────────────────────────────────────
  // If patient is paediatric, render the child-specific dashboard instead

  if (data.is_paediatric && data.child_id) {
    return <ChildMedicalRecordDashboard childId={data.child_id} lang={lang} />;
  }

  // ─── Helpers ────────────────────────────────────────────────────────────

  const patientName = lang === 'ar' ? data.patient_name_ar : (data.patient_name_en ?? data.patient_name_ar);
  const lastUpdated = new Date(data.last_updated).toLocaleDateString(
    lang === 'ar' ? 'ar-EG' : 'en-US',
    { year: 'numeric', month: 'long', day: 'numeric' }
  );

  // Group family history by relation
  const familyByRelation = data.family_history.reduce<Record<string, FamilyHistoryEntry[]>>(
    (acc, entry) => {
      const key = lang === 'ar' ? entry.relation_ar : entry.relation_en;
      if (!acc[key]) acc[key] = [];
      acc[key].push(entry);
      return acc;
    },
    {}
  );

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen flex flex-col bg-gray-50" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Header */}
      <header className="bg-teal-600 text-white py-4 px-6 shadow-md">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">{patientName}</h1>
              <p className="text-teal-100 text-xs mt-0.5">
                {t('medicalRecord.lastUpdated', lang)}: {lastUpdated}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleShare}
                disabled={sharing}
                className="bg-white/20 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-white/30 transition-colors disabled:opacity-50"
              >
                {t('medicalRecord.shareRecord', lang)}
              </button>
              <button
                onClick={handleDownloadPdf}
                className="bg-white/20 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-white/30 transition-colors"
              >
                {t('medicalRecord.downloadPdf', lang)}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Share URL banner */}
      {shareUrl && (
        <div className="bg-green-50 border-b border-green-200 px-6 py-3">
          <div className="max-w-2xl mx-auto">
            <p className="text-sm text-green-700 font-medium mb-1">
              {t('medicalRecord.shareCreated', lang)}
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="flex-1 bg-white border border-green-300 rounded-lg px-3 py-1.5 text-xs font-mono text-gray-700"
                dir="ltr"
              />
              <button
                onClick={() => navigator.clipboard.writeText(shareUrl)}
                className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-green-700 transition-colors shrink-0"
              >
                Copy
              </button>
            </div>
            <p className="text-xs text-green-500 mt-1">
              {t('medicalRecord.shareExpiry', lang)}
            </p>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto w-full p-4 space-y-6">

          {/* 1. Summary cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryCard
              label={t('medicalRecord.riskScore', lang)}
              value={`${data.brs_score}/100`}
              color={data.brs_score >= 70 ? 'red' : data.brs_score >= 40 ? 'yellow' : 'green'}
            />
            <SummaryCard
              label={t('medicalRecord.upcomingFollowUps', lang)}
              value={String(data.upcoming_appointments_count)}
              color="teal"
            />
            <SummaryCard
              label={t('medicalRecord.activeMedications', lang)}
              value={String(data.active_medications_count)}
              color="teal"
            />
            <SummaryCard
              label={t('medicalRecord.latestResults', lang)}
              value={data.days_since_last_lab != null ? `${data.days_since_last_lab}d` : '—'}
              color="teal"
            />
          </div>

          {/* Ask DoctorTrio button */}
          <a
            href={`/${lang}/health-assistant`}
            className="block w-full bg-teal-600 hover:bg-teal-700 text-white rounded-xl p-4 transition-colors shadow-md group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl" role="img" aria-label="sparkle">&#10024;</span>
                <div>
                  <p className="font-bold text-base">{t('healthAssistant.askDoctorTrio', lang)}</p>
                  <p className="text-teal-100 text-xs">{t('healthAssistant.subtitle', lang)}</p>
                </div>
              </div>
              <svg
                className={`w-5 h-5 text-white/70 group-hover:text-white transition-colors ${isRtl ? 'rotate-180' : ''}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </div>
          </a>

          {/* 2. Allergies banner (always first clinical section) */}
          <AllergiesBanner allergies={data.allergies} lang={lang} />

          {/* 3. Active medications */}
          <MedicationAdherenceList medications={data.medications} lang={lang} />

          {/* 3b. Patient-facing interaction notes (non-alarming) */}
          <PatientInteractionNote medications={data.medications} lang={lang} />

          {/* 4. Chronic conditions */}
          {data.chronic_conditions.length > 0 && (
            <div>
              <h3 className="text-base font-bold text-gray-900 mb-3">
                {t('medicalRecord.chronicConditions', lang)}
              </h3>
              <div className="space-y-1">
                {data.chronic_conditions.map((c, i) => (
                  <div
                    key={i}
                    className="bg-white border border-gray-200 rounded-lg px-3 py-2 flex items-center justify-between"
                  >
                    <span className="text-sm text-gray-800">
                      {lang === 'ar' ? c.name_ar : c.name_en}
                    </span>
                    {c.since && (
                      <span className="text-xs text-gray-400">{c.since}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 5. Health indicators (vital trends) */}
          {data.vital_trends.length > 0 && (
            <div>
              <h3 className="text-base font-bold text-gray-900 mb-3">
                {t('medicalRecord.healthIndicators', lang)}
              </h3>
              <div className="space-y-4">
                {data.vital_trends.map((vt) => (
                  <VitalTrendChart
                    key={vt.type}
                    vitalType={vt.type}
                    title={lang === 'ar' ? vt.title_ar : vt.title_en}
                    unit={vt.unit}
                    data={vt.data}
                    referenceMin={vt.reference_min}
                    referenceMax={vt.reference_max}
                    lang={lang}
                  />
                ))}
              </div>
            </div>
          )}

          {/* 6. Follow-up appointments */}
          <FollowUpList followUps={data.follow_ups} lang={lang} />

          {/* 7. Latest lab results */}
          <LatestResults results={data.latest_results} lang={lang} />

          {/* 8. Surgical history */}
          {data.surgeries.length > 0 && (
            <div>
              <h3 className="text-base font-bold text-gray-900 mb-3">
                {t('medicalRecord.surgicalHistory', lang)}
              </h3>
              <div className="space-y-1">
                {data.surgeries.map((s, i) => (
                  <div
                    key={i}
                    className="bg-white border border-gray-200 rounded-lg px-3 py-2 flex items-center justify-between"
                  >
                    <span className="text-sm text-gray-800">
                      {lang === 'ar' ? s.name_ar : s.name_en}
                    </span>
                    {s.date && (
                      <span className="text-xs text-gray-400">
                        {new Date(s.date).toLocaleDateString(
                          lang === 'ar' ? 'ar-EG' : 'en-US',
                          { year: 'numeric', month: 'short' }
                        )}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 9. Family history */}
          {Object.keys(familyByRelation).length > 0 && (
            <div>
              <h3 className="text-base font-bold text-gray-900 mb-3">
                {t('medicalRecord.familyHistory', lang)}
              </h3>
              <div className="space-y-3">
                {Object.entries(familyByRelation).map(([relation, entries]) => (
                  <div key={relation}>
                    <p className="text-xs font-semibold text-gray-500 mb-1">{relation}</p>
                    <div className="space-y-1">
                      {entries.map((e, i) => (
                        <div
                          key={i}
                          className="bg-white border border-gray-200 rounded-lg px-3 py-2"
                        >
                          <span className="text-sm text-gray-800">
                            {lang === 'ar' ? e.condition_ar : e.condition_en}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 10. Log vitals form */}
          <VitalSelfReport lang={lang} onSaved={() => fetchRecord()} />

          {/* Bottom spacer */}
          <div className="h-8" />
        </div>
      </div>
    </main>
  );
}

// ─── Summary Card ──────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: 'teal' | 'green' | 'yellow' | 'red';
}) {
  const colorMap: Record<string, string> = {
    teal: 'bg-teal-50 border-teal-200 text-teal-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    red: 'bg-red-50 border-red-200 text-red-700',
  };

  return (
    <div className={`rounded-xl border p-3 ${colorMap[color]}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs font-medium mt-0.5 opacity-80 leading-tight">{label}</p>
    </div>
  );
}
