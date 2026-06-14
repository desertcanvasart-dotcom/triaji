'use client';

/**
 * PreConsultationView — Medication interaction banner for pre-consultation.
 *
 * On mount: loads patient's existing medications, checks all pairs for
 * interactions, and shows an informational (non-blocking) banner if any found.
 *
 * Uses InteractionAlert in "info" mode — no actions needed from the doctor,
 * just awareness before the consultation begins.
 */

import { useState, useEffect, useCallback } from 'react';
import type { InteractionResult, CheckResult } from '@triaji/shared/types';

// ─── Types ───────────────────────────────────────────────────────────────────

type Lang = 'ar' | 'en';

interface PreConsultationViewProps {
  patientId: string;
  lang: Lang;
}

interface PatientMedication {
  drug_name_ar: string;
  drug_name_en: string | null;
}

// ─── Strings ────────────────────────────────────────────────────────────────

const STRINGS = {
  existingInteractions: {
    ar: 'تفاعلات في أدوية المريض الحالية',
    en: "Interactions in patient's current medications",
  },
  loading: {
    ar: 'جاري فحص التفاعلات بين أدوية المريض...',
    en: "Checking patient's medication interactions...",
  },
  noInteractions: {
    ar: 'لا توجد تفاعلات دوائية معروفة بين أدوية المريض الحالية',
    en: "No known interactions among patient's current medications",
  },
  checkFailed: {
    ar: 'تعذر التحقق من التفاعلات بين الأدوية',
    en: 'Unable to check medication interactions',
  },
  noMedications: {
    ar: 'لا توجد أدوية مسجلة للمريض',
    en: 'No medications on record for this patient',
  },
  interactionBetween: { ar: 'تفاعل بين', en: 'Interaction between' },
  and: { ar: 'و', en: 'and' },
  mechanism: { ar: 'الآلية:', en: 'Mechanism:' },
  recommendation: { ar: 'التوصية:', en: 'Recommendation:' },
  severityLabels: {
    contraindicated: { ar: 'ممنوع الجمع', en: 'Contraindicated' },
    major: { ar: 'تفاعل خطير', en: 'Major' },
    moderate: { ar: 'تفاعل متوسط', en: 'Moderate' },
    minor: { ar: 'تفاعل بسيط', en: 'Minor' },
  },
} as const;

// ─── Severity Helpers ───────────────────────────────────────────────────────

function severityColor(severity: InteractionResult['severity']): {
  bg: string;
  border: string;
  text: string;
  badge: string;
} {
  switch (severity) {
    case 'contraindicated':
    case 'major':
      return {
        bg: 'bg-red-50',
        border: 'border-red-300',
        text: 'text-red-800',
        badge: 'bg-red-600 text-white',
      };
    case 'moderate':
      return {
        bg: 'bg-amber-50',
        border: 'border-amber-300',
        text: 'text-amber-800',
        badge: 'bg-amber-500 text-white',
      };
    case 'minor':
    default:
      return {
        bg: 'bg-gray-50',
        border: 'border-gray-200',
        text: 'text-gray-700',
        badge: 'bg-gray-200 text-gray-700',
      };
  }
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function PreConsultationView({ patientId, lang }: PreConsultationViewProps) {
  const [interactions, setInteractions] = useState<InteractionResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [medications, setMedications] = useState<PatientMedication[]>([]);
  const isRtl = lang === 'ar';

  const checkExistingMedications = useCallback(async () => {
    try {
      // Load patient medications via the patient API
      const medsRes = await fetch(`/api/patient/${patientId}/medications`);
      if (!medsRes.ok) {
        setMedications([]);
        setLoading(false);
        return;
      }
      const medsData: PatientMedication[] = await medsRes.json();
      setMedications(medsData);

      if (medsData.length < 2) {
        // Need at least 2 meds to check interactions between them
        setLoading(false);
        return;
      }

      // Check each pair of medications
      const allInteractions: InteractionResult[] = [];
      const checked = new Set<string>();

      for (let i = 0; i < medsData.length; i++) {
        const drugA = medsData[i];
        const otherDrugs = medsData
          .filter((_, j) => j !== i)
          .map((m) => ({
            nameAr: m.drug_name_ar,
            nameEn: m.drug_name_en,
          }));

        // Create a sorted pair key to avoid duplicate checks
        const pairKey = [drugA.drug_name_ar, ...otherDrugs.map((d) => d.nameAr)]
          .sort()
          .join('|');
        if (checked.has(pairKey)) continue;
        checked.add(pairKey);

        try {
          const res = await fetch('/api/interactions/check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              newDrug: {
                nameAr: drugA.drug_name_ar,
                nameEn: drugA.drug_name_en,
              },
              existingDrugs: otherDrugs,
              patientId,
              doctorAccountId: 'pre-consultation-check',
            }),
          });

          if (res.ok) {
            const result: CheckResult = await res.json();
            // Deduplicate by drug pair
            for (const interaction of result.interactions) {
              const key = [interaction.drugA, interaction.drugB].sort().join(':');
              if (!allInteractions.some((i) => [i.drugA, i.drugB].sort().join(':') === key)) {
                allInteractions.push(interaction);
              }
            }
          }
        } catch {
          // Individual check failed — continue
        }
      }

      setInteractions(allInteractions);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    checkExistingMedications();
  }, [checkExistingMedications]);

  // ── Loading ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div
        className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 flex items-center gap-2"
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        <svg className="h-4 w-4 animate-spin text-teal-600" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
          <path
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            className="opacity-75"
          />
        </svg>
        <span className="text-sm text-teal-700 font-[Cairo]">
          {STRINGS.loading[lang]}
        </span>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div
        className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 font-[Cairo]"
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        {STRINGS.checkFailed[lang]}
      </div>
    );
  }

  // ── No medications ────────────────────────────────────────────────────────

  if (medications.length === 0) {
    return null; // Don't show anything if no medications on record
  }

  // ── No interactions ───────────────────────────────────────────────────────

  if (interactions.length === 0) {
    return null; // Don't show banner if no interactions found
  }

  // ── Interactions found — info banner ──────────────────────────────────────

  // Sort by severity (most severe first)
  const sorted = [...interactions].sort((a, b) => {
    const order = { contraindicated: 4, major: 3, moderate: 2, minor: 1 };
    return (order[b.severity] ?? 0) - (order[a.severity] ?? 0);
  });

  const highestSeverity = sorted[0].severity;
  const bannerColors =
    highestSeverity === 'contraindicated' || highestSeverity === 'major'
      ? 'border-red-300 bg-red-50'
      : highestSeverity === 'moderate'
        ? 'border-amber-300 bg-amber-50'
        : 'border-gray-200 bg-gray-50';

  const bannerIconColor =
    highestSeverity === 'contraindicated' || highestSeverity === 'major'
      ? 'text-red-600'
      : highestSeverity === 'moderate'
        ? 'text-amber-600'
        : 'text-gray-500';

  const bannerTextColor =
    highestSeverity === 'contraindicated' || highestSeverity === 'major'
      ? 'text-red-800'
      : highestSeverity === 'moderate'
        ? 'text-amber-800'
        : 'text-gray-700';

  return (
    <div
      className={`rounded-xl border-2 ${bannerColors} p-4`}
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {/* Banner Header */}
      <div className="flex items-center gap-2 mb-3">
        <svg
          className={`h-5 w-5 flex-shrink-0 ${bannerIconColor}`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
          />
        </svg>
        <h3 className={`text-sm font-bold font-[Cairo] ${bannerTextColor}`}>
          {STRINGS.existingInteractions[lang]}
        </h3>
        <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-medium font-[Cairo] text-gray-600">
          {sorted.length} {lang === 'ar' ? 'تفاعل' : `interaction${sorted.length > 1 ? 's' : ''}`}
        </span>
      </div>

      {/* Interaction List */}
      <div className="space-y-2">
        {sorted.map((interaction, idx) => {
          const colors = severityColor(interaction.severity);
          const mechanism = lang === 'ar' ? interaction.mechanismAr : interaction.mechanismEn;
          const recommendation = lang === 'ar' ? interaction.recommendationAr : interaction.recommendationEn;
          const severityLabel =
            STRINGS.severityLabels[interaction.severity][lang];

          return (
            <div
              key={`${interaction.drugA}-${interaction.drugB}-${idx}`}
              className={`rounded-lg border ${colors.border} ${colors.bg} p-3`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold font-[Cairo] ${colors.badge}`}
                >
                  {severityLabel}
                </span>
                <span className={`text-sm font-semibold font-[Cairo] ${colors.text}`}>
                  {interaction.drugA} + {interaction.drugB}
                </span>
              </div>
              {mechanism && (
                <p className={`text-xs font-[Cairo] ${colors.text} opacity-80`}>
                  <span className="font-semibold">{STRINGS.mechanism[lang]}</span>{' '}
                  {mechanism}
                </p>
              )}
              {recommendation && (
                <p className={`text-xs font-[Cairo] ${colors.text} opacity-80 mt-0.5`}>
                  <span className="font-semibold">{STRINGS.recommendation[lang]}</span>{' '}
                  {recommendation}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
