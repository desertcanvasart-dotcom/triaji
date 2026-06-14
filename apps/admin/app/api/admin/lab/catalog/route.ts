import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin, requireLabAccess } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** GET /api/admin/lab/catalog — platform test catalog (public read, no tenant filter) */
export async function GET(request: NextRequest) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;
  const { admin } = authResult;
  const labCheck = requireLabAccess(admin);
  if (labCheck) return labCheck;

  const supabase = createAdminClient();
  const { searchParams } = request.nextUrl;

  const category = searchParams.get('category');
  const search = searchParams.get('search');

  let query = supabase
    .from('lab_test_catalog')
    .select('*')
    .eq('is_active', true)
    .order('name_ar', { ascending: true });

  if (category) query = query.eq('category', category);
  if (search) query = query.or(`name_ar.ilike.%${search}%,name_en.ilike.%${search}%,code.ilike.%${search}%`);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ catalog: data });
}
