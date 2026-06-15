import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin, tenantScope } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** GET /api/admin/bookings — list with filters + pagination */
export async function GET(request: NextRequest) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const { admin } = authResult;
  const supabase = createAdminClient();
  const tenant = tenantScope(admin);

  const { searchParams } = request.nextUrl;
  const status = searchParams.get('status') ?? '';
  const doctor = searchParams.get('doctor') ?? '';
  const dateFrom = searchParams.get('dateFrom') ?? '';
  const dateTo = searchParams.get('dateTo') ?? '';
  const sortBy = searchParams.get('sortBy') ?? 'appointment_datetime';
  const page = parseInt(searchParams.get('page') ?? '1', 10);
  const limit = parseInt(searchParams.get('limit') ?? '20', 10);
  const offset = (page - 1) * limit;

  let query = supabase
    .from('bookings')
    .select(`
      *,
      doctors!inner(id, name_ar, name_en, specialty_id, specialties!inner(name_en, name_ar)),
      triage_sessions!fk_session_booking(id, chief_complaint_ar, determined_specialty_id, urgency_level)
    `, { count: 'exact' })
    .order(sortBy === 'created_at' ? 'created_at' : 'appointment_datetime', { ascending: false })
    .range(offset, offset + limit - 1);

  if (tenant) {
    query = query.eq('tenant_id', tenant);
  }
  if (status) {
    query = query.eq('status', status);
  }
  if (doctor) {
    query = query.eq('doctor_id', doctor);
  }
  if (dateFrom) {
    query = query.gte('appointment_datetime', dateFrom);
  }
  if (dateTo) {
    query = query.lte('appointment_datetime', dateTo);
  }

  const { data, count, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ bookings: data ?? [], total: count ?? 0, page, limit });
}
