import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyPatientToken } from '@/lib/auth/patient-token';

export const dynamic = 'force-dynamic';

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

interface DoctorAccount {
  id: string;
  user_id: string;
  doctor_id: string;
  verification_status: 'pending' | 'verified' | 'rejected';
}

/**
 * POST /api/pharmacy/route-prescription
 * Route a prescription to a pharmacy. Doctor or patient auth.
 * Creates prescription_routing record.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = getServiceClient();

    // Authenticate: either doctor or patient
    let authenticatedAs: 'doctor' | 'patient' = 'patient';
    let authenticatedId: string | null = null;

    // Try doctor auth first
    const accessToken = request.cookies.get('sb-access-token')?.value
      ?? request.headers.get('Authorization')?.replace('Bearer ', '');

    if (accessToken) {
      const anonClient = getAnonClient();
      const { data: { user } } = await anonClient.auth.getUser(accessToken);

      if (user) {
        // Check if doctor
        const { data: doctorAccount } = await supabase
          .from('doctor_accounts')
          .select('id, doctor_id, verification_status')
          .eq('user_id', user.id)
          .single();

        if (doctorAccount && doctorAccount.verification_status === 'verified') {
          authenticatedAs = 'doctor';
          authenticatedId = (doctorAccount as DoctorAccount).doctor_id;
        }
      }
    }

    // Try patient token if no doctor auth
    if (!authenticatedId) {
      const patientToken = request.headers.get('X-Patient-Token');
      if (patientToken) {
        const payload = verifyPatientToken(patientToken);
        if (payload) {
          authenticatedAs = 'patient';
          authenticatedId = payload.patientId;
        }
      }
    }

    if (!authenticatedId) {
      return NextResponse.json(
        { error: 'Authentication required. Doctor or patient login needed.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      health_record_id, pharmacy_tenant_id, patient_name_ar, patient_phone,
      notes,
    } = body;

    if (!health_record_id || !pharmacy_tenant_id) {
      return NextResponse.json(
        { error: 'health_record_id and pharmacy_tenant_id are required' },
        { status: 400 }
      );
    }

    // Verify the pharmacy exists and is active
    const { data: pharmacy, error: pharmacyError } = await supabase
      .from('tenants')
      .select('id, name_ar, tier, is_active')
      .eq('id', pharmacy_tenant_id)
      .eq('tier', 'pharmacy')
      .eq('is_active', true)
      .single();

    if (pharmacyError || !pharmacy) {
      return NextResponse.json(
        { error: 'Pharmacy not found or inactive' },
        { status: 404 }
      );
    }

    // Verify the health record exists
    const { data: healthRecord, error: hrError } = await supabase
      .from('health_records')
      .select('id, patient_name_ar, patient_phone')
      .eq('id', health_record_id)
      .single();

    if (hrError || !healthRecord) {
      return NextResponse.json(
        { error: 'Health record not found' },
        { status: 404 }
      );
    }

    // Create prescription routing record
    const { data: routing, error: routingError } = await supabase
      .from('prescription_routing')
      .insert({
        health_record_id,
        pharmacy_tenant_id,
        patient_name_ar: patient_name_ar ?? healthRecord.patient_name_ar,
        patient_phone: patient_phone ?? healthRecord.patient_phone,
        status: 'routed',
        routed_at: new Date().toISOString(),
        routed_by: authenticatedAs,
        routed_by_id: authenticatedId,
        notes: notes ?? null,
      })
      .select()
      .single();

    if (routingError) {
      return NextResponse.json({ error: routingError.message }, { status: 500 });
    }

    return NextResponse.json({
      routing,
      message: 'Prescription routed successfully',
    }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
