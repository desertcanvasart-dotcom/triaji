import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@triaji/shared/supabase';
import { getAuthenticatedPatient } from '@/lib/auth/get-patient';
import { verifyPatientToken } from '@/lib/auth/patient-token';

export const dynamic = 'force-dynamic';

// ─── GET /api/patient/consent ───────────────────────────────────────────────
// Returns all active access grants, GP relationship, and treating doctors.
export async function GET() {
  const patient = await getAuthenticatedPatient();
  if (!patient) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const supabase = createServerClient();
  const pid = patient.patientId;

  const [grantsResult, gpResult, treatingResult] = await Promise.all([
    // 1. Temporary access grants
    supabase
      .from('record_access_grants')
      .select(`
        id, granted_to_account, scope, conditions_filter, granted_at, expires_at, is_active,
        doctor_accounts(name_ar, name_en, specialty_ar)
      `)
      .eq('patient_id', pid)
      .eq('is_active', true)
      .order('granted_at', { ascending: false }),

    // 2. Active GP relationship
    supabase
      .from('gp_relationships')
      .select(`
        id, status, confirmed_at, requested_at,
        doctor_accounts(id, name_ar, name_en, specialty_ar, clinic_name_ar, clinic_name_en)
      `)
      .eq('patient_id', pid)
      .eq('status', 'active')
      .maybeSingle(),

    // 3. Treating doctors (from recent bookings)
    supabase
      .from('bookings')
      .select(`
        id, appointment_datetime, status,
        doctors!inner(id, name_ar, name_en, specialties:specialty_id(name_ar, name_en))
      `)
      .eq('patient_id', pid)
      .in('status', ['confirmed', 'completed'])
      .order('appointment_datetime', { ascending: false })
      .limit(20),
  ]);

  // Deduplicate treating doctors by doctor ID
  const seenDoctors = new Set<string>();
  const treatingDoctors = (treatingResult.data ?? [])
    .map((b: Record<string, unknown>) => {
      const doc = Array.isArray(b.doctors) ? b.doctors[0] : b.doctors;
      return doc as { id: string; name_ar: string; name_en: string; specialties?: { name_ar: string; name_en: string } } | null;
    })
    .filter((d): d is NonNullable<typeof d> => {
      if (!d || seenDoctors.has(d.id)) return false;
      seenDoctors.add(d.id);
      return true;
    });

  return NextResponse.json({
    grants: (grantsResult.data ?? []).map((g: Record<string, unknown>) => {
      const doc = Array.isArray(g.doctor_accounts) ? g.doctor_accounts[0] : g.doctor_accounts;
      return {
        id: g.id,
        doctorAccountId: g.granted_to_account,
        scope: g.scope,
        conditionsFilter: g.conditions_filter,
        grantedAt: g.granted_at,
        expiresAt: g.expires_at,
        doctor: doc ?? null,
      };
    }),
    gp: gpResult.data
      ? {
          id: gpResult.data.id,
          status: gpResult.data.status,
          assignedAt: gpResult.data.confirmed_at ?? gpResult.data.requested_at,
          doctor: Array.isArray(gpResult.data.doctor_accounts)
            ? gpResult.data.doctor_accounts[0]
            : gpResult.data.doctor_accounts,
        }
      : null,
    treatingDoctors,
  });
}

// ─── POST /api/patient/consent ──────────────────────────────────────────────
// Legacy: grant or revoke doctor history access (booking-time consent).
export async function POST(request: NextRequest) {
  const token = request.cookies.get('patient-token')?.value;
  if (!token) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const payload = verifyPatientToken(token);
  if (!payload) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
  }

  const body = (await request.json()) as {
    doctorId?: string;
    action?: 'grant' | 'revoke';
    appointmentDatetime?: string;
  };

  if (!body.doctorId || !body.action) {
    return NextResponse.json({ error: 'doctorId and action are required' }, { status: 400 });
  }

  const supabase = createServerClient();

  const { data: patient } = await supabase
    .from('patients')
    .select('id')
    .eq('phone_number', payload.phone)
    .single();

  if (!patient) {
    return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
  }

  if (body.action === 'grant') {
    const appointmentDate = body.appointmentDatetime
      ? new Date(body.appointmentDatetime)
      : new Date();
    const expiresAt = new Date(appointmentDate.getTime() + 7 * 24 * 60 * 60 * 1000);

    await supabase
      .from('history_consent')
      .upsert({
        patient_id: patient.id,
        doctor_id: body.doctorId,
        granted_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
        revoked_at: null,
      }, { onConflict: 'patient_id,doctor_id' });

    return NextResponse.json({ success: true, message: 'تم منح الإذن' });
  }

  if (body.action === 'revoke') {
    await supabase
      .from('history_consent')
      .update({ revoked_at: new Date().toISOString() })
      .eq('patient_id', patient.id)
      .eq('doctor_id', body.doctorId);

    return NextResponse.json({ success: true, message: 'تم إلغاء الإذن' });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
