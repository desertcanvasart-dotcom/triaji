'use client';

import { useState, useEffect, useCallback } from 'react';
import { t, type Lang } from '@triaji/shared/i18n';
import type { VaccinationScheduleEntry, VaccineStatus } from '@triaji/shared/types/paediatric';

interface VaccineTrackerProps {
  childId: string;
  lang: Lang;
}

const STATUS_STYLES: Record<VaccineStatus, { bg: string; text: string }> = {
  given: { bg: 'bg-green-100', text: 'text-green-700' },
  due: { bg: 'bg-blue-100', text: 'text-blue-700' },
  overdue: { bg: 'bg-red-100', text: 'text-red-700' },
  skipped: { bg: 'bg-gray-100', text: 'text-gray-500' },
  deferred: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
};

const STATUS_ICONS: Record<VaccineStatus, string> = {
  given: '\u2705',
  due: '\u{1F4C5}',
  overdue: '\u26A0\uFE0F',
  skipped: '\u23ED',
  deferred: '\u23F8',
};

function statusLabel(status: VaccineStatus, lang: Lang): string {
  const keyMap: Record<VaccineStatus, string> = {
    given: 'paediatric.vaccineGiven',
    due: 'paediatric.vaccineDue',
    overdue: 'paediatric.vaccineOverdue',
    skipped: 'paediatric.vaccineSkipped',
    deferred: 'paediatric.vaccineDeferred',
  };
  return t(keyMap[status], lang);
}

export default function VaccineTracker({ childId, lang }: VaccineTrackerProps) {
  const isRtl = lang === 'ar';
  const [schedule, setSchedule] = useState<VaccinationScheduleEntry[]>([]);
  const [completed, setCompleted] = useState<VaccinationScheduleEntry[]>([]);
  const [upcoming, setUpcoming] = useState<VaccinationScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [totalDoses, setTotalDoses] = useState(0);
  const [completedDoses, setCompletedDoses] = useState(0);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/child/${childId}/vaccines`);
      const data = await res.json();
      if (res.ok) {
        setSchedule(data.schedule ?? []);
        setCompleted(data.completed ?? []);
        setUpcoming(data.upcoming ?? []);
        setTotalDoses(data.totalDoses ?? 0);
        setCompletedDoses(data.completedDoses ?? 0);
      }
    } catch {
      // Handled silently
    } finally {
      setLoading(false);
    }
  }, [childId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleUpdateStatus = async (vaccId: string, status: VaccineStatus) => {
    setUpdating(vaccId);
    try {
      const res = await fetch(`/api/child/${childId}/vaccines/${vaccId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (res.ok) {
        await fetchData();
      }
    } catch {
      // Handled silently
    } finally {
      setUpdating(null);
    }
  };

  const handleDownloadCertificate = () => {
    window.open(`/api/child/${childId}/vaccines/certificate`, '_blank');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">{t('common.loading', lang)}</div>
      </div>
    );
  }

  const progressPercent = totalDoses > 0 ? Math.round((completedDoses / totalDoses) * 100) : 0;

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-2 text-2xl font-bold text-gray-900">
        {t('paediatric.vaccineSchedule', lang)}
      </h1>

      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-sm text-gray-500 mb-1">
          <span>{completedDoses}/{totalDoses} {t('paediatric.vaccineComplete', lang)}</span>
          <span>{progressPercent}%</span>
        </div>
        <div className="h-2 rounded-full bg-gray-200">
          <div
            className="h-2 rounded-full bg-teal-500 transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Upcoming / overdue section */}
      {upcoming.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-gray-800">
            {lang === 'ar' ? 'قادمة' : 'Upcoming'}
          </h2>
          <div className="space-y-3">
            {upcoming.map((vacc) => {
              const vaccine = vacc.vaccine;
              const vaccineName = vaccine
                ? (lang === 'ar' ? vaccine.name_ar : vaccine.name_en)
                : vacc.vaccine_code;
              const diseaseName = vaccine
                ? (lang === 'ar' ? vaccine.disease_ar : vaccine.disease_en)
                : '';
              const style = STATUS_STYLES[vacc.status];
              const icon = STATUS_ICONS[vacc.status];

              return (
                <div
                  key={vacc.id}
                  className={`rounded-xl border p-4 ${
                    vacc.status === 'overdue' ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 text-xl">{icon}</span>
                      <div>
                        <div className="font-medium text-gray-900">
                          {vaccineName}
                          <span className="mx-1 text-xs text-gray-400">
                            ({lang === 'ar' ? 'جرعة' : 'dose'} {vacc.dose_number})
                          </span>
                        </div>
                        {diseaseName && (
                          <div className="mt-0.5 text-xs text-gray-500">{diseaseName}</div>
                        )}
                        {vacc.due_date && (
                          <div className="mt-1 text-xs text-gray-400">
                            {lang === 'ar' ? 'التاريخ المتوقع:' : 'Due:'} {vacc.due_date}
                          </div>
                        )}
                      </div>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${style.bg} ${style.text}`}>
                      {statusLabel(vacc.status, lang)}
                    </span>
                  </div>

                  {/* Action buttons */}
                  <div className={`mt-3 flex gap-2 ${isRtl ? 'flex-row-reverse justify-end' : ''}`}>
                    <button
                      onClick={() => handleUpdateStatus(vacc.id, 'given')}
                      disabled={updating === vacc.id}
                      className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      {t('paediatric.markAsGiven', lang)}
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(vacc.id, 'deferred')}
                      disabled={updating === vacc.id}
                      className="rounded-lg border border-yellow-300 bg-yellow-50 px-3 py-1.5 text-xs font-medium text-yellow-700 hover:bg-yellow-100 disabled:opacity-50"
                    >
                      {t('paediatric.vaccineDeferred', lang)}
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(vacc.id, 'skipped')}
                      disabled={updating === vacc.id}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                    >
                      {t('paediatric.vaccineSkipped', lang)}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Completed section */}
      {completed.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-gray-800">
            {t('paediatric.vaccineComplete', lang)}
          </h2>
          <div className="space-y-2">
            {completed.map((vacc) => {
              const vaccine = vacc.vaccine;
              const vaccineName = vaccine
                ? (lang === 'ar' ? vaccine.name_ar : vaccine.name_en)
                : vacc.vaccine_code;

              return (
                <div
                  key={vacc.id}
                  className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3"
                >
                  <span className="text-lg text-green-500">{STATUS_ICONS[vacc.status]}</span>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-700">
                      {vaccineName}
                      <span className="mx-1 text-xs text-gray-400">
                        ({lang === 'ar' ? 'جرعة' : 'dose'} {vacc.dose_number})
                      </span>
                    </div>
                    {vacc.given_date && (
                      <div className="text-xs text-gray-400">{vacc.given_date}</div>
                    )}
                    {vacc.notes_ar && vacc.status === 'given' && !vacc.given_date && (
                      <div className="text-xs text-gray-400">{vacc.notes_ar}</div>
                    )}
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[vacc.status].bg} ${STATUS_STYLES[vacc.status].text}`}>
                    {statusLabel(vacc.status, lang)}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Download certificate */}
      {completedDoses > 0 && (
        <button
          onClick={handleDownloadCertificate}
          className="w-full rounded-lg border-2 border-teal-600 py-3 text-teal-600 font-semibold hover:bg-teal-50 transition-colors"
        >
          {t('paediatric.downloadCertificate', lang)}
        </button>
      )}

      {/* Empty state */}
      {schedule.length === 0 && (
        <div className="py-12 text-center text-gray-400">
          {lang === 'ar' ? 'لا توجد تطعيمات مجدولة بعد' : 'No vaccinations scheduled yet'}
        </div>
      )}
    </div>
  );
}
