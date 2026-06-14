import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin, requirePharmacyAccess, tenantScope } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** POST /api/admin/pharmacy/prescriptions/[id]/confirm — set status='received', received_at=NOW() */
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

  if (existing.status !== 'pending' && existing.status !== 'routed') {
    return NextResponse.json(
      { error: `Cannot confirm prescription with status '${existing.status}'` },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from('prescription_routing')
    .update({
      status: 'received',
      received_at: new Date().toISOString(),
      received_by: admin.id,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ prescription: data });
}
