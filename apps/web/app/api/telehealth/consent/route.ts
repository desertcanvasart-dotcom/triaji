import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@triaji/shared/supabase';

// POST /api/telehealth/consent — log recording consent
export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    bookingId?: string;
    patientId?: string;
    consentedToRecord?: boolean;
  };

  if (!body.bookingId || !body.patientId || body.consentedToRecord === undefined) {
    return NextResponse.json({ error: 'bookingId, patientId, and consentedToRecord are required' }, { status: 400 });
  }

  const supabase = createServerClient();

  const { error } = await supabase
    .from('telehealth_consents')
    .insert({
      booking_id: body.bookingId,
      patient_id: body.patientId,
      consented_to_record: body.consentedToRecord,
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
