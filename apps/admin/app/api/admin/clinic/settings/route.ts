import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin, requireClinicAccess } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * PUT /api/admin/clinic/settings — save the clinic's operating settings.
 *
 * The settings form has always PUT here, but the route did not exist, so every
 * save 404'd (silently — the form ignored the response).
 *
 * Values live on `tenant_config`, four of them under clinic_-prefixed names;
 * the form uses the shorter names, so translate in both directions here and in
 * the page that reads them.
 */

type BookingMode = 'walk_in_only' | 'slots_only' | 'both';

const BOOKING_MODES: BookingMode[] = ['walk_in_only', 'slots_only', 'both'];

interface SettingsBody {
  opening_time?: string;
  closing_time?: string;
  working_days?: number[];
  estimated_minutes_per_patient?: number;
  queue_whatsapp_enabled?: boolean;
  queue_sms_fallback?: boolean;
  specialty_ar?: string;
  specialty_en?: string;
  floor_address?: string;
  phone?: string;
  clinic_booking_mode?: BookingMode;
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

function validate(body: SettingsBody): string | null {
  if (body.opening_time !== undefined && !TIME_RE.test(body.opening_time)) {
    return 'opening_time must be HH:MM.';
  }
  if (body.closing_time !== undefined && !TIME_RE.test(body.closing_time)) {
    return 'closing_time must be HH:MM.';
  }
  if (body.working_days !== undefined) {
    if (
      !Array.isArray(body.working_days) ||
      body.working_days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)
    ) {
      return 'working_days must be an array of day numbers 0–6.';
    }
  }
  if (body.estimated_minutes_per_patient !== undefined) {
    const m = body.estimated_minutes_per_patient;
    if (!Number.isInteger(m) || m < 1 || m > 480) {
      return 'estimated_minutes_per_patient must be between 1 and 480.';
    }
  }
  if (body.clinic_booking_mode !== undefined && !BOOKING_MODES.includes(body.clinic_booking_mode)) {
    return `clinic_booking_mode must be one of: ${BOOKING_MODES.join(', ')}.`;
  }
  return null;
}

/** Only include what was actually sent, so a partial save can't blank a field. */
function toConfigRow(body: SettingsBody): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  const direct: (keyof SettingsBody)[] = [
    'opening_time',
    'closing_time',
    'working_days',
    'estimated_minutes_per_patient',
    'queue_whatsapp_enabled',
    'queue_sms_fallback',
    'clinic_booking_mode',
  ];
  for (const key of direct) {
    if (body[key] !== undefined) row[key] = body[key];
  }
  // Renamed on the way in.
  if (body.specialty_ar !== undefined) row['clinic_specialty_ar'] = body.specialty_ar || null;
  if (body.specialty_en !== undefined) row['clinic_specialty_en'] = body.specialty_en || null;
  if (body.floor_address !== undefined) row['clinic_floor_ar'] = body.floor_address || null;
  if (body.phone !== undefined) row['clinic_phone'] = body.phone || null;
  return row;
}

export async function PUT(request: NextRequest) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const { admin } = authResult;
  const clinicCheck = requireClinicAccess(admin);
  if (clinicCheck) return clinicCheck;

  // Scoped to the caller's own clinic — the tenant is never taken from the body.
  const tenantId = admin.tenant_id;
  if (!tenantId) {
    return NextResponse.json(
      { error: 'This account is not attached to a clinic.' },
      { status: 400 }
    );
  }

  let body: SettingsBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const invalid = validate(body);
  if (invalid) {
    return NextResponse.json({ error: invalid }, { status: 400 });
  }

  const row = toConfigRow(body);
  if (Object.keys(row).length === 0) {
    return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
  }

  const supabase = createAdminClient();

  // tenant_config has no unique constraint on tenant_id, so upsert can't key on
  // it — update first, insert only when the tenant has no config row yet.
  const { data: updated, error: updateError } = await supabase
    .from('tenant_config')
    .update(row)
    .eq('tenant_id', tenantId)
    .select('tenant_id');

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  if (!updated || updated.length === 0) {
    const { error: insertError } = await supabase
      .from('tenant_config')
      .insert({ tenant_id: tenantId, ...row });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
