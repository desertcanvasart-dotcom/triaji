import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// ─── Supabase helpers ───────────────────────────────────────────────────────

interface DoctorAccount {
  id: string;
  user_id: string;
  doctor_id: string;
  verification_status: 'pending' | 'verified' | 'rejected';
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
    .eq('user_id', user.id)
    .single();

  if (!doctorAccount || doctorAccount.verification_status !== 'verified') return null;
  return doctorAccount as DoctorAccount;
}

// ─── GET /api/doctor/patients/[id] ──────────────────────────────────────────
// Full patient detail for GP. Checks GP relationship or access grant.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const doctorAccount = await authenticateDoctor(request);
    if (!doctorAccount) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: patientId } = await params;
    if (!patientId) {
      return NextResponse.json({ error: 'Patient ID is required' }, { status: 400 });
    }

    const supabase = getServiceClient();

    // Check authorization: GP relationship OR active access grant
    const [gpCheck, grantCheck] = await Promise.all([
      supabase
        .from('gp_relationships')
        .select('id')
        .eq('doctor_account_id', doctorAccount.id)
        .eq('patient_id', patientId)
        .eq('status', 'active')
        .maybeSingle(),
      supabase
        .from('access_grants')
        .select('id, scope')
        .eq('doctor_account_id', doctorAccount.id)
        .eq('patient_id', patientId)
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle(),
    ]);

    const isGP = !!gpCheck.data;
    const hasGrant = !!grantCheck.data;

    if (!isGP && !hasGrant) {
      return NextResponse.json({ error: 'No access to this patient' }, { status: 403 });
    }

    // Fetch full patient data in parallel
    const [
      profileResult,
      vitalsResult,
      followUpsResult,
      labResultsResult,
      prescriptionsResult,
      enrollmentsResult,
      alertsResult,
      gpNotesResult,
      referralsResult,
    ] = await Promise.all([
      // 1. Full profile
      supabase
        .from('patient_profiles')
        .select(`
          *,
          patient_allergies(*),
          patient_chronic_conditions(*),
          patient_medications(*),
          patient_surgeries(*),
          patient_family_history(*)
        `)
        .eq('patient_id', patientId)
        .single(),

      // 2. Latest vitals
      supabase
        .from('vitals_history')
        .select('*')
        .eq('patient_id', patientId)
        .order('measured_at', { ascending: false })
        .limit(20),

      // 3. Follow-ups
      supabase
        .from('follow_up_schedule')
        .select('id, follow_up_date, reason_ar, reason_en, status, source, created_at')
        .eq('patient_id', patientId)
        .neq('status', 'cancelled')
        .order('follow_up_date', { ascending: true }),

      // 4. Lab results
      supabase
        .from('health_records')
        .select('id, lab_values, lab_date, lab_name, summary_ar, has_abnormal_values, created_at')
        .eq('patient_id', patientId)
        .eq('record_type', 'lab_result')
        .is('deleted_at', null)
        .order('lab_date', { ascending: false })
        .limit(20),

      // 5. Prescriptions
      supabase
        .from('health_records')
        .select(`
          id, document_number, prescription_date, prescribing_doctor, summary_ar,
          prescription_items(drug_name_ar, drug_name_en, dose, frequency_ar, duration_ar)
        `)
        .eq('patient_id', patientId)
        .eq('record_type', 'prescription')
        .is('deleted_at', null)
        .order('prescription_date', { ascending: false })
        .limit(20),

      // 6. Protocol enrollments
      supabase
        .from('patient_protocol_enrollment')
        .select('id, protocol_id, enrolled_at, status, compliance_pct, disease_protocols(name_ar, name_en, condition_code)')
        .eq('patient_id', patientId)
        .eq('status', 'active'),

      // 7. Protocol alerts
      supabase
        .from('protocol_alerts')
        .select('id, alert_type, severity, message_ar, message_en, created_at, resolved_at')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
        .limit(50),

      // 8. GP notes
      supabase
        .from('gp_notes')
        .select('id, note_ar, note_en, created_at, doctor_account_id')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
        .limit(50),

      // 9. Referrals
      supabase
        .from('referrals')
        .select('id, referred_to_specialty_ar, referred_to_specialty_en, reason_ar, reason_en, status, created_at')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    const profile = profileResult.data;

    // Patient basic info
    const { data: patientInfo } = await supabase
      .from('patients')
      .select('phone_number, name_ar, name_en, date_of_birth, preferred_language')
      .eq('id', patientId)
      .single();

    return NextResponse.json({
      patient: {
        id: patientId,
        phone: patientInfo?.phone_number ?? '',
        nameAr: patientInfo?.name_ar ?? null,
        nameEn: patientInfo?.name_en ?? null,
        dateOfBirth: patientInfo?.date_of_birth ?? null,
        preferredLanguage: patientInfo?.preferred_language ?? 'ar',
      },
      accessType: isGP ? 'gp' : 'grant',
      grantScope: grantCheck.data?.scope ?? null,
      profile: profile
        ? {
            base: {
              age: profile.age,
              biological_sex: profile.biological_sex,
              height_cm: profile.height_cm,
              weight_kg: profile.weight_kg,
              bmi: profile.bmi,
              smoking_status: profile.smoking_status,
              blood_pressure: profile.blood_pressure,
              diabetes_type: profile.diabetes_type,
              diabetes_control: profile.diabetes_control,
              heart_condition: profile.heart_condition,
              kidney_disease: profile.kidney_disease,
              liver_disease: profile.liver_disease,
              risk_level: profile.risk_level,
              background_risk_score: profile.background_risk_score,
            },
            allergies: profile.patient_allergies ?? [],
            chronicConditions: profile.patient_chronic_conditions ?? [],
            medications: profile.patient_medications ?? [],
            surgeries: profile.patient_surgeries ?? [],
            familyHistory: profile.patient_family_history ?? [],
          }
        : null,
      vitals: vitalsResult.data ?? [],
      followUps: followUpsResult.data ?? [],
      labResults: (labResultsResult.data ?? []).map((lr: Record<string, unknown>) => ({
        id: lr.id,
        labDate: lr.lab_date,
        labName: lr.lab_name,
        values: lr.lab_values,
        summaryAr: lr.summary_ar,
        hasAbnormal: lr.has_abnormal_values,
      })),
      prescriptions: prescriptionsResult.data ?? [],
      protocols: (enrollmentsResult.data ?? []).map((e: Record<string, unknown>) => {
        const proto = Array.isArray(e.disease_protocols) ? e.disease_protocols[0] : e.disease_protocols;
        return {
          id: e.id,
          protocolId: e.protocol_id,
          enrolledAt: e.enrolled_at,
          compliancePct: e.compliance_pct,
          nameAr: proto?.name_ar ?? null,
          nameEn: proto?.name_en ?? null,
          conditionCode: proto?.condition_code ?? null,
        };
      }),
      alerts: (alertsResult.data ?? []).map((a: Record<string, unknown>) => ({
        id: a.id,
        alertType: a.alert_type,
        severity: a.severity,
        messageAr: a.message_ar,
        messageEn: a.message_en,
        createdAt: a.created_at,
        resolvedAt: a.resolved_at,
      })),
      gpNotes: gpNotesResult.data ?? [],
      referrals: referralsResult.data ?? [],
    });
  } catch (err) {
    console.error('[doctor/patients/[id]] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
