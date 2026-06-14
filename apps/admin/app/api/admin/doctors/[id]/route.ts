import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin, tenantScope } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** GET /api/admin/doctors/[id] — single doctor */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('doctors')
    .select(`
      *,
      specialties!inner(id, name_ar, name_en),
      governorates!inner(id, name_ar, name_en, code)
    `)
    .eq('id', id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Doctor not found.' }, { status: 404 });
  }

  return NextResponse.json({ doctor: data });
}

/** PUT /api/admin/doctors/[id] — update doctor */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const { admin } = authResult;
  const { id } = await params;
  const supabase = createAdminClient();
  const tenant = tenantScope(admin);

  // Verify ownership
  let checkQuery = supabase.from('doctors').select('id, tenant_id').eq('id', id);
  if (tenant) {
    checkQuery = checkQuery.eq('tenant_id', tenant);
  }
  const { data: existing } = await checkQuery.single();

  if (!existing) {
    return NextResponse.json({ error: 'Doctor not found.' }, { status: 404 });
  }

  const body = await request.json();

  if (body['name_ar'] && body['name_ar'].length < 10) {
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

  // Build update data (only include provided fields)
  const updateData: Record<string, unknown> = {};
  const allowedFields = [
    'name_ar', 'name_en', 'title_ar', 'title_en', 'specialty_id',
    'sub_specialty_ids', 'governorate_id', 'consultation_fee_egp',
    'phone', 'languages', 'bio_ar', 'bio_en', 'photo_url',
    'years_of_experience', 'accepts_new_patients', 'available_for_booking',
    'insurance_providers', 'is_active',
  ];

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updateData[field] = body[field];
    }
  }

  if (body['latitude'] && body['longitude']) {
    updateData['location'] = `SRID=4326;POINT(${body['longitude']} ${body['latitude']})`;
  }

  const { data, error } = await supabase
    .from('doctors')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ doctor: data });
}

/** DELETE /api/admin/doctors/[id] — soft delete */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;
  const supabase = createAdminClient();

  const { error } = await supabase
    .from('doctors')
    .update({ is_active: false })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
