import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin, requirePharmacyAccess, tenantScope } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/pharmacy/prescriptions/[id]/collect
 * Set status='collected', collected_at=NOW()
 * Also updates health_records.dispensed_at and dispensed_by_pharmacy
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;
  const { admin } = authResult;
  const pharmacyCheck = requirePharmacyAccess(admin);
  if (pharmacyCheck) return pharmacyCheck;

  const { id } = await params;
  const supabase = createAdminClient();
  const tenant = tenantScope(admin);

  // Verify the prescription belongs to this pharmacy and get health_record_id
  let verifyQuery = supabase
    .from('prescription_routing')
    .select('id, status, health_record_id, pharmacy_tenant_id')
    .eq('id', id);
  if (tenant) verifyQuery = verifyQuery.eq('pharmacy_tenant_id', tenant);

  const { data: existing, error: verifyError } = await verifyQuery.single();

  if (verifyError || !existing) {
    return NextResponse.json({ error: 'Prescription not found' }, { status: 404 });
  }

  if (existing.status !== 'ready' && existing.status !== 'partial_ready') {
    return NextResponse.json(
      { error: `Cannot collect prescription with status '${existing.status}'. Must be 'ready' or 'partial_ready'.` },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();

  // Update prescription_routing to collected
  const { data, error } = await supabase
    .from('prescription_routing')
    .update({
      status: 'collected',
      collected_at: now,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Update the health record with dispensing info
  if (existing.health_record_id) {
    await supabase
      .from('health_records')
      .update({
        dispensed_at: now,
        dispensed_by_pharmacy: existing.pharmacy_tenant_id,
      })
      .eq('id', existing.health_record_id);
  }

  return NextResponse.json({ prescription: data });
}
