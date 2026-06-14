/**
 * GET /api/lab/chains
 *
 * Public endpoint — returns available lab chains with basic info.
 * No authentication required.
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@triaji/shared/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createServerClient();

    const { data: chains, error } = await supabase
      .from('lab_chains')
      .select(`
        id,
        code,
        name_ar,
        name_en,
        logo_url,
        website,
        hotline,
        has_api,
        branch_count,
        governorates_covered,
        payment_via_triaji,
        is_active,
        sort_order
      `)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('[lab-chains] list error:', error.message);
      return NextResponse.json(
        { error: 'Failed to fetch lab chains' },
        { status: 500 }
      );
    }

    return NextResponse.json({ chains: chains ?? [] });
  } catch (err) {
    console.error('[lab-chains] unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
