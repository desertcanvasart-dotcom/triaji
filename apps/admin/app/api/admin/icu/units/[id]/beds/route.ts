import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin, requireIcuAccess, tenantScope } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** PUT /api/admin/icu/units/[id]/beds — update available bed count */
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

  const { available_beds, change_reason } = body;

  if (available_beds === undefined || available_beds === null) {
    return NextResponse.json(
      { error: 'available_beds is required' },
      { status: 400 }
    );
  }

  if (!change_reason) {
    return NextResponse.json(
      { error: 'change_reason is required' },
      { status: 400 }
    );
  }

  // Fetch current unit to validate
  let unitQuery = supabase
    .from('icu_units')
    .select('*')
    .eq('id', id);

  if (tenant) unitQuery = unitQuery.eq('tenant_id', tenant);

  const { data: unit, error: unitError } = await unitQuery.single();

  if (unitError || !unit) {
    return NextResponse.json(
      { error: 'ICU unit not found' },
      { status: 404 }
    );
  }

  if (available_beds < 0 || available_beds > unit.total_beds) {
    return NextResponse.json(
      { error: `available_beds must be between 0 and ${unit.total_beds}` },
      { status: 400 }
    );
  }

  const previousAvailable = unit.available_beds;

  // Update unit
  const { data: updatedUnit, error: updateError } = await supabase
    .from('icu_units')
    .update({
      available_beds,
      last_updated_by: admin.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Log to icu_availability_log
  const { error: logError } = await supabase
    .from('icu_availability_log')
    .insert({
      icu_unit_id: id,
      tenant_id: unit.tenant_id,
      previous_available: previousAvailable,
      new_available: available_beds,
      change_reason,
      updated_by: admin.id,
    });

  if (logError) {
    console.error('Failed to log availability change:', logError.message);
  }

  return NextResponse.json({ unit: updatedUnit });
}
