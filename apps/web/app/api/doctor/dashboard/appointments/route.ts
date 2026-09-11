import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

interface DoctorAccount {
  id: string;
  doctor_id: string;
  name_ar: string | null;
  verification_status: 'pending' | 'verified' | 'rejected';
  last_login_at: string | null;
}

// Shapes of the nested rows PostgREST returns for the bookings select below.
interface PatientRow { phone_number: string | null; name_ar: string | null }
interface SummaryRow { chief_complaint_ar: string | null; urgency_level: 'routine' | 'urgent' | 'emergency' | null }
interface SessionRow { session_summaries: SummaryRow | SummaryRow[] | null }
interface BookingRow {
  id: string;
  appointment_datetime: string;
  appointment_type: 'in_person' | 'telehealth' | null;
  patients: PatientRow | PatientRow[] | null;
  triage_sessions: SessionRow | SessionRow[] | null;
}

/** PostgREST returns embedded relations as an object or a single-element array. */
function first<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
}

function getServiceClient() {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function getAnonClient() {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function authenticateDoctor(request: NextRequest): Promise<DoctorAccount | null> {
  const accessToken = request.cookies.get('sb-access-token')?.value
    ?? request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!accessToken) return null;

  const anonClient = getAnonClient();
  const { data: { user }, error } = await anonClient.auth.getUser(accessToken);
  if (error || !user) return null;

  const supabase = getServiceClient();
  const { data: doctorAccount } = await supabase
    .from('doctor_accounts')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!doctorAccount || doctorAccount.verification_status !== 'verified') return null;
  return doctorAccount as DoctorAccount;
}

export async function GET(request: NextRequest) {
  try {
    const doctorAccount = await authenticateDoctor(request);

    if (!doctorAccount) {
      return NextResponse.json(
        { error: 'غير مصرح. يرجى تسجيل الدخول' },
        { status: 401 }
      );
    }

    const supabase = getServiceClient();
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    // bookings.session_id and triage_sessions.booking_id both relate these two
    // tables, so the embed names the one meant here: the session that led to
    // the booking.
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select(`
        id,
        appointment_datetime,
        appointment_type,
        status,
        patients!inner(phone_number, name_ar),
        triage_sessions!session_id(
          session_summaries(chief_complaint_ar, urgency_level, specialty_name_ar)
        )
      `)
      .eq('doctor_id', doctorAccount.doctor_id)
      .in('status', ['confirmed', 'pending'])
      .gte('appointment_datetime', twoHoursAgo)
      .order('appointment_datetime', { ascending: true })
      .limit(50);

    if (bookingsError) {
      return NextResponse.json(
        { error: 'فشل في جلب المواعيد' },
        { status: 500 }
      );
    }

    // Open (unbooked, future) availability slots — so the dashboard can reflect
    // that the doctor is bookable even before any patient has booked.
    const { count: openSlots } = await supabase
      .from('doctor_availability')
      .select('*', { count: 'exact', head: true })
      .eq('doctor_id', doctorAccount.doctor_id)
      .eq('is_booked', false)
      .gte('slot_datetime', new Date().toISOString());

    // Map to the shape the dashboard page consumes (appointments + doctor name).
    const appointments = ((bookings ?? []) as unknown as BookingRow[]).map((b) => {
      const patient = first(b.patients);
      const summary = first(first(b.triage_sessions)?.session_summaries ?? null);
      return {
        id: b.id,
        booking_id: b.id,
        appointment_datetime: b.appointment_datetime,
        appointment_type: b.appointment_type ?? 'in_person',
        patient_phone: patient?.phone_number ?? '',
        patient_name_ar: patient?.name_ar ?? null,
        chief_complaint_ar: summary?.chief_complaint_ar ?? null,
        urgency_level: summary?.urgency_level ?? 'routine',
      };
    });

    return NextResponse.json({
      appointments,
      open_slots_count: openSlots ?? 0,
      doctor_name_ar: doctorAccount.name_ar ?? '',
      doctor_account_id: doctorAccount.id,
    });
  } catch {
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}
