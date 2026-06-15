import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// ─── Auth helpers ───────────────────────────────────────────────────────────

interface DoctorAccount {
  id: string;
  doctor_id: string;
  verification_status: 'pending' | 'verified' | 'rejected';
  name_ar: string;
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

// ─── GET /api/provider/preauth/[id] ─────────────────────────────────────────
// Check pre-authorization request status
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const doctorAccount = await authenticateDoctor(request);
    if (!doctorAccount) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id } = await params;
    const supabase = getServiceClient();

    // Get the doctor's tenant
    const { data: doctor } = await supabase
      .from('doctors')
      .select('id, tenant_id')
      .eq('id', doctorAccount.doctor_id)
      .single();

    if (!doctor?.tenant_id) {
      return NextResponse.json({ error: 'Doctor tenant not found' }, { status: 400 });
    }

    const { data: preauth, error } = await supabase
      .from('pre_authorization_requests')
      .select(`
        id,
        patient_id,
        policy_id,
        insurer_code,
        procedure_type,
        procedure_description_ar,
        procedure_description_en,
        estimated_cost_egp,
        clinical_justification_ar,
        urgency,
        status,
        submitted_at,
        reviewed_at,
        approved_amount_egp,
        approval_conditions_ar,
        denial_reason_ar,
        denial_code,
        preauth_reference,
        valid_from,
        valid_until,
        appeal_submitted_at,
        appeal_reason_ar,
        appeal_status,
        created_at
      `)
      .eq('id', id)
      .eq('requesting_tenant_id', doctor.tenant_id)
      .single();

    if (error || !preauth) {
      return NextResponse.json({ error: 'Pre-authorization request not found' }, { status: 404 });
    }

    // Enrich with insurer info
    const { data: insurer } = await supabase
      .from('insurance_providers')
      .select('code, name_ar, name_en')
      .eq('code', preauth.insurer_code)
      .single();

    return NextResponse.json({
      preauth: {
        ...preauth,
        insurer: insurer ?? null,
      },
    });
  } catch (err) {
    console.error('[PreAuth Status] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
