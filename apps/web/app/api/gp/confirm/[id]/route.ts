import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// ─── Helpers ────────────────────────────────────────────────────────────────

function getServiceClient() {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface ConfirmBody {
  action: 'accept' | 'decline';
}

// ─── PUT /api/gp/confirm/[id] ────────────────────────────────────────────────
// Accept or decline a GP relationship request.
// Public (no auth) — secured by UUID shared only via WhatsApp.

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const body = (await request.json()) as ConfirmBody;

    if (!body.action || !['accept', 'decline'].includes(body.action)) {
      return NextResponse.json(
        { error: 'action must be "accept" or "decline"' },
        { status: 400 }
      );
    }

    const supabase = getServiceClient();

    // Find the pending GP relationship by UUID
    const { data: gpRelationship } = await supabase
      .from('gp_relationships')
      .select('id, patient_id, doctor_id, status, initiated_by')
      .eq('id', id)
      .eq('status', 'pending')
      .maybeSingle();

    if (!gpRelationship) {
      return NextResponse.json(
        { error: 'GP request not found or already processed' },
        { status: 404 }
      );
    }

    if (body.action === 'accept') {
      const { error: updateError } = await supabase
        .from('gp_relationships')
        .update({
          status: 'active',
          confirmed_at: new Date().toISOString(),
        })
        .eq('id', gpRelationship.id);

      if (updateError) {
        console.error('[gp/confirm/PUT] Update error:', updateError.message);
        return NextResponse.json({ error: 'Failed to accept GP request' }, { status: 500 });
      }

      // Notify both parties asynchronously
      notifyGPAccepted(gpRelationship.patient_id, gpRelationship.doctor_id);

      return NextResponse.json({
        success: true,
        message: 'GP relationship confirmed',
        status: 'active',
      });
    } else {
      // Decline
      const { error: updateError } = await supabase
        .from('gp_relationships')
        .update({ status: 'declined' })
        .eq('id', gpRelationship.id);

      if (updateError) {
        console.error('[gp/confirm/PUT] Update error:', updateError.message);
        return NextResponse.json({ error: 'Failed to decline GP request' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: 'GP request declined',
        status: 'declined',
      });
    }
  } catch (err) {
    console.error('[gp/confirm/PUT] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function notifyGPAccepted(patientId: string, doctorId: string) {
  const supabase = getServiceClient();

  Promise.all([
    supabase.from('patients').select('phone_number, preferred_language, full_name_ar').eq('id', patientId).single(),
    supabase.from('doctors').select('phone_number, name_ar').eq('id', doctorId).single(),
  ])
    .then(async ([patientRes, doctorRes]) => {
      if (!patientRes.data || !doctorRes.data) return;

      const { sendGPAcceptedNotification } = await import('@/lib/gp/notifications');
      const doctorName = doctorRes.data.name_ar;
      const patientName = patientRes.data.full_name_ar;

      // Notify patient
      await sendGPAcceptedNotification(
        patientRes.data.phone_number,
        patientRes.data.preferred_language ?? 'ar',
        { doctorName, patientName }
      ).catch((err) => console.error('[gp] Patient accept notification failed:', err));

      // Notify doctor (always Arabic)
      await sendGPAcceptedNotification(
        doctorRes.data.phone_number,
        'ar',
        { doctorName, patientName }
      ).catch((err) => console.error('[gp] Doctor accept notification failed:', err));
    })
    .catch((err) => console.error('[gp] Notification lookup failed:', err));
}
