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

// ─── GET /api/doctor/patients/[id]/alerts ───────────────────────────────────
// Protocol alerts for a specific patient. Auth: doctor (GP).
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

    // Verify GP relationship
    const { data: gpRel } = await supabase
      .from('gp_relationships')
      .select('id')
      .eq('doctor_account_id', doctorAccount.id)
      .eq('patient_id', patientId)
      .eq('status', 'active')
      .maybeSingle();

    if (!gpRel) {
      return NextResponse.json({ error: 'No GP relationship with this patient' }, { status: 403 });
    }

    // Fetch protocol alerts
    const { data: alerts, error: alertsError } = await supabase
      .from('protocol_alerts')
      .select(`
        id, alert_type, severity, message_ar, message_en,
        threshold_value, actual_value, unit,
        created_at, resolved_at, resolved_by,
        patient_protocol_enrollment(
          disease_protocols(name_ar, name_en, condition_code)
        )
      `)
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (alertsError) {
      console.error('[doctor/patients/alerts] Query error:', alertsError.message);
      return NextResponse.json({ error: 'Failed to fetch alerts' }, { status: 500 });
    }

    const unresolved = (alerts ?? []).filter((a: Record<string, unknown>) => !a.resolved_at);
    const resolved = (alerts ?? []).filter((a: Record<string, unknown>) => !!a.resolved_at);

    return NextResponse.json({
      unresolved: unresolved.map(formatAlert),
      resolved: resolved.map(formatAlert),
      total: alerts?.length ?? 0,
      unresolvedCount: unresolved.length,
    });
  } catch (err) {
    console.error('[doctor/patients/alerts] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function formatAlert(a: Record<string, unknown>) {
  const enrollment = Array.isArray(a.patient_protocol_enrollment)
    ? a.patient_protocol_enrollment[0]
    : a.patient_protocol_enrollment;
  const protocol = enrollment?.disease_protocols
    ? (Array.isArray(enrollment.disease_protocols) ? enrollment.disease_protocols[0] : enrollment.disease_protocols)
    : null;

  return {
    id: a.id,
    alertType: a.alert_type,
    severity: a.severity,
    messageAr: a.message_ar,
    messageEn: a.message_en,
    thresholdValue: a.threshold_value,
    actualValue: a.actual_value,
    unit: a.unit,
    createdAt: a.created_at,
    resolvedAt: a.resolved_at,
    resolvedBy: a.resolved_by,
    protocol: protocol
      ? { nameAr: protocol.name_ar, nameEn: protocol.name_en, conditionCode: protocol.condition_code }
      : null,
  };
}
