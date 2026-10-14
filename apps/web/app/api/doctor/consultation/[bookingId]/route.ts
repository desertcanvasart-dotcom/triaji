import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

interface DoctorAccount {
  id: string;
  doctor_id: string;
  verification_status: 'pending' | 'verified' | 'rejected';
  last_login_at: string | null;
}

interface RouteContext {
  params: Promise<{ bookingId: string }>;
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

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const doctorAccount = await authenticateDoctor(request);

    if (!doctorAccount) {
      return NextResponse.json(
        { error: 'غير مصرح. يرجى تسجيل الدخول' },
        { status: 401 }
      );
    }

    const { bookingId } = await context.params;
    const supabase = getServiceClient();

    // Fetch booking and verify ownership
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      return NextResponse.json(
        { error: 'الحجز غير موجود' },
        { status: 404 }
      );
    }

    if (booking.doctor_id !== doctorAccount.doctor_id) {
      return NextResponse.json(
        { error: 'غير مصرح بالوصول لهذا الحجز' },
        { status: 403 }
      );
    }

    // Patient profile, patient info, session data, and consent are all
    // independent of each other — fetch in parallel. Only health records
    // depend on the consent result (below).
    const [
      { data: patientProfile },
      { data: patient },
      { data: summary },
      { data: messages },
      { data: consent },
    ] = await Promise.all([
      supabase
        .from('patient_profiles')
        .select('*')
        .eq('patient_id', booking.patient_id)
        .single(),
      supabase
        .from('patients')
        .select('id, phone_number, name_ar')
        .eq('id', booking.patient_id)
        .single(),
      booking.session_id
        ? supabase
            .from('session_summaries')
            .select('*')
            .eq('session_id', booking.session_id)
            .single()
        : Promise.resolve({ data: null }),
      booking.session_id
        ? supabase
            .from('session_messages')
            .select('content_ar, image_urls, created_at')
            .eq('session_id', booking.session_id)
            .not('image_urls', 'is', null)
            .order('created_at', { ascending: true })
        : Promise.resolve({ data: null }),
      supabase
        .from('history_consent')
        .select('id')
        .eq('patient_id', booking.patient_id)
        .eq('doctor_id', doctorAccount.doctor_id)
        .is('revoked_at', null)
        .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
        .limit(1)
        .single(),
    ]);

    const sessionSummary = summary;
    const triageImages = (messages ?? []).filter(
      (m: { image_urls: string[] | null }) => m.image_urls && m.image_urls.length > 0
    ) as { content_ar: string; image_urls: string[]; created_at: string }[];

    // Fetch health records only if consent exists
    let healthRecords: { id: string; record_type: string; title_ar: string; uploaded_at: string }[] = [];
    if (consent) {
      const { data: records } = await supabase
        .from('health_records')
        .select('id, record_type, title_ar:summary_ar, uploaded_at')
        .eq('patient_id', booking.patient_id)
        .order('uploaded_at', { ascending: false });

      healthRecords = (records ?? []) as { id: string; record_type: string; title_ar: string; uploaded_at: string }[];
    }

    // Current medications (structured profile, migration 031) — shown in the
    // summary and checked against anything the doctor prescribes.
    let patientMedications: { drug_name_ar: string; drug_name_en: string | null }[] = [];
    if (patientProfile?.id) {
      const { data: meds } = await supabase
        .from('patient_medications')
        .select('drug_name_ar, drug_name_en')
        .eq('patient_profile_id', patientProfile.id)
        .order('sort_order', { ascending: true });
      patientMedications = (meds ?? []) as typeof patientMedications;
    }

    // Earlier doctor notes on this patient's triage summaries. The doctor always
    // sees their own; other doctors' notes follow the same consent gate as the
    // health records above.
    let notesQuery = supabase
      .from('session_summaries')
      .select('doctor_notes_ar, doctor_notes_added_at, created_at, doctor_name_ar, doctor_id, session_id')
      .eq('patient_id', booking.patient_id)
      .not('doctor_notes_ar', 'is', null)
      .order('created_at', { ascending: false })
      .limit(5);
    if (booking.session_id) notesQuery = notesQuery.neq('session_id', booking.session_id);
    if (!consent) notesQuery = notesQuery.eq('doctor_id', doctorAccount.doctor_id);
    const { data: noteRows } = await notesQuery;
    const previousNotes = (
      (noteRows ?? []) as {
        doctor_notes_ar: string;
        doctor_notes_added_at: string | null;
        created_at: string;
        doctor_name_ar: string | null;
      }[]
    ).map((n) => ({
      note: n.doctor_notes_ar,
      date: (n.doctor_notes_added_at ?? n.created_at).slice(0, 10),
      doctor_name: n.doctor_name_ar ?? '',
    }));

    // The web consultation page reads `profile` / `summary` / `images` /
    // `hasConsent`; the original keys stay for any older client.
    const profile = patientProfile
      ? { ...patientProfile, chronic_conditions: patientProfile.chronic_conditions ?? [] }
      : null;
    const summaryOut = sessionSummary
      ? { ...sessionSummary, symptoms_ar: sessionSummary.symptoms_ar ?? [] }
      : null;

    return NextResponse.json({
      booking,
      patient,
      profile,
      summary: summaryOut,
      images: triageImages.flatMap((m) => m.image_urls),
      hasConsent: !!consent,
      patientProfile,
      sessionSummary,
      triageImages,
      healthRecords,
      hasHistoryConsent: !!consent,
      patientMedications,
      previousNotes,
    });
  } catch {
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}
