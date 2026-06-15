import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendPreAuthSubmittedNotification } from '@/lib/insurance/notifications';

export const dynamic = 'force-dynamic';

// ─── Auth helpers ───────────────────────────────────────────────────────────

interface DoctorAccount {
  id: string;
  doctor_id: string;
  verification_status: 'pending' | 'verified' | 'rejected';
  name_ar: string;
  name_en?: string;
  tenant_id?: string;
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

// ─── POST /api/provider/preauth/submit ──────────────────────────────────────
// Submit a pre-authorization request
export async function POST(request: NextRequest) {
  try {
    const doctorAccount = await authenticateDoctor(request);
    if (!doctorAccount) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();

    // Validate required fields
    const required = ['patient_id', 'policy_id', 'procedure_type', 'procedure_description_ar', 'estimated_cost_egp', 'clinical_justification_ar'];
    for (const field of required) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `${field} is required` },
          { status: 400 }
        );
      }
    }

    const supabase = getServiceClient();

    // Fetch the policy to get insurer info
    const { data: policy, error: policyError } = await supabase
      .from('patient_insurance_policies')
      .select('id, insurer_code, insurer_tenant_id, status, patient_id')
      .eq('id', body.policy_id)
      .eq('patient_id', body.patient_id)
      .eq('is_active', true)
      .single();

    if (policyError || !policy) {
      return NextResponse.json({ error: 'Policy not found for this patient' }, { status: 404 });
    }

    if (policy.status !== 'active') {
      return NextResponse.json(
        { error: `Policy status is '${policy.status}'. Must be 'active' to submit pre-auth.` },
        { status: 400 }
      );
    }

    // Get the doctor's tenant
    const { data: doctor } = await supabase
      .from('doctors')
      .select('id, tenant_id, name_ar, name_en')
      .eq('id', doctorAccount.doctor_id)
      .single();

    if (!doctor?.tenant_id) {
      return NextResponse.json({ error: 'Doctor tenant not found' }, { status: 400 });
    }

    const urgency = body.urgency ?? 'routine';
    const expectedResponseHours = urgency === 'urgent' ? 4 : 48;

    // Create pre-auth request
    const { data: preauth, error } = await supabase
      .from('pre_authorization_requests')
      .insert({
        patient_id: body.patient_id,
        policy_id: body.policy_id,
        insurer_tenant_id: policy.insurer_tenant_id,
        insurer_code: policy.insurer_code,
        requesting_tenant_id: doctor.tenant_id,
        requesting_doctor_id: doctorAccount.doctor_id,
        procedure_type: body.procedure_type,
        procedure_description_ar: body.procedure_description_ar,
        procedure_description_en: body.procedure_description_en ?? null,
        estimated_cost_egp: body.estimated_cost_egp,
        clinical_justification_ar: body.clinical_justification_ar,
        clinical_justification_en: body.clinical_justification_en ?? null,
        urgency,
        health_record_id: body.health_record_id ?? null,
        referral_id: body.referral_id ?? null,
        status: 'submitted',
        submitted_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Send WhatsApp notification to patient (fire-and-forget)
    const { data: patient } = await supabase
      .from('patients')
      .select('phone_number, preferred_language')
      .eq('id', body.patient_id)
      .single();

    if (patient?.phone_number) {
      sendPreAuthSubmittedNotification(
        patient.phone_number,
        patient.preferred_language ?? 'ar',
        {
          doctorNameAr: doctor.name_ar,
          doctorNameEn: doctor.name_en ?? undefined,
          procedureDescriptionAr: body.procedure_description_ar,
          procedureDescriptionEn: body.procedure_description_en ?? undefined,
          urgency,
          expectedResponseHours,
        }
      ).catch((err) => {
        console.error('[PreAuth] WhatsApp notification failed:', err);
      });
    }

    return NextResponse.json({ preauth }, { status: 201 });
  } catch (err) {
    console.error('[PreAuth Submit] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
