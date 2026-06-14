/**
 * Drug Name Resolution
 * Resolves Arabic/English drug names to RxNorm CUI via:
 * 1. Local medication_catalog lookup (generic name)
 * 2. RxNorm REST API lookup
 */

import { createClient } from '@supabase/supabase-js';

// ─── Supabase ────────────────────────────────────────────────────────────────

function getServiceClient() {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

// ─── Resolver ────────────────────────────────────────────────────────────────

export async function resolveDrugToRxCUI(
  drugNameAr: string,
  drugNameEn: string | null
): Promise<{ rxcui: string; resolvedName: string } | null> {
  const supabase = getServiceClient();

  // Step 1: Check medication_catalog for generic name
  const { data: catalogEntry } = await supabase
    .from('medication_catalog')
    .select('generic_name_en, drug_name_en')
    .or(`drug_name_ar.ilike.%${drugNameAr}%,drug_name_en.ilike.%${drugNameEn ?? ''}%`)
    .limit(1)
    .maybeSingle();

  const lookupName =
    catalogEntry?.generic_name_en ??
    catalogEntry?.drug_name_en ??
    drugNameEn ??
    drugNameAr;

  // Step 2: RxNorm lookup
  try {
    const response = await fetch(
      `https://rxnav.nlm.nih.gov/REST/rxcui.json?name=${encodeURIComponent(lookupName)}&search=2`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!response.ok) return null;

    const data = await response.json();
    const rxcui = data?.idGroup?.rxnormId?.[0];

    if (!rxcui) return null;
    return { rxcui, resolvedName: lookupName };
  } catch {
    // API unavailable — return null gracefully
    return null;
  }
}
