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

// ─── GET /api/doctor/patients ───────────────────────────────────────────────
// GP's patient panel. Returns all patients where gp_relationships.status='active'
// AND doctor_account_id matches. Joins patient info + latest vitals + protocol enrollment.
export async function GET(request: NextRequest) {
  try {
    const doctorAccount = await authenticateDoctor(request);
    if (!doctorAccount) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getServiceClient();

    // Fetch active GP relationships for this doctor
    const { data: relationships, error: relError } = await supabase
      .from('gp_relationships')
      .select(`
        id, patient_id, status, requested_at, confirmed_at,
        patients!inner(
          id, phone_number, name_ar,
          patient_profiles(age, bmi, date_of_birth, biological_sex, blood_pressure, diabetes_type, risk_level, background_risk_score)
        )
      `)
      .eq('doctor_account_id', doctorAccount.id)
      .eq('status', 'active')
      .order('requested_at', { ascending: false });

    if (relError) {
      console.error('[doctor/patients] Query error:', relError.message);
      return NextResponse.json({ error: 'Failed to fetch patients' }, { status: 500 });
    }

    if (!relationships || relationships.length === 0) {
      return NextResponse.json({
        patients: [],
        stats: { total: 0, needsAttention: 0, overdueFollowUps: 0 },
      });
    }

    const patientIds = relationships.map((r: Record<string, unknown>) => r.patient_id as string);

    // Fetch protocol enrollments and alerts in parallel
    const [enrollmentsResult, alertsResult, followUpsResult] = await Promise.all([
      supabase
        .from('patient_protocol_enrollment')
        .select('patient_id, protocol_id, enrolled_at, is_active, disease_protocols(name_ar, name_en, condition_code)')
        .in('patient_id', patientIds)
        .eq('is_active', true),

      supabase
        .from('protocol_alerts')
        .select('patient_id, alert_type, severity, message_ar, message_en, created_at, resolved_at')
        .in('patient_id', patientIds)
        .is('resolved_at', null)
        .order('created_at', { ascending: false }),

      supabase
        .from('follow_up_schedule')
        .select('patient_id, status')
        .in('patient_id', patientIds)
        .eq('status', 'overdue'),
    ]);

    // Build maps
    const enrollmentsByPatient = new Map<string, unknown[]>();
    for (const e of enrollmentsResult.data ?? []) {
      const pid = (e as Record<string, unknown>).patient_id as string;
      if (!enrollmentsByPatient.has(pid)) enrollmentsByPatient.set(pid, []);
      enrollmentsByPatient.get(pid)!.push(e);
    }

    const alertsByPatient = new Map<string, unknown[]>();
    for (const a of alertsResult.data ?? []) {
      const pid = (a as Record<string, unknown>).patient_id as string;
      if (!alertsByPatient.has(pid)) alertsByPatient.set(pid, []);
      alertsByPatient.get(pid)!.push(a);
    }

    const overdueByPatient = new Map<string, number>();
    for (const f of followUpsResult.data ?? []) {
      const pid = (f as Record<string, unknown>).patient_id as string;
      overdueByPatient.set(pid, (overdueByPatient.get(pid) ?? 0) + 1);
    }

    // Build patient list
    let needsAttentionCount = 0;
    let overdueFollowUpsTotal = 0;

    const patients = relationships.map((rel: Record<string, unknown>) => {
      const pat = Array.isArray(rel.patients) ? rel.patients[0] : rel.patients;
      const profile = pat?.patient_profiles
        ? (Array.isArray(pat.patient_profiles) ? pat.patient_profiles[0] : pat.patient_profiles)
        : null;
      const pid = rel.patient_id as string;

      const alerts = alertsByPatient.get(pid) ?? [];
      const overdue = overdueByPatient.get(pid) ?? 0;
      const hasAttentionNeeded = alerts.length > 0 || overdue > 0;

      if (hasAttentionNeeded) needsAttentionCount++;
      overdueFollowUpsTotal += overdue;

      return {
        id: pid,
        relationshipId: rel.id,
        assignedAt: rel.confirmed_at ?? rel.requested_at,
        nameAr: pat?.name_ar ?? null,
        nameEn: null,
        phone: pat?.phone_number ?? '',
        dateOfBirth: profile?.date_of_birth ?? null,
        biologicalSex: profile?.biological_sex ?? null,
        profile: profile
          ? {
              age: profile.age,
              bmi: profile.bmi,
              bloodPressure: profile.blood_pressure,
              diabetesType: profile.diabetes_type,
              riskLevel: profile.risk_level,
              brs: profile.background_risk_score,
            }
          : null,
        protocols: ((enrollmentsByPatient.get(pid) ?? []) as Record<string, unknown>[]).map((e) => {
          const proto = Array.isArray(e.disease_protocols) ? e.disease_protocols[0] : e.disease_protocols;
          return {
            protocolId: e.protocol_id,
            enrolledAt: e.enrolled_at,
            nameAr: proto?.name_ar ?? null,
            nameEn: proto?.name_en ?? null,
            conditionCode: proto?.condition_code ?? null,
          };
        }),
        unresolvedAlerts: alerts.length,
        overdueFollowUps: overdue,
        needsAttention: hasAttentionNeeded,
      };
    });

    return NextResponse.json({
      patients,
      stats: {
        total: patients.length,
        needsAttention: needsAttentionCount,
        overdueFollowUps: overdueFollowUpsTotal,
      },
    });
  } catch (err) {
    console.error('[doctor/patients] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
