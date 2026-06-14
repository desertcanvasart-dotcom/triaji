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

const API_URL = process.env['EXPO_PUBLIC_API_URL'] || 'http://localhost:3000';

/**
 * Check drug interactions by calling the Triajji web API.
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

  // Check each drug against all others that come after it
  // The API checks newDrug vs existingDrugs, so we iterate
  const allResults: CheckResult[] = [];

  for (let i = 0; i < drugs.length; i++) {
    const remaining = drugs.filter((_, j) => j !== i);
    try {
      const result = await checkInteractions(
        drugs[i],
        remaining,
        patientId,
        doctorAccountId,
        token
      );
      allResults.push(result);
    } catch {
      // Continue checking other pairs even if one fails
    }
  }

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
