import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface DoctorAccount {
  id: string;
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
    .eq('id', user.id)
    .single();

  if (!doctorAccount || doctorAccount.verification_status !== 'verified') return null;
  return doctorAccount as DoctorAccount;
}

// ─── POST /api/lab/route-order ──────────────────────────────────────────────
// Doctor routes a lab/imaging order to a specific lab tenant

interface RouteOrderBody {
  health_record_id: string;
  lab_tenant_id: string;
  is_urgent?: boolean;
  routing_note_ar?: string;
}

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate doctor
    const doctorAccount = await authenticateDoctor(request);
    if (!doctorAccount) {
      return NextResponse.json(
        { error: 'غير مصرح. يرجى تسجيل الدخول كطبيب' },
        { status: 401 }
      );
    }

    const body = (await request.json()) as RouteOrderBody;

    // Validate required fields
    if (!body.health_record_id || !body.lab_tenant_id) {
      return NextResponse.json(
        { error: 'health_record_id and lab_tenant_id are required' },
        { status: 400 }
      );
    }

    const supabase = getServiceClient();

    // 2. Verify the health_record belongs to a patient this doctor has treated
    //    (health_record is linked through a triage_session or booking with this doctor)
    const { data: healthRecord, error: hrError } = await supabase
      .from('health_records')
      .select('id, patient_id, record_type')
      .eq('id', body.health_record_id)
      .is('deleted_at', null)
      .single();

    if (hrError || !healthRecord) {
      return NextResponse.json(
        { error: 'السجل الصحي غير موجود' },
        { status: 404 }
      );
    }

    // Verify doctor has a booking/relationship with this patient
    const { data: booking } = await supabase
      .from('bookings')
      .select('id')
      .eq('doctor_id', doctorAccount.doctor_id)
      .eq('patient_id', healthRecord.patient_id)
      .limit(1)
      .single();

    if (!booking) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية لهذا السجل' },
        { status: 403 }
      );
    }

    // 3. Verify the target lab tenant exists and is active
    const { data: labTenant } = await supabase
      .from('tenants')
      .select('id, tier')
      .eq('id', body.lab_tenant_id)
      .in('tier', ['lab', 'radiology'])
      .eq('is_active', true)
      .single();

    if (!labTenant) {
      return NextResponse.json(
        { error: 'المعمل/مركز الأشعة غير موجود أو غير نشط' },
        { status: 404 }
      );
    }

    // 4. Create lab_order_routing record
    const { data: routing, error: routingError } = await supabase
      .from('lab_order_routing')
      .insert({
        health_record_id: body.health_record_id,
        lab_tenant_id: body.lab_tenant_id,
        doctor_id: doctorAccount.doctor_id,
        doctor_account_id: doctorAccount.id,
        patient_id: healthRecord.patient_id,
        is_urgent: body.is_urgent ?? false,
        status: 'routed',
        routed_at: new Date().toISOString(),
        routing_note_ar: body.routing_note_ar ?? null,
      })
      .select('*')
      .single();

    if (routingError || !routing) {
      return NextResponse.json(
        { error: routingError?.message ?? 'فشل في توجيه الطلب' },
        { status: 500 }
      );
    }

    return NextResponse.json({ routing });
  } catch {
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}
