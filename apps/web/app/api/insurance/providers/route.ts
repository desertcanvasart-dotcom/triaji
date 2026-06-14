import { NextResponse } from 'next/server';
import { createServerClient } from '@triaji/shared/supabase';

// GET /api/insurance/providers — list active providers (public)
export async function GET() {
  const supabase = createServerClient();

  const { data: providers, error } = await supabase
    .from('insurance_providers')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ providers: providers ?? [] });
}
