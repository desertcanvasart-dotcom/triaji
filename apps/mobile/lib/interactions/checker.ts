/**
 * Mobile Drug Interaction Checker
 *
 * Thin client that calls the web API endpoint /api/interactions/check.
 * Separate implementation from web — does NOT share code with Next.js.
 */

import type {
  DrugInput,
  CheckResult,
  InteractionCheckRequest,
} from '@triaji/shared/types';
import { API_BASE_URL as API_URL } from '../config';

/**
 * Check drug interactions by calling the DoctorTrio web API.
 *
 * @param newDrug        The drug being added
 * @param existingDrugs  Patient's current medications
 * @param patientId      Supabase patient ID
 * @param doctorAccountId Doctor account performing the check
 * @param token          Supabase auth token (Bearer)
 * @returns              CheckResult with interactions, highestSeverity, hasBlocker
 */
export async function checkInteractions(
  newDrug: DrugInput,
  existingDrugs: DrugInput[],
  patientId: string,
  doctorAccountId: string,
  token: string
): Promise<CheckResult> {
  const body: InteractionCheckRequest = {
    newDrug,
    existingDrugs,
    patientId,
    doctorAccountId,
  };

  const response = await fetch(`${API_URL}/api/interactions/check`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(
      `Interaction check failed (${response.status}): ${text || response.statusText}`
    );
  }

  return response.json() as Promise<CheckResult>;
}

/**
 * Check all existing medications against each other (bulk check).
 * Useful for patient record views where you need to flag all interactions.
 *
 * @param drugs          All patient medications
 * @param patientId      Supabase patient ID
 * @param doctorAccountId Doctor account
 * @param token          Supabase auth token
 * @returns              Combined CheckResult with all pairwise interactions
 */
export async function checkAllInteractions(
  drugs: DrugInput[],
  patientId: string,
  doctorAccountId: string,
  token: string
): Promise<CheckResult> {
  if (drugs.length < 2) {
    return {
      interactions: [],
      highestSeverity: null,
      hasBlocker: false,
      checkSource: 'skipped — fewer than 2 drugs',
    };
  }

  // Check each drug only against the drugs that come after it (upper triangle):
  // that covers every unordered pair exactly once instead of twice, and the
  // per-drug checks are independent, so run them in parallel. A failed check
  // resolves to null and is dropped — the rest still complete.
  const settled = await Promise.all(
    drugs.slice(0, -1).map((drug, i) =>
      checkInteractions(
        drug,
        drugs.slice(i + 1),
        patientId,
        doctorAccountId,
        token
      ).catch(() => null)
    )
  );
  const allResults: CheckResult[] = settled.filter(
    (r): r is CheckResult => r !== null
  );

  // Deduplicate interactions (A+B and B+A are the same)
  const seen = new Set<string>();
  const dedupedInteractions = allResults
    .flatMap((r) => r.interactions)
    .filter((ix) => {
      const key = [ix.drugA, ix.drugB].sort().join('|||');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  const hasBlocker = dedupedInteractions.some(
    (ix) => ix.severity === 'contraindicated' || ix.severity === 'major'
  );

  const severityOrder = { contraindicated: 0, major: 1, moderate: 2, minor: 3 };
  const highestSeverity =
    dedupedInteractions.length > 0
      ? dedupedInteractions.reduce((worst, ix) =>
          severityOrder[ix.severity] < severityOrder[worst.severity] ? ix : worst
        ).severity
      : null;

  return {
    interactions: dedupedInteractions,
    highestSeverity,
    hasBlocker,
    checkSource: allResults[0]?.checkSource ?? 'api',
  };
}
