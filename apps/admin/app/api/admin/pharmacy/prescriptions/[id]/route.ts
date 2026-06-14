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

  let query = supabase
    .from('prescription_routing')
    .select(`
      *,
      health_records(patient_name_ar, patient_phone, doctor_name_ar, record_type, created_at),
      prescription_items(id, medication_name_ar, medication_name_en, dosage, frequency, duration, quantity, notes, is_available)
    `)
    .eq('id', id);

  if (tenant) query = query.eq('pharmacy_tenant_id', tenant);

  const { data, error } = await query.single();

  if (error || !data) {
    return NextResponse.json({ error: 'Prescription not found' }, { status: 404 });
  }

  return NextResponse.json({ prescription: data });
}
