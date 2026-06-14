'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { t, type Lang } from '@triaji/shared/i18n';
import AllergiesBanner from '../medical-record/AllergiesBanner';
import MedicationAdherenceList, { type AdherenceRecord } from '../medical-record/MedicationAdherenceList';
import PatientInteractionNote from '../medical-record/PatientInteractionNote';
import FollowUpList, { type FollowUpEntry } from '../medical-record/FollowUpList';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Allergy {
  name_ar: string;
  name_en: string;
}

interface GrowthSummary {
  latest_weight_kg: number | null;
  latest_height_cm: number | null;
  weight_percentile: number | null;
  height_percentile: number | null;
  last_measured: string | null;
}

interface VaccinationSummary {
  total: number;
  completed: number;
  next_due_vaccine_ar: string | null;
  next_due_vaccine_en: string | null;
  next_due_date: string | null;
}

interface MilestoneSummary {
  current_age_group_ar: string;
  current_age_group_en: string;
  red_flags: number;
  total_assessed: number;
}

interface SchoolHealthSummary {
  latest_exam_date: string | null;
  latest_academic_year: string | null;
  latest_school_name: string | null;
  fit_for_school: boolean | null;
  has_restrictions: boolean;
}

interface RecentVisit {
  date: string;
  doctor_name_ar: string;
  doctor_name_en: string | null;
  specialty_ar: string;
  specialty_en: string;
  diagnosis_ar: string | null;
}

interface ChildRecordData {
  child_name_ar: string;
  child_name_en: string | null;
  date_of_birth: string;
  blood_type: string | null;
  age_months: number;
  sex: 'male' | 'female';
  last_updated: string;
  allergies: Allergy[];
  growth: GrowthSummary;
  vaccinations: VaccinationSummary;
  milestones: MilestoneSummary;
  school_health: SchoolHealthSummary;
  medications: AdherenceRecord[];
  follow_ups: FollowUpEntry[];
  recent_visits: RecentVisit[];
}

interface ChildMedicalRecordDashboardProps {
  childId: string;
  lang: Lang;
}

// ─── Strings ────────────────────────────────────────────────────────────────

const STRINGS = {
  pageTitle: { ar: 'السجل الطبي للطفل', en: 'Child Medical Record' },
  dob: { ar: 'تاريخ الميلاد', en: 'Date of birth' },
  bloodType: { ar: 'فصيلة الدم', en: 'Blood type' },
  age: { ar: 'العمر', en: 'Age' },
  growthTitle: { ar: 'ملخص النمو', en: 'Growth Summary' },
  weight: { ar: 'الوزن', en: 'Weight' },
  height: { ar: 'الطول', en: 'Height' },
  percentile: { ar: 'الشريحة', en: 'Percentile' },
  viewGrowthCharts: { ar: 'عرض منحنيات النمو', en: 'View growth charts' },
  vaccinationsTitle: { ar: 'التطعيمات', en: 'Vaccinations' },
  completed: { ar: 'مكتملة', en: 'completed' },
  nextDue: { ar: 'التالي', en: 'Next due' },
  viewSchedule: { ar: 'عرض الجدول', en: 'View schedule' },
  milestonesTitle: { ar: 'مراحل التطور', en: 'Milestones' },
  currentAgeGroup: { ar: 'المرحلة العمرية', en: 'Age group' },
  redFlags: { ar: 'تنبيهات تطورية', en: 'Red flags' },
  viewMilestones: { ar: 'عرض التفاصيل', en: 'View milestones' },
  schoolHealthTitle: { ar: 'الصحة المدرسية', en: 'School Health' },
  latestExam: { ar: 'آخر كشف', en: 'Latest exam' },
  viewSchoolRecords: { ar: 'عرض السجلات', en: 'View records' },
  noExams: { ar: 'لا يوجد كشوفات بعد', en: 'No exams yet' },
  medicationsTitle: { ar: 'الأدوية الحالية', en: 'Current Medications' },
  recentVisitsTitle: { ar: 'آخر الزيارات', en: 'Recent Visits' },
  noVisits: { ar: 'لا توجد زيارات سابقة', en: 'No recent visits' },
  male: { ar: 'ذكر', en: 'Male' },
  female: { ar: 'أنثى', en: 'Female' },
  kg: { ar: 'كجم', en: 'kg' },
  cm: { ar: 'سم', en: 'cm' },
} as const;

// ─── Helper ─────────────────────────────────────────────────────────────────

function formatAge(ageMonths: number, lang: Lang): string {
  if (ageMonths < 12) {
    return `${ageMonths} ${t('paediatric.months', lang)}`;
  }
  const years = Math.floor(ageMonths / 12);
  const months = ageMonths % 12;
  if (months === 0) {
    return `${years} ${t('paediatric.years', lang)}`;
  }
  return `${years} ${t('paediatric.years', lang)} ${months} ${t('paediatric.months', lang)}`;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function ChildMedicalRecordDashboard({ childId, lang }: ChildMedicalRecordDashboardProps) {
  const isRtl = lang === 'ar';
  const router = useRouter();
  const [data, setData] = useState<ChildRecordData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const s = useCallback((key: keyof typeof STRINGS) => STRINGS[key][lang], [lang]);

  const fetchRecord = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/patient/medical-record?child_id=${childId}`, {
        credentials: 'include',
      });
      if (res.status === 401) {
        router.push(`/${lang}/login`);
        return;
      }
      if (!res.ok) throw new Error('Failed to load');
      const json = await res.json() as ChildRecordData;
      setData(json);
    } catch {
      setError(t('common.error', lang));
    } finally {
      setIsLoading(false);
    }
  }, [childId, router, lang]);

  useEffect(() => {
    fetchRecord();
  }, [fetchRecord]);

  // ─── Loading ────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <main className="min-h-screen flex flex-col bg-gray-50" dir={isRtl ? 'rtl' : 'ltr'}>
        <header className="bg-teal-600 text-white py-4 px-6 shadow-md">
          <div className="max-w-2xl mx-auto">
            <h1 className="text-xl font-bold font-[Cairo]">{s('pageTitle')}</h1>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-gray-400 animate-pulse font-[Cairo]">{t('common.loading', lang)}</div>
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
            <h1 className="text-xl font-bold font-[Cairo]">{s('pageTitle')}</h1>
          </div>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <p className="text-gray-500 font-[Cairo]">{error ?? t('common.error', lang)}</p>
          <button
            onClick={() => fetchRecord()}
            className="bg-teal-600 text-white px-6 py-2 rounded-xl font-semibold text-sm hover:bg-teal-700 transition-colors font-[Cairo]"
          >
            {t('common.tryAgain', lang)}
          </button>
        </div>
      </main>
    );
  }

  // ─── Helpers ────────────────────────────────────────────────────────────

  const childName = lang === 'ar' ? data.child_name_ar : (data.child_name_en ?? data.child_name_ar);
  const lastUpdated = new Date(data.last_updated).toLocaleDateString(
    lang === 'ar' ? 'ar-EG' : 'en-US',
    { year: 'numeric', month: 'long', day: 'numeric' }
  );

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen flex flex-col bg-gray-50" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Header */}
      <header className="bg-teal-600 text-white py-4 px-6 shadow-md">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold font-[Cairo]">{childName}</h1>
              <div className="flex items-center gap-3 text-teal-100 text-xs mt-0.5">
                <span>{formatAge(data.age_months, lang)}</span>
                <span>|</span>
                <span>{data.sex === 'male' ? s('male') : s('female')}</span>
                {data.blood_type && (
                  <>
                    <span>|</span>
                    <span>{s('bloodType')}: {data.blood_type}</span>
                  </>
                )}
              </div>
              <p className="text-teal-200 text-xs mt-0.5">
                {s('dob')}: {new Date(data.date_of_birth).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US')}
              </p>
            </div>
            <button
              onClick={() => router.back()}
              className="text-teal-100 text-sm font-[Cairo] hover:text-white transition-colors"
            >
              {t('common.back', lang)}
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto w-full p-4 space-y-6">

          {/* 1. Allergies */}
          <AllergiesBanner allergies={data.allergies} lang={lang} />

          {/* 2. Growth summary */}
          <section className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-gray-900 font-[Cairo]">{s('growthTitle')}</h3>
              <button
                onClick={() => router.push(`/${lang}/child/${childId}/growth`)}
                className="text-xs text-teal-600 font-medium font-[Cairo] hover:text-teal-700 transition-colors"
              >
                {s('viewGrowthCharts')} →
              </button>
            </div>
            {data.growth.latest_weight_kg || data.growth.latest_height_cm ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {data.growth.latest_weight_kg && (
                  <div className="bg-teal-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-teal-600 font-[Cairo]">{s('weight')}</p>
                    <p className="text-lg font-bold text-teal-800">{data.growth.latest_weight_kg} {s('kg')}</p>
                    {data.growth.weight_percentile !== null && (
                      <p className="text-xs text-teal-500">{s('percentile')}: P{data.growth.weight_percentile}</p>
                    )}
                  </div>
                )}
                {data.growth.latest_height_cm && (
                  <div className="bg-teal-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-teal-600 font-[Cairo]">{s('height')}</p>
                    <p className="text-lg font-bold text-teal-800">{data.growth.latest_height_cm} {s('cm')}</p>
                    {data.growth.height_percentile !== null && (
                      <p className="text-xs text-teal-500">{s('percentile')}: P{data.growth.height_percentile}</p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400 font-[Cairo]">{t('common.loading', lang)}</p>
            )}
          </section>

          {/* 3. Vaccination progress */}
          <section className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-gray-900 font-[Cairo]">{s('vaccinationsTitle')}</h3>
              <button
                onClick={() => router.push(`/${lang}/child/${childId}/vaccines`)}
                className="text-xs text-teal-600 font-medium font-[Cairo] hover:text-teal-700 transition-colors"
              >
                {s('viewSchedule')} →
              </button>
            </div>
            <div className="flex items-center gap-4">
              {/* Progress bar */}
              <div className="flex-1">
                <div className="flex items-center justify-between text-xs text-gray-600 font-[Cairo] mb-1">
                  <span>{data.vaccinations.completed}/{data.vaccinations.total} {s('completed')}</span>
                  <span>{Math.round((data.vaccinations.completed / Math.max(data.vaccinations.total, 1)) * 100)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-teal-500 h-2 rounded-full transition-all"
                    style={{ width: `${(data.vaccinations.completed / Math.max(data.vaccinations.total, 1)) * 100}%` }}
                  />
                </div>
              </div>
            </div>
            {data.vaccinations.next_due_vaccine_ar && (
              <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <p className="text-xs text-amber-600 font-[Cairo]">
                  {s('nextDue')}: {lang === 'ar' ? data.vaccinations.next_due_vaccine_ar : data.vaccinations.next_due_vaccine_en}
                  {data.vaccinations.next_due_date && (
                    <span className="mr-2">
                      {' — '}
                      {new Date(data.vaccinations.next_due_date).toLocaleDateString(
                        lang === 'ar' ? 'ar-EG' : 'en-US',
                        { month: 'short', day: 'numeric' }
                      )}
                    </span>
                  )}
                </p>
              </div>
            )}
          </section>

          {/* 4. Milestone status */}
          <section className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-gray-900 font-[Cairo]">{s('milestonesTitle')}</h3>
              <button
                onClick={() => router.push(`/${lang}/child/${childId}/milestones`)}
                className="text-xs text-teal-600 font-medium font-[Cairo] hover:text-teal-700 transition-colors"
              >
                {s('viewMilestones')} →
              </button>
            </div>
            <div className="flex items-center gap-4">
              <div className="bg-gray-50 rounded-lg px-3 py-2 flex-1">
                <p className="text-xs text-gray-500 font-[Cairo]">{s('currentAgeGroup')}</p>
                <p className="text-sm font-medium text-gray-800 font-[Cairo]">
                  {lang === 'ar' ? data.milestones.current_age_group_ar : data.milestones.current_age_group_en}
                </p>
              </div>
              {data.milestones.red_flags > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  <p className="text-xs text-red-500 font-[Cairo]">{s('redFlags')}</p>
                  <p className="text-sm font-bold text-red-700">{data.milestones.red_flags}</p>
                </div>
              )}
            </div>
          </section>

          {/* 5. School health */}
          <section className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span>🏫</span>
                <h3 className="text-base font-bold text-gray-900 font-[Cairo]">{s('schoolHealthTitle')}</h3>
              </div>
              <button
                onClick={() => router.push(`/${lang}/child/${childId}/school`)}
                className="text-xs text-teal-600 font-medium font-[Cairo] hover:text-teal-700 transition-colors"
              >
                {s('viewSchoolRecords')} →
              </button>
            </div>
            {data.school_health.latest_exam_date ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-700 font-[Cairo]">
                    {s('latestExam')}: {new Date(data.school_health.latest_exam_date).toLocaleDateString(
                      lang === 'ar' ? 'ar-EG' : 'en-US',
                      { year: 'numeric', month: 'short', day: 'numeric' }
                    )}
                  </p>
                  {data.school_health.latest_school_name && (
                    <p className="text-xs text-gray-500 font-[Cairo]">
                      {data.school_health.latest_school_name} — {data.school_health.latest_academic_year}
                    </p>
                  )}
                </div>
                {data.school_health.fit_for_school !== null && (
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium font-[Cairo] ${
                      data.school_health.fit_for_school && !data.school_health.has_restrictions
                        ? 'bg-green-100 text-green-700'
                        : data.school_health.fit_for_school && data.school_health.has_restrictions
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {data.school_health.fit_for_school
                      ? data.school_health.has_restrictions
                        ? t('paediatric.fitWithRestrictions', lang)
                        : t('paediatric.fitForSchool', lang)
                      : t('paediatric.notFit', lang)
                    }
                  </span>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400 font-[Cairo]">{s('noExams')}</p>
            )}
          </section>

          {/* 6. Medications (same as adult) */}
          <MedicationAdherenceList medications={data.medications} lang={lang} />

          {/* 6b. Patient interaction notes */}
          <PatientInteractionNote medications={data.medications} lang={lang} />

          {/* 7. Follow-up appointments */}
          <FollowUpList followUps={data.follow_ups} lang={lang} />

          {/* 8. Recent visits */}
          <section>
            <h3 className="text-base font-bold text-gray-900 mb-3 font-[Cairo]">{s('recentVisitsTitle')}</h3>
            {data.recent_visits.length === 0 ? (
              <p className="text-sm text-gray-400 font-[Cairo]">{s('noVisits')}</p>
            ) : (
              <div className="space-y-2">
                {data.recent_visits.map((visit, i) => (
                  <div
                    key={i}
                    className="bg-white border border-gray-200 rounded-lg px-4 py-3"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-800 font-[Cairo]">
                        {lang === 'ar' ? visit.doctor_name_ar : (visit.doctor_name_en ?? visit.doctor_name_ar)}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(visit.date).toLocaleDateString(
                          lang === 'ar' ? 'ar-EG' : 'en-US',
                          { month: 'short', day: 'numeric' }
                        )}
                      </span>
                    </div>
                    <p className="text-xs text-teal-600 font-[Cairo]">
                      {lang === 'ar' ? visit.specialty_ar : visit.specialty_en}
                    </p>
                    {visit.diagnosis_ar && (
                      <p className="text-xs text-gray-500 font-[Cairo] mt-1">{visit.diagnosis_ar}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Bottom spacer */}
          <div className="h-8" />
        </div>
      </div>
    </main>
  );
}
