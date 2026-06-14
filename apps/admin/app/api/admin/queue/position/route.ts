import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { estimateWaitMinutes } from '@/lib/clinic/estimate-wait';

export const dynamic = 'force-dynamic';

/** GET /api/admin/queue/position — PUBLIC (no auth) — patient checks own position */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const phone = searchParams.get('phone');
  const tenantId = searchParams.get('tenantId');
  const doctorId = searchParams.get('doctorId');

  if (!phone || !tenantId || !doctorId) {
    return NextResponse.json(
      { error: 'phone, tenantId, and doctorId are required' },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const today = new Date().toISOString().split('T')[0];

  // Find patient's queue entry
  const { data: entry, error } = await supabase
    .from('clinic_queue')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('doctor_id', doctorId)
    .eq('queue_date', today)
    .eq('patient_phone', phone)
    .in('status', ['waiting', 'called'])
    .order('queue_number', { ascending: false })
    .limit(1)
    .single();

  if (error || !entry) {
    return NextResponse.json(
      { error: 'Queue entry not found', message: 'لم يتم العثور على دور في الانتظار' },
      { status: 404 }
    );
  }

  // Count waiting entries ahead
  const { count } = await supabase
    .from('clinic_queue')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('doctor_id', doctorId)
    .eq('queue_date', today)
    .eq('status', 'waiting')
    .lt('queue_number', entry.queue_number);

  // Get minutes per patient from tenant config
  const { data: config } = await supabase
    .from('tenant_config')
    .select('estimated_minutes_per_patient')
    .eq('tenant_id', tenantId)
    .single();

  const minutesPerPatient = config?.estimated_minutes_per_patient ?? 15;
  const position = count ?? 0;

  return NextResponse.json({
    queueNumber: entry.queue_number,
    position,
    estimatedWaitMinutes: entry.status === 'called' ? 0 : estimateWaitMinutes(position, minutesPerPatient),
    status: entry.status,
  });
}
