import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';
import { loadBookingPolicy } from '@/lib/booking-policy';

export const dynamic = 'force-dynamic';

function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  return (
    error?.code === '42P01' ||
    /relation .*doctor_booking_policy.* does not exist/i.test(error?.message ?? '')
  );
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** GET /api/admin/doctors/[id]/booking-policy — always returns a policy (defaults if none) */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;
  const supabase = createAdminClient();
  const policy = await loadBookingPolicy(supabase, id);
  return NextResponse.json({ policy });
}

/** PUT /api/admin/doctors/[id]/booking-policy — upsert the policy */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const { admin } = authResult;
  const { id } = await params;
  const supabase = createAdminClient();
  const body = await request.json();

  const row = {
    doctor_id: id,
    tenant_id: admin.tenant_id,
    min_notice_minutes: clampInt(body['min_notice_minutes'], 0, 100_000, 0),
    max_advance_days: clampInt(body['max_advance_days'], 1, 3_650, 60),
    default_duration_min: clampInt(body['default_duration_min'], 1, 1_440, 30),
    buffer_minutes: clampInt(body['buffer_minutes'], 0, 1_440, 0),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('doctor_booking_policy')
    .upsert(row, { onConflict: 'doctor_id' })
    .select()
    .single();

  if (error) {
    if (isMissingTable(error)) {
      return NextResponse.json(
        { error: 'Booking policy is not available yet — apply migration 075.' },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ policy: data });
}
