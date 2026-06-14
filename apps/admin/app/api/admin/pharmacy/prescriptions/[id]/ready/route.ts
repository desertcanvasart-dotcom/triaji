import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin, requirePharmacyAccess, tenantScope } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/pharmacy/prescriptions/[id]/ready
 * Set status='ready' or 'partial_ready', ready_at=NOW()
 * Note: WhatsApp notifications will be added in Batch 6
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
  const { partial } = body;

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

  if (existing.status !== 'received') {
    return NextResponse.json(
      { error: `Cannot mark as ready from status '${existing.status}'. Must be 'received' first.` },
      { status: 400 }
    );
  }

  const newStatus = partial ? 'partial_ready' : 'ready';

  const { data, error } = await supabase
    .from('prescription_routing')
    .update({
      status: newStatus,
      ready_at: new Date().toISOString(),
      prepared_by: admin.id,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ prescription: data });
}
