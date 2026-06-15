import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin, requirePharmacyAccess, tenantScope } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/pharmacy/prescriptions/[id]/stock
 * Save stock_confirmation JSONB array — e.g. [{ item_id, is_available, substitute_name?, substitute_notes? }]
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

  const body = await request.json();
  const { stock_confirmation } = body;

  if (!stock_confirmation || !Array.isArray(stock_confirmation)) {
    return NextResponse.json(
      { error: 'stock_confirmation array is required' },
      { status: 400 }
    );
  }

  // Verify the prescription belongs to this pharmacy
  let verifyQuery = supabase
    .from('prescription_routing')
    .select('id, status')
    .eq('id', id);
  if (tenant) verifyQuery = verifyQuery.eq('pharmacy_tenant_id', tenant);

  const { data: existing, error: verifyError } = await verifyQuery.single();

  if (verifyError || !existing) {
    return NextResponse.json({ error: 'Prescription not found' }, { status: 404 });
  }

  // Update the stock confirmation
  const { data, error } = await supabase
    .from('prescription_routing')
    .update({
      stock_confirmation,
      stock_checked_at: new Date().toISOString(),
      stock_checked_by: admin.id,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // NOTE: per-item availability is NOT persisted on prescription_items — that
  // table has no `is_available` column and no `prescription_routing_id`
  // (items link to the routing only indirectly via health_record_id). The
  // authoritative per-item stock state is the stock_confirmation JSONB array
  // we just saved on prescription_routing above, which is what the read path
  // consumes. If a normalized prescription_items.is_available is ever needed,
  // join via prescription_routing.health_record_id → prescription_items.

  return NextResponse.json({ prescription: data });
}
