'use client';

/**
 * InteractionAlert — Drug Interaction Warning Panel
 *
 * Three visual tiers:
 * - Contraindicated/Major (RED): blocking, requires override reason or drug removal
 * - Moderate (YELLOW): non-blocking, acknowledgement checkbox
 * - Minor (GRAY): info-only badge, no action required
 *
 * Fully bilingual (Arabic / English) via lang prop.
 */

import { useState, useCallback } from 'react';
import type { InteractionResult, InteractionSeverity } from '@triaji/shared/types';

// ─── Types ───────────────────────────────────────────────────────────────────

type Lang = 'ar' | 'en';

interface InteractionAlertProps {
  interactions: InteractionResult[];
  lang: Lang;
  onRemoveDrug: (drugName: string) => void;
  onOverride: (drugName: string, reason: string) => void;
  onAcknowledge: (drugName: string) => void;
}

// ─── Strings ─────────────────────────────────────────────────────────────────

const STRINGS = {
  severityLabels: {
    contraindicated: { ar: 'ممنوع الجمع', en: 'Contraindicated' },
    major: { ar: 'تفاعل خطير', en: 'Major Interaction' },
    moderate: { ar: 'تفاعل متوسط', en: 'Moderate Interaction' },
    minor: { ar: 'تفاعل بسيط', en: 'Minor Interaction' },
  },
  mechanism: { ar: 'الآلية:', en: 'Mechanism:' },
  consequence: { ar: 'العاقبة:', en: 'Consequence:' },
  recommendation: { ar: 'التوصية:', en: 'Recommendation:' },
  egyptNote: { ar: 'ملاحظة مصر:', en: 'Egypt Note:' },
  removeDrug: { ar: 'إزالة الدواء', en: 'Remove Drug' },
  overrideWithNote: { ar: 'متابعة مع التوثيق', en: 'Override with Note' },
  overridePlaceholder: {
    ar: 'سبب المتابعة رغم التفاعل (إلزامي)...',
    en: 'Reason for proceeding despite interaction (required)...',
  },
  acknowledge: {
    ar: 'حسنا\u064B، سأراعي ذلك',
    en: 'Understood, I\'ll monitor',
  },
  interactionBetween: { ar: 'تفاعل بين', en: 'Interaction between' },
  and: { ar: 'و', en: 'and' },
  blockingWarningTitle: {
    ar: 'تحذير: تفاعل دوائي خطير',
    en: 'Warning: Serious Drug Interaction',
  },
  moderateWarningTitle: {
    ar: 'تنبيه: تفاعل دوائي متوسط',
    en: 'Notice: Moderate Drug Interaction',
  },
} as const;

function str(key: keyof typeof STRINGS, lang: Lang): string {
  const val = STRINGS[key];
  if (typeof val === 'object' && 'ar' in val && 'en' in val) {
    return val[lang];
  }
  return '';
}

function severityLabel(severity: InteractionSeverity, lang: Lang): string {
  return STRINGS.severityLabels[severity][lang];
}

// ─── Severity Helpers ────────────────────────────────────────────────────────

function isBlocking(severity: InteractionSeverity): boolean {
  return severity === 'contraindicated' || severity === 'major';
}

function isModerate(severity: InteractionSeverity): boolean {
  return severity === 'moderate';
}

// ─── Sub-Components ──────────────────────────────────────────────────────────

function BlockingInteraction({
  interaction,
  lang,
  onRemoveDrug,
  onOverride,
}: {
  interaction: InteractionResult;
  lang: Lang;
  onRemoveDrug: (drugName: string) => void;
  onOverride: (drugName: string, reason: string) => void;
}) {
  const [overrideReason, setOverrideReason] = useState('');
  const isRtl = lang === 'ar';

  const handleOverride = useCallback(() => {
    if (overrideReason.trim().length > 0) {
      onOverride(interaction.drugB, overrideReason.trim());
    }
  }, [overrideReason, onOverride, interaction.drugB]);

  const mechanism = lang === 'ar' ? interaction.mechanismAr : interaction.mechanismEn;
  const consequence = lang === 'ar' ? interaction.consequenceAr : interaction.consequenceEn;
  const recommendation = lang === 'ar' ? interaction.recommendationAr : interaction.recommendationEn;

  return (
    <div
      className="rounded-lg border-2 border-red-400 bg-red-50 p-4"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <svg
          className="h-5 w-5 flex-shrink-0 text-red-600"
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
        <h3 className="text-sm font-bold text-red-800 font-[Cairo]">
          {str('blockingWarningTitle', lang)}
        </h3>
        <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white font-[Cairo]">
          {severityLabel(interaction.severity, lang)}
        </span>
      </div>

      {/* Drug pair */}
      <p className="mb-2 text-sm font-semibold text-red-900 font-[Cairo]">
        {str('interactionBetween', lang)}{' '}
        <span className="font-bold">{interaction.drugA}</span>{' '}
        {str('and', lang)}{' '}
        <span className="font-bold">{interaction.drugB}</span>
      </p>

      {/* Details */}
      <div className="space-y-1.5 text-sm text-red-800 font-[Cairo]">
        {mechanism && (
          <p>
            <span className="font-semibold">{str('mechanism', lang)}</span> {mechanism}
          </p>
        )}
        {consequence && (
          <p>
            <span className="font-semibold">{str('consequence', lang)}</span> {consequence}
          </p>
        )}
        {recommendation && (
          <p>
            <span className="font-semibold">{str('recommendation', lang)}</span> {recommendation}
          </p>
        )}
        {interaction.egyptNoteAr && lang === 'ar' && (
          <p>
            <span className="font-semibold">{str('egyptNote', lang)}</span>{' '}
            {interaction.egyptNoteAr}
          </p>
        )}
      </div>

      {/* Override reason */}
      <div className="mt-3">
        <textarea
          className="w-full rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-[Cairo] placeholder-red-300 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
          rows={2}
          placeholder={str('overridePlaceholder', lang)}
          value={overrideReason}
          onChange={(e) => setOverrideReason(e.target.value)}
          dir={isRtl ? 'rtl' : 'ltr'}
        />
      </div>

      {/* Actions */}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => onRemoveDrug(interaction.drugB)}
          className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white font-[Cairo] hover:bg-red-700 transition-colors"
        >
          {str('removeDrug', lang)}
        </button>
        <button
          type="button"
          onClick={handleOverride}
          disabled={overrideReason.trim().length === 0}
          className="flex-1 rounded-lg border border-red-400 bg-white px-4 py-2 text-sm font-semibold text-red-700 font-[Cairo] hover:bg-red-50 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        >
          {str('overrideWithNote', lang)}
        </button>
      </div>
    </div>
  );
}

function ModerateInteraction({
  interaction,
  lang,
  onAcknowledge,
}: {
  interaction: InteractionResult;
  lang: Lang;
  onAcknowledge: (drugName: string) => void;
}) {
  const [acknowledged, setAcknowledged] = useState(false);
  const isRtl = lang === 'ar';

  const mechanism = lang === 'ar' ? interaction.mechanismAr : interaction.mechanismEn;
  const recommendation = lang === 'ar' ? interaction.recommendationAr : interaction.recommendationEn;

  const handleAcknowledge = useCallback(() => {
    setAcknowledged(true);
    onAcknowledge(interaction.drugB);
  }, [onAcknowledge, interaction.drugB]);

  return (
    <div
      className="rounded-lg border-2 border-amber-400 bg-amber-50 p-4"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <svg
          className="h-5 w-5 flex-shrink-0 text-amber-600"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
          />
        </svg>
        <h3 className="text-sm font-bold text-amber-800 font-[Cairo]">
          {str('moderateWarningTitle', lang)}
        </h3>
        <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-semibold text-white font-[Cairo]">
          {severityLabel(interaction.severity, lang)}
        </span>
      </div>

      {/* Drug pair */}
      <p className="mb-2 text-sm font-semibold text-amber-900 font-[Cairo]">
        {str('interactionBetween', lang)}{' '}
        <span className="font-bold">{interaction.drugA}</span>{' '}
        {str('and', lang)}{' '}
        <span className="font-bold">{interaction.drugB}</span>
      </p>

      {/* Details */}
      <div className="space-y-1.5 text-sm text-amber-800 font-[Cairo]">
        {mechanism && (
          <p>
            <span className="font-semibold">{str('mechanism', lang)}</span> {mechanism}
          </p>
        )}
        {recommendation && (
          <p>
            <span className="font-semibold">{str('recommendation', lang)}</span> {recommendation}
          </p>
        )}
      </div>

      {/* Acknowledgement */}
      <div className="mt-3">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={handleAcknowledge}
            disabled={acknowledged}
            className="h-4 w-4 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
          />
          <span className="text-sm font-medium text-amber-800 font-[Cairo]">
            {str('acknowledge', lang)}
          </span>
        </label>
      </div>
    </div>
  );
}

function MinorInteraction({
  interaction,
  lang,
}: {
  interaction: InteractionResult;
  lang: Lang;
}) {
  const isRtl = lang === 'ar';
  const mechanism = lang === 'ar' ? interaction.mechanismAr : interaction.mechanismEn;

  return (
    <div
      className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <svg
        className="h-4 w-4 flex-shrink-0 text-gray-400"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z"
        />
      </svg>
      <span className="rounded bg-gray-200 px-1.5 py-0.5 text-xs font-medium text-gray-600 font-[Cairo]">
        {severityLabel('minor', lang)}
      </span>
      <span className="text-sm text-gray-700 font-[Cairo]">
        {interaction.drugA} + {interaction.drugB}
        {mechanism ? ` — ${mechanism}` : ''}
      </span>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function InteractionAlert({
  interactions,
  lang,
  onRemoveDrug,
  onOverride,
  onAcknowledge,
}: InteractionAlertProps) {
  if (interactions.length === 0) return null;

  // Group by severity tier
  const blocking = interactions.filter((i) => isBlocking(i.severity));
  const moderate = interactions.filter((i) => isModerate(i.severity));
  const minor = interactions.filter((i) => i.severity === 'minor');

  return (
    <div className="space-y-3">
      {/* Blocking (red) */}
      {blocking.map((interaction) => (
        <BlockingInteraction
          key={`${interaction.drugA}-${interaction.drugB}`}
          interaction={interaction}
          lang={lang}
          onRemoveDrug={onRemoveDrug}
          onOverride={onOverride}
        />
      ))}

      {/* Moderate (yellow) */}
      {moderate.map((interaction) => (
        <ModerateInteraction
          key={`${interaction.drugA}-${interaction.drugB}`}
          interaction={interaction}
          lang={lang}
          onAcknowledge={onAcknowledge}
        />
      ))}

      {/* Minor (gray) */}
      {minor.map((interaction) => (
        <MinorInteraction
          key={`${interaction.drugA}-${interaction.drugB}`}
          interaction={interaction}
          lang={lang}
        />
      ))}
    </div>
  );
}
