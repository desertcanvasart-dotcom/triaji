'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { t, type Lang } from '@triaji/shared/i18n';
import AllergiesBanner from './AllergiesBanner';
import MedicationAdherenceList, { type AdherenceRecord } from './MedicationAdherenceList';
import VitalTrendChart, { type VitalTrendPoint } from './VitalTrendChart';
import FollowUpList, { type FollowUpEntry } from './FollowUpList';
import LatestResults, { type LabResult } from './LatestResults';

// ─── Types (shared with MedicalRecordDashboard) ────────────────────────────

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

interface SharedRecordData {
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
  expires_at: string;
}

interface SharedMedicalRecordProps {
  lang: Lang;
}

export default function SharedMedicalRecord({ lang }: SharedMedicalRecordProps) {
  const isRtl = lang === 'ar';
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [data, setData] = useState<SharedRecordData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!token) return;

    const fetchSharedRecord = async () => {
      try {
        const res = await fetch(`/api/patient/medical-record/shared/${token}`);
        if (res.status === 410 || res.status === 404) {
          setExpired(true);
          return;
        }
        if (!res.ok) throw new Error('Failed');
        const json = await res.json() as SharedRecordData;

        // Check client-side expiry
        if (new Date(json.expires_at) < new Date()) {
          setExpired(true);
          return;
        }

        setData(json);
      } catch {
        setError(t('common.error', lang));
      } finally {
        setIsLoading(false);
      }
    };

    fetchSharedRecord();
  }, [token, lang]);

  // ─── Loading ────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <main className="min-h-screen flex flex-col bg-gray-50" dir={isRtl ? 'rtl' : 'ltr'}>
        <header className="bg-teal-600 text-white py-4 px-6 shadow-md">
          <div className="max-w-2xl mx-auto">
            <h1 className="text-xl font-bold">{t('medicalRecord.sharedRecord', lang)}</h1>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-gray-400 animate-pulse">{t('common.loading', lang)}</div>
        </div>
      </main>
    );
  }

  // ─── Expired ────────────────────────────────────────────────────────────

  if (expired) {
    return (
      <main className="min-h-screen flex flex-col bg-gray-50" dir={isRtl ? 'rtl' : 'ltr'}>
        <header className="bg-teal-600 text-white py-4 px-6 shadow-md">
          <div className="max-w-2xl mx-auto">
            <h1 className="text-xl font-bold">{t('medicalRecord.sharedRecord', lang)}</h1>
          </div>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6">
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center max-w-sm">
            <p className="text-red-600 font-semibold text-lg mb-2">
              {lang === 'ar' ? 'انتهت صلاحية الرابط' : 'Link expired'}
            </p>
            <p className="text-red-500 text-sm">
              {lang === 'ar'
                ? 'رابط المشاركة ده انتهى. اطلب من المريض يشارك سجل جديد.'
                : 'This share link has expired. Ask the patient to share a new record.'}
            </p>
          </div>
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
            <h1 className="text-xl font-bold">{t('medicalRecord.sharedRecord', lang)}</h1>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-500">{error ?? t('common.error', lang)}</p>
        </div>
      </main>
    );
  }

  // ─── Helpers ────────────────────────────────────────────────────────────

  const patientName = lang === 'ar' ? data.patient_name_ar : (data.patient_name_en ?? data.patient_name_ar);
  const lastUpdated = new Date(data.last_updated).toLocaleDateString(
    lang === 'ar' ? 'ar-EG' : 'en-US',
    { year: 'numeric', month: 'long', day: 'numeric' }
  );

  const familyByRelation = data.family_history.reduce<Record<string, FamilyHistoryEntry[]>>(
    (acc, entry) => {
      const key = lang === 'ar' ? entry.relation_ar : entry.relation_en;
      if (!acc[key]) acc[key] = [];
      acc[key].push(entry);
      return acc;
    },
    {}
  );

  // ─── Render (read-only) ─────────────────────────────────────────────────

  return (
    <main className="min-h-screen flex flex-col bg-gray-50" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Header */}
      <header className="bg-teal-600 text-white py-4 px-6 shadow-md">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-xl font-bold">{patientName}</h1>
          <p className="text-teal-100 text-xs mt-0.5">
            {t('medicalRecord.lastUpdated', lang)}: {lastUpdated}
          </p>
        </div>
      </header>

      {/* Shared banner */}
      <div className="bg-amber-50 border-b border-amber-200 px-6 py-3">
        <div className="max-w-2xl mx-auto">
          <p className="text-sm text-amber-700 font-medium">
            {t('medicalRecord.sharedBanner', lang)} — {t('medicalRecord.shareExpiry', lang)}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto w-full p-4 space-y-6">

          {/* Summary cards */}
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
              value={data.days_since_last_lab != null ? `${data.days_since_last_lab}d` : '\u2014'}
              color="teal"
            />
          </div>

          {/* Allergies */}
          <AllergiesBanner allergies={data.allergies} lang={lang} />

          {/* Medications (read-only) */}
          <MedicationAdherenceList medications={data.medications} lang={lang} readOnly />

          {/* Chronic conditions */}
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
                    {c.since && <span className="text-xs text-gray-400">{c.since}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Vital trends */}
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

          {/* Follow-ups (read-only) */}
          <FollowUpList followUps={data.follow_ups} lang={lang} readOnly />

          {/* Lab results */}
          <LatestResults results={data.latest_results} lang={lang} />

          {/* Surgical history */}
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

          {/* Family history */}
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

          {/* No "Log vitals", no "Share", no "Send to pharmacy" in shared view */}
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
