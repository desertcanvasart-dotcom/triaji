import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin, requireIcuAccess, tenantScope } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** PUT /api/admin/icu/transfers/[id] — update transfer status */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;
  const { admin } = authResult;
  const icuCheck = requireIcuAccess(admin);
  if (icuCheck) return icuCheck;

  const supabase = createAdminClient();
  const tenant = tenantScope(admin);
  const { id } = await params;
  const body = await request.json();

  const { action } = body;

  if (!action || !['acknowledge', 'accept', 'decline'].includes(action)) {
    return NextResponse.json(
      { error: 'action must be one of: acknowledge, accept, decline' },
      { status: 400 }
    );
  }

  // Fetch the transfer request
  let transferQuery = supabase
    .from('icu_transfer_requests')
    .select('*, icu_unit:icu_units(*)')
    .eq('id', id);

  if (tenant) transferQuery = transferQuery.eq('receiving_tenant_id', tenant);

  const { data: transfer, error: transferError } = await transferQuery.single();

  if (transferError || !transfer) {
    return NextResponse.json(
      { error: 'Transfer request not found' },
      { status: 404 }
    );
  }

  const now = new Date().toISOString();

  if (action === 'acknowledge') {
    const { data, error } = await supabase
      .from('icu_transfer_requests')
      .update({
        status: 'acknowledged',
        acknowledged_at: now,
        acknowledged_by: admin.id,
        updated_at: now,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ transfer: data });
  }

  if (action === 'accept') {
    const { bed_assigned_ar, receiving_contact_phone } = body;

    if (!bed_assigned_ar || !receiving_contact_phone) {
      return NextResponse.json(
        { error: 'bed_assigned_ar and receiving_contact_phone are required for acceptance' },
        { status: 400 }
      );
    }

    // 1. Update transfer status
    const { data: updatedTransfer, error: updateError } = await supabase
      .from('icu_transfer_requests')
      .update({
        status: 'accepted',
        accepted_at: now,
        accepted_by: admin.id,
        bed_assigned_ar,
        receiving_contact_phone,
        updated_at: now,
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // 2. Decrement available_beds on the ICU unit
    const unitId = transfer.icu_unit_id;
    if (unitId) {
      const { data: unit } = await supabase
        .from('icu_units')
        .select('available_beds')
        .eq('id', unitId)
        .single();

      if (unit && unit.available_beds > 0) {
        const newAvailable = unit.available_beds - 1;

        await supabase
          .from('icu_units')
          .update({
            available_beds: newAvailable,
            last_updated_by: admin.id,
            updated_at: now,
          })
          .eq('id', unitId);

        // 3. Log to icu_availability_log
        await supabase
          .from('icu_availability_log')
          .insert({
            icu_unit_id: unitId,
            tenant_id: transfer.receiving_tenant_id,
            previous_available: unit.available_beds,
            new_available: newAvailable,
            change_reason: 'patient_transferred_in',
            transfer_request_id: id,
            updated_by: admin.id,
          });
      }
    }

    // 4. Send WhatsApp notification to requesting doctor (placeholder)
    console.log(
      `[ICU Transfer Accepted] Transfer ${id} accepted. ` +
      `Bed: ${bed_assigned_ar}. Contact: ${receiving_contact_phone}. ` +
      `Requesting doctor phone: ${transfer.requesting_doctor_phone ?? 'N/A'}`
    );

    return NextResponse.json({ transfer: updatedTransfer });
  }

  if (action === 'decline') {
    const { decline_reason_ar } = body;

    if (!decline_reason_ar) {
      return NextResponse.json(
        { error: 'decline_reason_ar is required for decline' },
        { status: 400 }
      );
    }

    // 1. Update transfer — do NOT change bed count
    const { data: updatedTransfer, error: updateError } = await supabase
      .from('icu_transfer_requests')
      .update({
        status: 'declined',
        declined_at: now,
        decline_reason_ar,
        updated_at: now,
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // 2. Send WhatsApp notification to requesting doctor (placeholder)
    console.log(
      `[ICU Transfer Declined] Transfer ${id} declined. ` +
      `Reason: ${decline_reason_ar}. ` +
      `Requesting doctor phone: ${transfer.requesting_doctor_phone ?? 'N/A'}`
    );

    return NextResponse.json({ transfer: updatedTransfer });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
