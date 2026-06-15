import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin, requirePharmacyAccess, tenantScope } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** GET /api/admin/pharmacy/prescriptions/[id] — single prescription with items */
export async function GET(
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

  // patient/doctor come from the routing's own FKs; prescription items are nested under
  // health_records (no direct routing→items relationship; no quantity/is_available cols).
  let query = supabase
    .from('prescription_routing')
    .select(`
      *,
      health_records(record_type, uploaded_at, prescription_items(id, drug_name_ar, drug_name_en, dose, frequency_ar, duration_ar, instructions_ar)),
      patients:patient_id(name_ar, phone_number),
      doctors:doctor_id(name_ar)
    `)
    .eq('id', id);

  if (tenant) query = query.eq('pharmacy_tenant_id', tenant);

  const { data, error } = await query.single();

  if (error || !data) {
    return NextResponse.json({ error: 'Prescription not found' }, { status: 404 });
  }

  return NextResponse.json({ prescription: data });
}
