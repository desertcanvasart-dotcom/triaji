'use client';

/**
 * PatientInteractionNote — Patient-Facing Medication Interaction Notice
 *
 * Shows simplified, non-alarming interaction notes for the patient's
 * medication list. Always ends with "Talk to your doctor" guidance.
 *
 * This is NOT the clinical InteractionAlert used by doctors. Language
 * is intentionally non-clinical and non-scary.
 *
 * If no interactions exist: renders nothing (no "all clear" message).
 */

import { useState, useEffect } from 'react';
import { t, type Lang } from '@triaji/shared/i18n';
import type { AdherenceRecord } from './MedicationAdherenceList';

// ─── Types ──────────────────────────────────────────────────────────────────

interface PatientInteraction {
  drugA_ar: string;
  drugA_en: string;
  drugB_ar: string;
  drugB_en: string;
  severity: 'contraindicated' | 'major' | 'moderate' | 'minor';
}

interface PatientInteractionCheckResponse {
  interactions: PatientInteraction[];
}

interface PatientInteractionNoteProps {
  medications: AdherenceRecord[];
  lang: Lang;
}

// ─── Patient-friendly messages per severity ─────────────────────────────────

const PATIENT_MESSAGES: Record<
  PatientInteraction['severity'],
  { ar: string; en: string }
> = {
  contraindicated: {
    ar: 'هذان الدواءان معاً قد يحتاجا مراجعة من طبيبك.',
    en: 'These two medications together may need review by your doctor.',
  },
  major: {
    ar: 'هذان الدواءان معاً قد يحتاجا مراجعة من طبيبك.',
    en: 'These two medications together may need review by your doctor.',
  },
  moderate: {
    ar: 'هذان الدواءان معاً قد يقللا من فعالية أحدهما.',
    en: 'These two medications together may reduce the effectiveness of one.',
  },
  minor: {
    ar: 'هذان الدواءان قد يكون لهما تأثير بسيط على بعضهما.',
    en: 'These two medications may have a minor effect on each other.',
  },
};

// ─── Component ──────────────────────────────────────────────────────────────

export default function PatientInteractionNote({
  medications,
  lang,
}: PatientInteractionNoteProps) {
  const [interactions, setInteractions] = useState<PatientInteraction[]>([]);
  const [drugFlags, setDrugFlags] = useState<Set<string>>(new Set());
  const isRtl = lang === 'ar';

  useEffect(() => {
    if (medications.length < 2) return;

    const controller = new AbortController();

    async function checkInteractions() {
      try {
        const drugs = medications.map((m) => ({
          nameAr: m.drug_name_ar,
          nameEn: m.drug_name_en,
        }));

        const res = await fetch('/api/patient/interactions/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          signal: controller.signal,
          body: JSON.stringify({ medications: drugs }),
        });

        if (!res.ok) return;

        const data = (await res.json()) as PatientInteractionCheckResponse;
        if (data.interactions.length > 0) {
          setInteractions(data.interactions);

          // Build set of drug names that have interactions (for warning icons)
          const flagged = new Set<string>();
          for (const ix of data.interactions) {
            flagged.add(ix.drugA_ar);
            flagged.add(ix.drugA_en);
            flagged.add(ix.drugB_ar);
            flagged.add(ix.drugB_en);
          }
          setDrugFlags(flagged);
        }
      } catch {
        // Silent — patient should not see error messages for interaction checks
      }
    }

    checkInteractions();
    return () => controller.abort();
  }, [medications]);

  // If no interactions, render nothing
  if (interactions.length === 0) return null;

  const talkToDoctor = t('interactions.talkToDoctor', lang);

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Warning icons injected via CSS class targeting — parent handles this */}

      {/* Patient-friendly interaction notes */}
      <div className="mt-4 space-y-3">
        {interactions.map((ix, idx) => {
          const drugA = lang === 'ar' ? ix.drugA_ar : ix.drugA_en;
          const drugB = lang === 'ar' ? ix.drugB_ar : ix.drugB_en;
          const message = PATIENT_MESSAGES[ix.severity][lang];

          return (
            <div
              key={idx}
              className="bg-amber-50 border border-amber-200 rounded-xl p-4"
            >
              <div className="flex items-start gap-2">
                <span className="text-amber-500 text-lg leading-none mt-0.5">
                  ℹ️
                </span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-amber-800 mb-1">
                    {t('interactions.patientNote', lang)}:
                  </p>
                  <p className="text-sm text-amber-900 font-medium mb-1" dir="auto">
                    {drugA} + {drugB}
                  </p>
                  <p className="text-sm text-amber-700 leading-relaxed">
                    {message} {talkToDoctor}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Utility: check if a medication has a known interaction.
 * Used by MedicalRecordDashboard to show ⚠️ icons next to drugs.
 */
export function useDrugInteractionFlags(
  medications: AdherenceRecord[]
): { flaggedDrugs: Set<string>; loading: boolean } {
  const [flaggedDrugs, setFlaggedDrugs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (medications.length < 2) return;

    const controller = new AbortController();
    setLoading(true);

    async function check() {
      try {
        const drugs = medications.map((m) => ({
          nameAr: m.drug_name_ar,
          nameEn: m.drug_name_en,
        }));

        const res = await fetch('/api/patient/interactions/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          signal: controller.signal,
          body: JSON.stringify({ medications: drugs }),
        });

        if (!res.ok) return;

        const data = (await res.json()) as PatientInteractionCheckResponse;
        const flagged = new Set<string>();
        for (const ix of data.interactions) {
          flagged.add(ix.drugA_ar);
          flagged.add(ix.drugA_en);
          flagged.add(ix.drugB_ar);
          flagged.add(ix.drugB_en);
        }
        setFlaggedDrugs(flagged);
      } catch {
        // Silent
      } finally {
        setLoading(false);
      }
    }

    check();
    return () => controller.abort();
  }, [medications]);

  return { flaggedDrugs, loading };
}
