import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

/**
 * GET /api/clinics — public list of active medical facilities a registering
 * doctor can request to join (clinics and hospitals; labs/pharmacies/insurers
 * are not doctor workplaces).
 */
export async function GET() {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!url || !key) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from('tenants')
    .select('id, name_ar, name_en, tier')
    .eq('is_active', true)
    .in('tier', ['clinic', 'basic', 'premium'])
    .order('name_ar', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ clinics: data ?? [] });
}
