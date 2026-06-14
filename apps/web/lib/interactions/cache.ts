/**
 * Interaction Cache
 * Persists successful OpenFDA API results to the drug_interactions table
 * to prevent redundant external API calls on subsequent checks.
 */

import { createClient } from '@supabase/supabase-js';
import type { InteractionResult } from '@triaji/shared/types';

// ─── Supabase ────────────────────────────────────────────────────────────────

function getServiceClient() {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

// ─── Cache Writer ────────────────────────────────────────────────────────────

export async function cacheInteraction(result: InteractionResult): Promise<void> {
  const supabase = getServiceClient();

  // Check if already cached (bidirectional)
  const { data: existing } = await supabase
    .from('drug_interactions')
    .select('id')
    .or(
      `and(drug_a_name_en.ilike.${result.drugA},drug_b_name_en.ilike.${result.drugB}),` +
        `and(drug_a_name_en.ilike.${result.drugB},drug_b_name_en.ilike.${result.drugA})`
    )
    .limit(1)
    .maybeSingle();

  if (existing) return; // Already cached

  await supabase.from('drug_interactions').insert({
    drug_a_name_en: result.drugA,
    drug_b_name_en: result.drugB,
    severity: result.severity,
    mechanism_ar: result.mechanismAr,
    mechanism_en: result.mechanismEn,
    consequence_ar: result.consequenceAr,
    consequence_en: result.consequenceEn,
    recommendation_ar: result.recommendationAr,
    recommendation_en: result.recommendationEn,
    source: 'openfda',
  });
}
