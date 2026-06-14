'use client';

import { useState, useEffect, useCallback } from 'react';
import { t, type Lang } from '@triaji/shared/i18n';
import type { MilestoneCategory } from '@triaji/shared/types/paediatric';

interface MilestoneTrackerProps {
  childId: string;
  lang: Lang;
}

interface MilestoneItem {
  id: string;
  category: MilestoneCategory;
  category_ar: string;
  age_months: number;
  milestone_ar: string;
  milestone_en: string;
  is_red_flag: boolean;
  sort_order: number;
  achievement: {
    id: string;
    achieved: boolean | null;
    achieved_at_months: number | null;
    notes_ar: string | null;
  } | null;
  status: 'achieved' | 'upcoming' | 'red_flag';
}

const CATEGORY_ORDER: MilestoneCategory[] = ['gross_motor', 'fine_motor', 'language', 'social', 'cognitive'];

const CATEGORY_LABELS: Record<MilestoneCategory, { key: string; fallback_ar: string; fallback_en: string }> = {
  gross_motor: { key: 'paediatric.grossMotor', fallback_ar: 'حركة كبيرة', fallback_en: 'Gross motor' },
  fine_motor: { key: 'paediatric.fineMotor', fallback_ar: 'حركة دقيقة', fallback_en: 'Fine motor' },
  language: { key: 'paediatric.language', fallback_ar: 'لغة', fallback_en: 'Language' },
  social: { key: 'paediatric.social', fallback_ar: 'اجتماعي', fallback_en: 'Social' },
  cognitive: { key: 'paediatric.social', fallback_ar: 'إدراكي', fallback_en: 'Cognitive' },
};

export default function MilestoneTracker({ childId, lang }: MilestoneTrackerProps) {
  const isRtl = lang === 'ar';
  const [milestones, setMilestones] = useState<MilestoneItem[]>([]);
  const [byCategory, setByCategory] = useState<Record<string, MilestoneItem[]>>({});
  const [ageMonths, setAgeMonths] = useState(0);
  const [redFlagCount, setRedFlagCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(CATEGORY_ORDER));
  const [updating, setUpdating] = useState<string | null>(null);
  const [ageInput, setAgeInput] = useState<Record<string, string>>({});

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/child/${childId}/milestones`);
      const data = await res.json();
      if (res.ok) {
        setMilestones(data.milestones ?? []);
        setByCategory(data.byCategory ?? {});
        setAgeMonths(data.ageMonths ?? 0);
        setRedFlagCount(data.redFlagCount ?? 0);
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

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  };

  const handleMarkAchieved = async (milestoneId: string) => {
    setUpdating(milestoneId);
    const achievedAtMonths = ageInput[milestoneId]
      ? Number(ageInput[milestoneId])
      : undefined;

    try {
      const res = await fetch(`/api/child/${childId}/milestones/${milestoneId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          achieved: true,
          achieved_at_months: achievedAtMonths,
        }),
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">{t('common.loading', lang)}</div>
      </div>
    );
  }

  const achievedCount = milestones.filter((m) => m.status === 'achieved').length;

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-2 text-2xl font-bold text-gray-900">
        {t('paediatric.milestones', lang)}
      </h1>
      <p className="mb-4 text-sm text-gray-500">
        {lang === 'ar'
          ? `العمر الحالي: ${ageMonths} شهر — ${achievedCount}/${milestones.length} تحقق`
          : `Current age: ${ageMonths} months — ${achievedCount}/${milestones.length} achieved`}
      </p>

      {/* Red flag banner */}
      {redFlagCount > 0 && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <span className="text-xl">&#x26A0;&#xFE0F;</span>
            <div>
              <h3 className="font-semibold text-amber-800">
                {t('paediatric.redFlagAlert', lang)}
              </h3>
              <p className="mt-1 text-sm text-amber-700">
                {t('paediatric.redFlagMsg', lang)}
              </p>
              <button className="mt-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 transition-colors">
                {t('paediatric.talkToPaed', lang)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Milestones by category (accordion) */}
      <div className="space-y-3">
        {CATEGORY_ORDER.filter((cat) => (byCategory[cat]?.length ?? 0) > 0).map((category) => {
          const items = byCategory[category] ?? [];
          const isExpanded = expandedCategories.has(category);
          const catLabel = CATEGORY_LABELS[category];
          const label = lang === 'ar' ? catLabel.fallback_ar : catLabel.fallback_en;
          const catAchieved = items.filter((m) => m.status === 'achieved').length;
          const catRedFlags = items.filter((m) => m.status === 'red_flag').length;

          return (
            <div key={category} className="rounded-xl border border-gray-200 overflow-hidden">
              {/* Category header */}
              <button
                onClick={() => toggleCategory(category)}
                className="flex w-full items-center justify-between bg-gray-50 px-4 py-3 text-left hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-800">{label}</span>
                  <span className="text-xs text-gray-400">
                    {catAchieved}/{items.length}
                  </span>
                  {catRedFlags > 0 && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                      {catRedFlags} {lang === 'ar' ? 'تنبيه' : 'alert'}
                    </span>
                  )}
                </div>
                <span className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                  &#9660;
                </span>
              </button>

              {/* Milestone items */}
              {isExpanded && (
                <div className="divide-y divide-gray-100">
                  {items.map((milestone) => {
                    const milestoneName = lang === 'ar'
                      ? milestone.milestone_ar
                      : milestone.milestone_en;

                    const statusIcon =
                      milestone.status === 'achieved'
                        ? '\u2713'
                        : milestone.status === 'red_flag'
                          ? '\u26A0\uFE0F'
                          : '\u25CB';

                    const statusColor =
                      milestone.status === 'achieved'
                        ? 'text-green-600'
                        : milestone.status === 'red_flag'
                          ? 'text-amber-600'
                          : 'text-gray-400';

                    const bgColor =
                      milestone.status === 'red_flag'
                        ? 'bg-amber-50'
                        : 'bg-white';

                    return (
                      <div
                        key={milestone.id}
                        className={`px-4 py-3 ${bgColor}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <span className={`mt-0.5 text-lg ${statusColor}`}>
                              {statusIcon}
                            </span>
                            <div>
                              <div className="text-sm font-medium text-gray-800">
                                {milestoneName}
                              </div>
                              <div className="mt-0.5 text-xs text-gray-400">
                                {lang === 'ar' ? 'العمر المتوقع:' : 'Expected:'}{' '}
                                {milestone.age_months} {t('paediatric.months', lang)}
                              </div>
                              {milestone.achievement?.achieved_at_months && (
                                <div className="mt-0.5 text-xs text-green-600">
                                  {lang === 'ar' ? 'تحقق في:' : 'Achieved at:'}{' '}
                                  {milestone.achievement.achieved_at_months} {t('paediatric.months', lang)}
                                </div>
                              )}
                            </div>
                          </div>

                          {milestone.status === 'achieved' ? (
                            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                              {t('paediatric.milestoneAchieved', lang)}
                            </span>
                          ) : milestone.status === 'red_flag' ? (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                              {t('paediatric.redFlagAlert', lang)}
                            </span>
                          ) : (
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                              {t('paediatric.milestoneUpcoming', lang)}
                            </span>
                          )}
                        </div>

                        {/* Mark as achieved button (only for non-achieved) */}
                        {milestone.status !== 'achieved' && (
                          <div className={`mt-2 flex items-center gap-2 ${isRtl ? 'flex-row-reverse justify-end' : ''}`}>
                            <input
                              type="number"
                              placeholder={lang === 'ar' ? 'العمر (شهور)' : 'Age (months)'}
                              value={ageInput[milestone.id] ?? ''}
                              onChange={(e) =>
                                setAgeInput((prev) => ({ ...prev, [milestone.id]: e.target.value }))
                              }
                              className="w-28 rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                              min={0}
                              max={72}
                            />
                            <button
                              onClick={() => handleMarkAchieved(milestone.id)}
                              disabled={updating === milestone.id}
                              className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                            >
                              {updating === milestone.id
                                ? t('common.loading', lang)
                                : t('paediatric.milestoneAchieved', lang)}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {milestones.length === 0 && (
        <div className="py-12 text-center text-gray-400">
          {lang === 'ar' ? 'لا توجد مراحل تطور مسجلة بعد' : 'No milestones recorded yet'}
        </div>
      )}
    </div>
  );
}
