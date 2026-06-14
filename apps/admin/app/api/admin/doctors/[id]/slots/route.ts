import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** GET /api/admin/doctors/[id]/slots — list all slots (including booked) */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;
  const supabase = createAdminClient();

  const { searchParams } = request.nextUrl;
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  let query = supabase
    .from('doctor_availability')
    .select('*')
    .eq('doctor_id', id)
    .order('slot_datetime', { ascending: true });

  if (from) {
    query = query.gte('slot_datetime', from);
  }
  if (to) {
    query = query.lte('slot_datetime', to);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ slots: data ?? [] });
}

/** POST /api/admin/doctors/[id]/slots — add single slot */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const { admin } = authResult;
  const { id } = await params;
  const supabase = createAdminClient();
  const body = await request.json();

  if (!body['slot_datetime']) {
    return NextResponse.json(
      { error: 'slot_datetime is required.' },
      { status: 400 }
    );
  }

  const slotDate = new Date(body['slot_datetime']);
  if (slotDate <= new Date()) {
    return NextResponse.json(
      { error: 'Slot must be in the future.' },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from('doctor_availability')
    .insert({
      doctor_id: id,
      slot_datetime: body['slot_datetime'],
      duration_minutes: body['duration_minutes'] ?? 30,
      is_booked: false,
      source: 'native',
      tenant_id: admin.tenant_id,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ slot: data }, { status: 201 });
}
