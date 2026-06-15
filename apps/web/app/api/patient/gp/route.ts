import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthenticatedPatient } from '@/lib/auth/get-patient';

export const dynamic = 'force-dynamic';

// ─── Helpers ────────────────────────────────────────────────────────────────

function getServiceClient() {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

// ─── GET /api/patient/gp ─────────────────────────────────────────────────────
// Returns the patient's current GP relationship (active or pending).

export async function GET() {
  try {
    const patient = await getAuthenticatedPatient();
    if (!patient) {
      return NextResponse.json({ error: 'غير مصرح. يرجى تسجيل الدخول' }, { status: 401 });
    }

    const supabase = getServiceClient();

    const { data: gpRelationship, error } = await supabase
      .from('gp_relationships')
      .select(`
        id,
        doctor_id,
        status,
        initiated_by,
        created_at,
        confirmed_at,
        doctors:doctor_id (
          id,
          name_ar,
          name_en,
          specialties:specialty_id ( name_ar, name_en )
        )
      `)
      .eq('patient_id', patient.patientId)
      .in('status', ['active', 'pending'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[patient/gp/GET] Query error:', error.message);
      return NextResponse.json({ error: 'Failed to fetch GP relationship' }, { status: 500 });
    }

    return NextResponse.json({ gpRelationship: gpRelationship ?? null });
  } catch (err) {
    console.error('[patient/gp/GET] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── DELETE /api/patient/gp ──────────────────────────────────────────────────
// Ends the patient's current active GP relationship.

export async function DELETE() {
  try {
    const patient = await getAuthenticatedPatient();
    if (!patient) {
      return NextResponse.json({ error: 'غير مصرح. يرجى تسجيل الدخول' }, { status: 401 });
    }

    const supabase = getServiceClient();

    // Find the active GP relationship
    const { data: activeGP } = await supabase
      .from('gp_relationships')
      .select('id, doctor_id')
      .eq('patient_id', patient.patientId)
      .eq('status', 'active')
      .maybeSingle();

    if (!activeGP) {
      return NextResponse.json({ error: 'No active GP relationship found' }, { status: 404 });
    }

    // End the relationship
    const { error: updateError } = await supabase
      .from('gp_relationships')
      .update({
        status: 'ended',
        ended_at: new Date().toISOString(),
        ended_by: 'patient',
      })
      .eq('id', activeGP.id);

    if (updateError) {
      console.error('[patient/gp/DELETE] Update error:', updateError.message);
      return NextResponse.json({ error: 'Failed to end GP relationship' }, { status: 500 });
    }

    // Send notifications asynchronously
    notifyGPEnded(patient.patientId, activeGP.doctor_id);

    return NextResponse.json({ success: true, message: 'GP relationship ended' });
  } catch (err) {
    console.error('[patient/gp/DELETE] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── Fire-and-forget notifications ──────────────────────────────────────────

function notifyGPEnded(patientId: string, doctorId: string) {
  const supabase = getServiceClient();

  // `doctors` has no phone column; the doctor's phone (when present) lives on
  // doctor_accounts (joined by doctor_id).
  Promise.all([
    supabase.from('patients').select('phone_number, name_ar, patient_profiles(preferred_language)').eq('id', patientId).single(),
    supabase.from('doctors').select('name_ar').eq('id', doctorId).single(),
    supabase.from('doctor_accounts').select('phone').eq('doctor_id', doctorId).maybeSingle(),
  ])
    .then(async ([patientRes, doctorRes, doctorAccountRes]) => {
      if (!patientRes.data || !doctorRes.data) return;

      const { sendGPEndedNotification } = await import('@/lib/gp/notifications');
      const doctorName = doctorRes.data.name_ar;
      const patientName = patientRes.data.name_ar;
      const doctorPhone = doctorAccountRes.data?.phone ?? null;
      const patientLang =
        (patientRes.data.patient_profiles as { preferred_language: string | null }[] | null)?.[0]
          ?.preferred_language ?? 'ar';

      // Notify patient
      await sendGPEndedNotification(
        patientRes.data.phone_number,
        patientLang,
        { doctorName, patientName, endedBy: 'patient' }
      ).catch((err) => console.error('[gp] Patient notification failed:', err));

      // Notify doctor (always Arabic) — skip if no phone on file
      if (doctorPhone) {
        await sendGPEndedNotification(
          doctorPhone,
          'ar',
          { doctorName, patientName, endedBy: 'patient' }
        ).catch((err) => console.error('[gp] Doctor notification failed:', err));
      }
    })
    .catch((err) => console.error('[gp] Notification lookup failed:', err));
}
