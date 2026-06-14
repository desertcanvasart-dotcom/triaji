import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin, requirePharmacyAccess } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** GET /api/admin/pharmacy/catalog — platform medication catalog (public read, no tenant filter) */
export async function GET(request: NextRequest) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;
  const { admin } = authResult;
  const pharmacyCheck = requirePharmacyAccess(admin);
  if (pharmacyCheck) return pharmacyCheck;

  const supabase = createAdminClient();
  const { searchParams } = request.nextUrl;

  const category = searchParams.get('category');
  const search = searchParams.get('search');
  const form = searchParams.get('form');

  let query = supabase
    .from('medication_catalog')
    .select('*')
    .eq('is_active', true)
    .order('name_ar', { ascending: true });

  if (category) query = query.eq('category', category);
  if (form) query = query.eq('form', form);
  if (search) query = query.or(`name_ar.ilike.%${search}%,name_en.ilike.%${search}%,generic_name.ilike.%${search}%`);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ catalog: data });
}
