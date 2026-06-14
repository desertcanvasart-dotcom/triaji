import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// ─── Types ──────────────────────────────────────────────────────────────────

interface DoctorAccount {
  id: string;
  user_id: string;
  doctor_id: string;
  verification_status: 'pending' | 'verified' | 'rejected';
  name_ar: string;
}

interface SchoolHealthBody {
  patient_id: string;
  academic_year: string;
  school_name_ar: string;
  school_grade_ar: string;
  exam_date?: string;
  height_cm?: number;
  weight_kg?: number;
  vision_right?: string;
  vision_left?: string;
  hearing_normal?: boolean;
  dental_notes_ar?: string;
  general_notes_ar?: string;
  fit_for_school: boolean;
  restriction_ar?: string;
}

// ─── Auth helpers ───────────────────────────────────────────────────────────

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
    .eq('user_id', user.id)
    .single();

  if (!doctorAccount || doctorAccount.verification_status !== 'verified') return null;
  return doctorAccount as DoctorAccount;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function calculateAgeMonths(dateOfBirth: string): number {
  const dob = new Date(dateOfBirth);
  const now = new Date();
  return (now.getFullYear() - dob.getFullYear()) * 12 + (now.getMonth() - dob.getMonth());
}

function calculateBMI(weightKg: number, heightCm: number): number | null {
  if (heightCm <= 0) return null;
  const heightM = heightCm / 100;
  return Math.round((weightKg / (heightM * heightM)) * 10) / 10;
}

// ─── POST /api/doctor/school-health ─────────────────────────────────────────
// Doctor creates a school health record for a paediatric patient.
export async function POST(request: NextRequest) {
  try {
    const doctorAccount = await authenticateDoctor(request);
    if (!doctorAccount) {
      return NextResponse.json({ error: 'غير مصرح. يرجى تسجيل الدخول' }, { status: 401 });
    }

    const body = (await request.json()) as SchoolHealthBody;

    // Validate required fields
    if (!body.patient_id || !body.academic_year || !body.school_name_ar || !body.school_grade_ar) {
      return NextResponse.json(
        { error: 'patient_id, academic_year, school_name_ar, and school_grade_ar are required' },
        { status: 400 }
      );
    }

    if (body.fit_for_school === undefined || body.fit_for_school === null) {
      return NextResponse.json(
        { error: 'fit_for_school is required' },
        { status: 400 }
      );
    }

    const supabase = getServiceClient();

    // Check patient exists and is paediatric
    const { data: patient } = await supabase
      .from('patient_profiles')
      .select('id, patient_id, date_of_birth, is_paediatric')
      .eq('patient_id', body.patient_id)
      .single();

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
    }

    if (!patient.is_paediatric) {
      return NextResponse.json({ error: 'Patient is not a paediatric patient' }, { status: 400 });
    }

    // Create the school health record
    const { data: record, error: insertError } = await supabase
      .from('school_health_records')
      .insert({
        patient_id: body.patient_id,
        academic_year: body.academic_year,
        school_name_ar: body.school_name_ar,
        school_grade_ar: body.school_grade_ar,
        exam_date: body.exam_date ?? new Date().toISOString().split('T')[0],
        examining_doctor: doctorAccount.doctor_id,
        height_cm: body.height_cm ?? null,
        weight_kg: body.weight_kg ?? null,
        vision_right: body.vision_right ?? null,
        vision_left: body.vision_left ?? null,
        hearing_normal: body.hearing_normal ?? null,
        dental_notes_ar: body.dental_notes_ar ?? null,
        general_notes_ar: body.general_notes_ar ?? null,
        fit_for_school: body.fit_for_school,
        restriction_ar: body.restriction_ar ?? null,
        certificate_issued: false,
      })
      .select()
      .single();

    if (insertError || !record) {
      console.error('school-health insert error:', insertError);
      return NextResponse.json(
        { error: 'Failed to create school health record' },
        { status: 500 }
      );
    }

    // If height/weight provided, also create a growth_measurements entry
    if (body.height_cm || body.weight_kg) {
      const ageMonths = calculateAgeMonths(patient.date_of_birth);
      const bmi = (body.weight_kg && body.height_cm)
        ? calculateBMI(body.weight_kg, body.height_cm)
        : null;

      await supabase
        .from('growth_measurements')
        .insert({
          patient_id: body.patient_id,
          measured_at: body.exam_date ?? new Date().toISOString().split('T')[0],
          age_months: ageMonths,
          weight_kg: body.weight_kg ?? null,
          height_cm: body.height_cm ?? null,
          head_circ_cm: null,
          bmi,
          source: 'school_health_exam',
          measured_by_doctor: doctorAccount.doctor_id,
          notes_ar: `كشف صحة مدرسية — ${body.school_name_ar} — ${body.academic_year}`,
        });
    }

    return NextResponse.json(record, { status: 201 });
  } catch (err) {
    console.error('POST /api/doctor/school-health error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── GET /api/doctor/school-health?patient_id=xxx ───────────────────────────
// Returns all school health records for a patient.
export async function GET(request: NextRequest) {
  try {
    const doctorAccount = await authenticateDoctor(request);
    if (!doctorAccount) {
      return NextResponse.json({ error: 'غير مصرح. يرجى تسجيل الدخول' }, { status: 401 });
    }

    const patientId = request.nextUrl.searchParams.get('patient_id');
    if (!patientId) {
      return NextResponse.json({ error: 'patient_id is required' }, { status: 400 });
    }

    const supabase = getServiceClient();

    const { data: records, error } = await supabase
      .from('school_health_records')
      .select('*')
      .eq('patient_id', patientId)
      .order('exam_date', { ascending: false });

    if (error) {
      console.error('school-health GET error:', error);
      return NextResponse.json({ error: 'Failed to fetch records' }, { status: 500 });
    }

    return NextResponse.json(records ?? []);
  } catch (err) {
    console.error('GET /api/doctor/school-health error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
