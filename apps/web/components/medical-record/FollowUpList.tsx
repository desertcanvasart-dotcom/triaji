'use client';

import { t, type Lang } from '@triaji/shared/i18n';

export interface FollowUpEntry {
  id: string;
  scheduled_date: string;
  doctor_name_ar: string;
  doctor_name_en: string | null;
  reason_ar: string;
  reason_en: string | null;
  status: 'scheduled' | 'completed' | 'overdue';
  days_overdue?: number;
}

interface FollowUpListProps {
  followUps: FollowUpEntry[];
  lang: Lang;
  readOnly?: boolean;
}

function formatFollowUpDate(dateStr: string, lang: Lang): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function FollowUpList({ followUps, lang, readOnly = false }: FollowUpListProps) {
  const isRtl = lang === 'ar';

  if (followUps.length === 0) {
    return (
      <div dir={isRtl ? 'rtl' : 'ltr'}>
        <h3 className="text-base font-bold text-gray-900 mb-2">
          {t('medicalRecord.upcomingFollowUps', lang)}
        </h3>
        <p className="text-sm text-gray-400">{t('medicalRecord.noFollowUps', lang)}</p>
      </div>
    );
  }

  const overdue = followUps.filter((f) => f.status === 'overdue');
  const upcoming = followUps.filter((f) => f.status === 'scheduled');
  const completed = followUps.filter((f) => f.status === 'completed');

  const renderItem = (item: FollowUpEntry) => {
    const doctorName = lang === 'ar' ? item.doctor_name_ar : (item.doctor_name_en ?? item.doctor_name_ar);
    const reason = lang === 'ar' ? item.reason_ar : (item.reason_en ?? item.reason_ar);
    const isOverdue = item.status === 'overdue';
    const isCompleted = item.status === 'completed';

    return (
      <div
        key={item.id}
        className={`rounded-lg border p-3 ${
          isOverdue
            ? 'border-red-200 bg-red-50'
            : isCompleted
              ? 'border-gray-200 bg-gray-50'
              : 'border-green-200 bg-green-50'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900">{doctorName}</p>
            <p className="text-xs text-gray-600 mt-0.5">{reason}</p>
            <p className="text-xs text-gray-400 mt-1">
              {formatFollowUpDate(item.scheduled_date, lang)}
            </p>
          </div>
          <div className="shrink-0 flex flex-col items-end gap-1">
            {isOverdue && (
              <>
                <span className="text-xs font-semibold text-red-600">
                  {t('medicalRecord.overdueFollowUp', lang)}
                </span>
                {item.days_overdue != null && (
                  <span className="text-xs text-red-500">
                    {item.days_overdue} {t('followUp.daysOverdue', lang)}
                  </span>
                )}
                {!readOnly && (
                  <a
                    href={`/${lang}/chat`}
                    className="text-xs bg-red-600 text-white px-2.5 py-1 rounded-lg font-medium hover:bg-red-700 transition-colors mt-1"
                  >
                    {t('medicalRecord.bookNow', lang)}
                  </a>
                )}
              </>
            )}
            {isCompleted && (
              <span className="text-xs font-semibold text-gray-500">
                {t('followUp.completed', lang)}
              </span>
            )}
            {item.status === 'scheduled' && (
              <span className="text-xs font-semibold text-green-600">
                {t('followUp.scheduled', lang)}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'}>
      <h3 className="text-base font-bold text-gray-900 mb-3">
        {t('medicalRecord.upcomingFollowUps', lang)}
      </h3>
      <div className="space-y-2">
        {overdue.length > 0 && (
          <div className="space-y-2">
            {overdue.map(renderItem)}
          </div>
        )}
        {upcoming.length > 0 && (
          <div className="space-y-2">
            {upcoming.map(renderItem)}
          </div>
        )}
        {completed.length > 0 && (
          <div className="space-y-2">
            {completed.map(renderItem)}
          </div>
        )}
      </div>
    </div>
  );
}
