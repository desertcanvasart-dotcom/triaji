import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin, tenantScope } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const ALLOWED_LIMITS = [10, 25, 50, 100, 250, 500];
const ALLOWED_SORT = ['created_at', 'name_ar', 'name_en', 'consultation_fee_egp', 'rating_avg'];

/** GET /api/admin/doctors — list doctors with filters */
export async function GET(request: NextRequest) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const { admin } = authResult;
  const supabase = createAdminClient();
  const tenant = tenantScope(admin);

  const { searchParams } = request.nextUrl;
  const search = searchParams.get('search') ?? '';
  const specialty = searchParams.get('specialty') ?? '';
  const governorate = searchParams.get('governorate') ?? '';
  const status = searchParams.get('status') ?? '';
  const language = searchParams.get('language') ?? '';
  const feeMin = searchParams.get('fee_min') ?? '';
  const feeMax = searchParams.get('fee_max') ?? '';
  const sortBy = searchParams.get('sort_by') ?? 'created_at';
  const sortDir = searchParams.get('sort_dir') === 'asc' ? true : false;
  const page = parseInt(searchParams.get('page') ?? '1', 10);
  const rawLimit = parseInt(searchParams.get('limit') ?? '25', 10);
  const limit = ALLOWED_LIMITS.includes(rawLimit) ? rawLimit : 25;
  const offset = (page - 1) * limit;

  const validSort = ALLOWED_SORT.includes(sortBy) ? sortBy : 'created_at';

  let query = supabase
    .from('doctors')
    .select(`
      *,
      specialties!inner(id, name_ar, name_en),
      governorates!inner(id, name_ar, name_en, code)
    `, { count: 'exact' })
    .order(validSort, { ascending: sortDir })
    .range(offset, offset + limit - 1);

  if (tenant) {
    // Roster = primary affiliation (doctors.tenant_id) plus any secondary
    // affiliations in doctor_tenants (multi-clinic doctors, migration 065).
    const { data: affiliations } = await supabase
      .from('doctor_tenants')
      .select('doctor_id')
      .eq('tenant_id', tenant);
    const affiliatedIds = (affiliations ?? []).map((a) => a.doctor_id);
    if (affiliatedIds.length > 0) {
      query = query.or(`tenant_id.eq.${tenant},id.in.(${affiliatedIds.join(',')})`);
    } else {
      query = query.eq('tenant_id', tenant);
    }
  }

  if (search) {
    query = query.or(`name_ar.ilike.%${search}%,name_en.ilike.%${search}%`);
  }

  if (specialty) {
    query = query.eq('specialty_id', specialty);
  }

  if (governorate) {
    query = query.eq('governorate_id', governorate);
  }

  // Status filter
  if (status === 'active') {
    query = query.eq('is_active', true);
  } else if (status === 'inactive') {
    query = query.eq('is_active', false);
  }

  // Language filter
  if (language) {
    query = query.contains('languages', [language]);
  }

  // Fee range filter
  if (feeMin) {
    const min = parseFloat(feeMin);
    if (!isNaN(min)) query = query.gte('consultation_fee_egp', min);
  }
  if (feeMax) {
    const max = parseFloat(feeMax);
    if (!isNaN(max)) query = query.lte('consultation_fee_egp', max);
  }

  const { data, count, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    doctors: data ?? [],
    total: count ?? 0,
    page,
    limit,
    total_pages: Math.ceil((count ?? 0) / limit),
  });
}

/** POST /api/admin/doctors — create doctor */
export async function POST(request: NextRequest) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const { admin } = authResult;
  const supabase = createAdminClient();

  const body = await request.json();

  // Validate required fields
  const requiredFields = ['name_ar', 'specialty_id', 'governorate_id'];
  for (const field of requiredFields) {
    if (!body[field]) {
      return NextResponse.json(
        { error: `${field} is required.` },
        { status: 400 }
      );
    }
  }

  if (typeof body['name_ar'] === 'string' && body['name_ar'].length < 10) {
    return NextResponse.json(
      { error: 'Arabic name must be at least 10 characters.' },
      { status: 400 }
    );
  }

  if (body['consultation_fee_egp'] !== undefined && body['consultation_fee_egp'] <= 0) {
    return NextResponse.json(
      { error: 'Consultation fee must be a positive number.' },
      { status: 400 }
    );
  }

  // Build location if provided
  let locationData = {};
  if (body['latitude'] && body['longitude']) {
    locationData = {
      location: `SRID=4326;POINT(${body['longitude']} ${body['latitude']})`,
    };
  }

  // Tenant scoping
  const tenantId = admin.role === 'platform_admin'
    ? (body['tenant_id'] ?? null)
    : admin.tenant_id;

  const insertData = {
    name_ar: body['name_ar'],
    name_en: body['name_en'] ?? null,
    title_ar: body['title_ar'] ?? 'د.',
    title_en: body['title_en'] ?? 'Dr.',
    specialty_id: body['specialty_id'],
    sub_specialty_ids: body['sub_specialty_ids'] ?? [],
    governorate_id: body['governorate_id'],
    ...locationData,
    consultation_fee_egp: body['consultation_fee_egp'] ?? null,
    phone: body['phone'] ?? null,
    languages: body['languages'] ?? ['ar'],
    bio_ar: body['bio_ar'] ?? null,
    bio_en: body['bio_en'] ?? null,
    photo_url: body['photo_url'] ?? null,
    years_of_experience: body['years_of_experience'] ?? null,
    accepts_new_patients: body['accepts_new_patients'] ?? true,
    available_for_booking: body['available_for_booking'] ?? true,
    insurance_providers: body['insurance_providers'] ?? [],
    tenant_id: tenantId,
    is_active: true,
  };

  const { data, error } = await supabase
    .from('doctors')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Mirror the affiliation into doctor_tenants (no-op before migration 065).
  if (tenantId && data) {
    await supabase
      .from('doctor_tenants')
      .upsert(
        { doctor_id: data.id, tenant_id: tenantId, is_primary: true },
        { onConflict: 'doctor_id,tenant_id' }
      );
  }

  return NextResponse.json({ doctor: data }, { status: 201 });
}
