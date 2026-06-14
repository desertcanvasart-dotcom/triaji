/**
 * Drug Interaction Checker — Main Service
 *
 * Resolution order:
 * 1. Local drug_interactions table (bidirectional name match)
 * 2. OpenFDA drug label API (with Claude extraction)
 * 3. Cache OpenFDA results locally for future lookups
 *
 * Returns aggregated CheckResult with highest severity + blocker flag.
 */

import { createClient } from '@supabase/supabase-js';
import type {
  InteractionResult,
  CheckResult,
  DrugInput,
  InteractionSeverity,
} from '@triaji/shared/types';
import { checkOpenFDA } from './openfda';
import { cacheInteraction } from './cache';

// ─── Supabase ────────────────────────────────────────────────────────────────

function getServiceClient() {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

// ─── Severity Ranking ────────────────────────────────────────────────────────

const SEVERITY_ORDER: Record<InteractionSeverity, number> = {
  contraindicated: 4,
  major: 3,
  moderate: 2,
  minor: 1,
};

// ─── Main Checker ────────────────────────────────────────────────────────────

export async function checkDrugInteractions(
  newDrug: DrugInput,
  existingDrugs: DrugInput[]
): Promise<CheckResult> {
  const supabase = getServiceClient();
  const interactions: InteractionResult[] = [];
  let checkSource = 'local';

  // Resolve new drug name (prefer English for API lookups)
  const resolvedNew = newDrug.nameEn ?? newDrug.nameAr;

  for (const existing of existingDrugs) {
    const resolvedExisting = existing.nameEn ?? existing.nameAr;

    // Step 1: Check local DB (bidirectional)
    const { data: localMatch } = await supabase
      .from('drug_interactions')
      .select('*')
      .or(
        `and(drug_a_name_en.ilike.%${resolvedNew}%,drug_b_name_en.ilike.%${resolvedExisting}%),` +
          `and(drug_a_name_en.ilike.%${resolvedExisting}%,drug_b_name_en.ilike.%${resolvedNew}%)`
      )
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (localMatch) {
      interactions.push({
        drugA: resolvedNew,
        drugB: resolvedExisting,
        severity: localMatch.severity as InteractionSeverity,
        mechanismAr: localMatch.mechanism_ar,
        mechanismEn: localMatch.mechanism_en,
        consequenceAr: localMatch.consequence_ar,
        consequenceEn: localMatch.consequence_en,
        recommendationAr: localMatch.recommendation_ar,
        recommendationEn: localMatch.recommendation_en,
        egyptNoteAr: localMatch.egypt_note_ar ?? undefined,
        source: localMatch.source === 'openfda' ? 'openfda' : 'local',
      });
      continue;
    }

    // Step 2: OpenFDA fallback
    try {
      const fdaResult = await checkOpenFDA(resolvedNew, resolvedExisting);
      if (fdaResult) {
        interactions.push(fdaResult);
        checkSource = 'rxnorm+openfda';
        // Cache for future lookups (non-blocking)
        cacheInteraction(fdaResult).catch((err) => {
          console.error('[Interactions] Cache write failed:', err);
        });
      }
    } catch {
      // API unavailable — continue with local-only results
    }
  }

  // Determine highest severity
  let highestSeverity: InteractionSeverity | null = null;
  for (const interaction of interactions) {
    if (
      !highestSeverity ||
      SEVERITY_ORDER[interaction.severity] > SEVERITY_ORDER[highestSeverity]
    ) {
      highestSeverity = interaction.severity;
    }
  }

  return {
    interactions,
    highestSeverity,
    hasBlocker: highestSeverity === 'contraindicated' || highestSeverity === 'major',
    checkSource: interactions.length > 0 ? checkSource : 'local',
  };
}
