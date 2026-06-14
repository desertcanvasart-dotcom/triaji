/**
 * POST /api/patient/interactions/check
 * Patient-facing drug interaction check.
 *
 * Mirrors the clinical endpoint at /api/interactions/check but is gated to
 * PATIENT sessions (not doctors). It reuses the same `checkDrugInteractions`
 * logic, then reshapes the result into the simplified, bilingual payload that
 * PatientInteractionNote.tsx expects (each pair carries both AR + EN names so
 * the UI can render in the active locale).
 *
 * Body:    { medications: { nameAr: string; nameEn: string | null }[] }
 * Returns: { interactions: { drugA_ar, drugA_en, drugB_ar, drugB_en, severity }[] }
 *
 * Auth: patient session required (patient-token cookie). Otherwise 401.
 * Note: unlike the doctor endpoint, this does NOT write to interaction_check_log
 * (that table requires a NOT NULL doctor_account_id, which patients lack).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedPatient } from '@/lib/auth/get-patient';
import { createServerClient } from '@triaji/shared/supabase';
import { checkDrugInteractions } from '@/lib/interactions/checker';
import type { DrugInput, InteractionSeverity } from '@triaji/shared/types';

export const dynamic = 'force-dynamic';

// ─── Request / Response shapes (must match PatientInteractionNote.tsx) ────────

interface PatientMedicationInput {
  nameAr: string;
  nameEn: string | null;
}

interface PatientInteraction {
  drugA_ar: string;
  drugA_en: string;
  drugB_ar: string;
  drugB_en: string;
  severity: InteractionSeverity;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * `checkDrugInteractions` resolves each drug down to a single string (English
 * preferred, falling back to Arabic). To return both AR + EN names to the
 * patient UI, we match that resolved string back to the original DrugInput.
 */
function resolvedName(drug: DrugInput): string {
  return drug.nameEn ?? drug.nameAr;
}

function findDrug(
  drugs: DrugInput[],
  resolved: string
): DrugInput | undefined {
  return drugs.find((d) => resolvedName(d) === resolved);
}

// ─── POST Handler ───────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate patient
    const patient = await getAuthenticatedPatient();
    if (!patient) {
      return NextResponse.json(
        { error: 'غير مصرح. يرجى تسجيل الدخول' },
        { status: 401 }
      );
    }

    // 2. Parse + validate body
    const body = (await request.json()) as { medications?: unknown };
    const rawMedications = Array.isArray(body.medications)
      ? (body.medications as PatientMedicationInput[])
      : [];

    const medications: DrugInput[] = rawMedications
      .filter(
        (m): m is PatientMedicationInput =>
          !!m && typeof m.nameAr === 'string' && m.nameAr.length > 0
      )
      .map((m) => ({
        nameAr: m.nameAr,
        nameEn: typeof m.nameEn === 'string' ? m.nameEn : null,
      }));

    // Fewer than 2 drugs → no possible interaction.
    if (medications.length < 2) {
      return NextResponse.json({ interactions: [] });
    }

    // Touch the patient-scoped client so RLS context is established for any
    // downstream patient-readable lookups (kept consistent with other routes).
    createServerClient();

    // 3. Run pairwise interaction check. We walk the list so each drug is only
    //    compared against the drugs after it (avoids duplicate A↔B pairs).
    const seen = new Set<string>();
    const interactions: PatientInteraction[] = [];

    for (let i = 0; i < medications.length; i++) {
      const newDrug = medications[i];
      if (!newDrug) continue;

      const existingDrugs = medications.slice(i + 1);
      if (existingDrugs.length === 0) continue;

      const result = await checkDrugInteractions(newDrug, existingDrugs);

      for (const ix of result.interactions) {
        const a = findDrug(medications, ix.drugA);
        const b = findDrug(medications, ix.drugB);
        if (!a || !b) continue;

        // Deduplicate symmetric pairs.
        const key = [resolvedName(a), resolvedName(b)].sort().join('::');
        if (seen.has(key)) continue;
        seen.add(key);

        interactions.push({
          drugA_ar: a.nameAr,
          drugA_en: a.nameEn ?? a.nameAr,
          drugB_ar: b.nameAr,
          drugB_en: b.nameEn ?? b.nameAr,
          severity: ix.severity,
        });
      }
    }

    // 4. Return simplified, patient-friendly payload.
    return NextResponse.json({ interactions });
  } catch (error) {
    console.error('[Patient Interactions] Check failed:', error);
    // Component treats any non-ok / thrown response as "no interactions",
    // but return a real error code for observability.
    return NextResponse.json(
      { error: 'حدث خطأ أثناء فحص التفاعلات الدوائية', interactions: [] },
      { status: 500 }
    );
  }
}
