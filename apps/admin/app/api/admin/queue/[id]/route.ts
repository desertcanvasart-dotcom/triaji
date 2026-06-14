import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin, requireClinicAccess, tenantScope } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';
import { sendCalledNotification } from '@/lib/clinic/queue-notifications';

export const dynamic = 'force-dynamic';

/** PUT /api/admin/queue/[id] — update queue entry status */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;
  const { admin } = authResult;
  const clinicCheck = requireClinicAccess(admin);
  if (clinicCheck) return clinicCheck;

  const { id } = await params;
  const supabase = createAdminClient();
  const tenant = tenantScope(admin);
  const body = await request.json();
  const { status, internal_notes } = body;

  if (!status) {
    return NextResponse.json({ error: 'status is required' }, { status: 400 });
  }

  // Fetch current entry
  let entryQuery = supabase.from('clinic_queue').select('*').eq('id', id);
  if (tenant) entryQuery = entryQuery.eq('tenant_id', tenant);
  const { data: entry, error: fetchError } = await entryQuery.single();

  if (fetchError || !entry) {
    return NextResponse.json({ error: 'Queue entry not found' }, { status: 404 });
  }

  // Build update object based on status transition
  const update: Record<string, unknown> = { status };

  if (internal_notes !== undefined) {
    update.internal_notes = internal_notes;
  }

  const now = new Date().toISOString();

  if (status === 'called') {
    update.called_at = now;
  } else if (status === 'completed') {
    update.completed_at = now;
    // Calculate actual wait time
    if (entry.called_at) {
      const calledAt = new Date(entry.called_at).getTime();
      const arrivedAt = new Date(entry.arrived_at).getTime();
      update.wait_minutes_actual = Math.round((calledAt - arrivedAt) / 60000);
    }
  } else if (['no_show', 'left', 'skipped'].includes(status)) {
    update.completed_at = now;
  }

  const { data: updated, error: updateError } = await supabase
    .from('clinic_queue')
    .update(update)
    .eq('id', id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Send WhatsApp when patient is called
  if (status === 'called' && entry.patient_phone) {
    try {
      // Get doctor + clinic info
      const [doctorRes, tenantRes, roomRes] = await Promise.all([
        supabase.from('doctors').select('name_ar, title_ar').eq('id', entry.doctor_id).single(),
        supabase.from('tenants').select('name_ar').eq('id', entry.tenant_id).single(),
        supabase.from('clinic_rooms').select('name_ar').eq('doctor_id', entry.doctor_id).eq('tenant_id', entry.tenant_id).eq('is_active', true).single(),
      ]);

      await sendCalledNotification(entry.patient_phone, roomRes.data?.name_ar ?? '');
    } catch {
      // Non-blocking
    }
  }

  return NextResponse.json({ entry: updated });
}
