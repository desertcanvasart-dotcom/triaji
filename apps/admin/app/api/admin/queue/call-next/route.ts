import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin, requireClinicAccess, tenantScope } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';
import { sendCalledNotification, sendAlmostNextNotification } from '@/lib/clinic/queue-notifications';

export const dynamic = 'force-dynamic';

/** POST /api/admin/queue/call-next — call the next waiting patient */
export async function POST(request: NextRequest) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;
  const { admin } = authResult;
  const clinicCheck = requireClinicAccess(admin);
  if (clinicCheck) return clinicCheck;

  const supabase = createAdminClient();
  const tenant = tenantScope(admin);
  const body = await request.json();
  const { doctor_id } = body;

  if (!doctor_id) {
    return NextResponse.json({ error: 'doctor_id is required' }, { status: 400 });
  }

  const today = new Date().toISOString().split('T')[0];

  // Find next waiting patient (lowest queue_number with status 'waiting')
  let query = supabase
    .from('clinic_queue')
    .select('*')
    .eq('doctor_id', doctor_id)
    .eq('queue_date', today)
    .eq('status', 'waiting')
    .order('queue_number', { ascending: true })
    .limit(2); // Get 2: the one to call + the next one for "almost next"

  if (tenant) query = query.eq('tenant_id', tenant);

  const { data: waiting, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!waiting || waiting.length === 0) {
    return NextResponse.json({ error: 'No waiting patients', message: 'لا يوجد مرضى في الانتظار' }, { status: 404 });
  }

  const calledEntry = waiting[0];
  const nextInLine = waiting.length > 1 ? waiting[1] : null;

  // Update called entry
  const { data: updated, error: updateError } = await supabase
    .from('clinic_queue')
    .update({ status: 'called', called_at: new Date().toISOString() })
    .eq('id', calledEntry.id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Get doctor + clinic info for notifications
  const [doctorRes, tenantRes, roomRes] = await Promise.all([
    supabase.from('doctors').select('name_ar, title_ar').eq('id', doctor_id).single(),
    supabase.from('tenants').select('name_ar').eq('id', calledEntry.tenant_id).single(),
    supabase.from('clinic_rooms').select('name_ar').eq('doctor_id', doctor_id).eq('tenant_id', calledEntry.tenant_id).eq('is_active', true).single(),
  ]);

  const doctorName = doctorRes.data?.name_ar ?? '';
  const doctorTitle = doctorRes.data?.title_ar ?? 'د.';
  const clinicName = tenantRes.data?.name_ar ?? '';
  const roomInfo = roomRes.data?.name_ar ?? '';

  // Send "called" notification to the called patient
  if (calledEntry.patient_phone) {
    try {
      await sendCalledNotification(calledEntry.patient_phone, roomInfo);
    } catch {
      // Non-blocking
    }
  }

  // Send "almost next" notification to the 2nd-in-line patient
  if (nextInLine?.patient_phone) {
    try {
      // Count how many are still waiting ahead of nextInLine
      const { count } = await supabase
        .from('clinic_queue')
        .select('*', { count: 'exact', head: true })
        .eq('doctor_id', doctor_id)
        .eq('queue_date', today)
        .eq('status', 'waiting')
        .lt('queue_number', nextInLine.queue_number);

      if ((count ?? 0) <= 2) {
        await sendAlmostNextNotification(nextInLine.patient_phone);
      }
    } catch {
      // Non-blocking
    }
  }

  return NextResponse.json({ entry: updated });
}
