import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin, requireLabAccess, tenantScope } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** POST /api/admin/lab/results — upload structured lab results */
export async function POST(request: NextRequest) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;
  const { admin } = authResult;
  const labCheck = requireLabAccess(admin);
  if (labCheck) return labCheck;

  const supabase = createAdminClient();
  const tenantId = admin.tenant_id;

  if (!tenantId) {
    return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 });
  }

  const body = await request.json();
  const { routing_id, patient_id, results, notes, pdf_url } = body;

  if (!routing_id || !results || !Array.isArray(results) || results.length === 0) {
    return NextResponse.json(
      { error: 'routing_id and results array are required' },
      { status: 400 }
    );
  }

  // Verify the routing belongs to this lab tenant and resolve the patient.
  const { data: routing, error: routingLookupError } = await supabase
    .from('lab_order_routing')
    .select('id, patient_id')
    .eq('id', routing_id)
    .eq('lab_tenant_id', tenantId)
    .single();

  if (routingLookupError || !routing) {
    return NextResponse.json({ error: 'Lab order routing not found' }, { status: 404 });
  }

  const resolvedPatientId = patient_id ?? routing.patient_id;
  if (!resolvedPatientId) {
    return NextResponse.json({ error: 'patient_id could not be resolved' }, { status: 400 });
  }

  // Results live in the lab_values jsonb (same shape as the chain-result + manual
  // upload paths). lab_order_items has no per-item result columns, so the item_id
  // is carried inside each lab_values entry instead.
  const labValues = (results as Array<{
    item_id?: string; test_code?: string; test_name?: string; test_name_ar?: string;
    value?: unknown; unit?: string; reference_range?: string; abnormal?: boolean; notes?: string;
  }>).map((r) => ({
    item_id: r.item_id ?? null,
    test_code: r.test_code ?? null,
    test_name: r.test_name ?? null,
    test_name_ar: r.test_name_ar ?? null,
    value: r.value ?? null,
    unit: r.unit ?? '',
    reference_range: r.reference_range ?? null,
    abnormal: r.abnormal ?? false,
    notes: r.notes ?? null,
  }));

  const nowIso = new Date().toISOString();

  // Create the lab-result health record. There is no content/source/tenant_id/
  // patient_name_ar column; file_* are NOT NULL so use the PDF or a sentinel.
  const { data: record, error: recordError } = await supabase
    .from('health_records')
    .insert({
      patient_id: resolvedPatientId,
      record_type: 'lab_result',
      lab_values: labValues,
      lab_date: nowIso,
      has_abnormal_values: labValues.some((v) => v.abnormal),
      summary_ar: notes ?? null,
      pdf_url: pdf_url ?? null,
      file_url: pdf_url ?? 'system/lab-portal-result',
      file_name: 'lab-result.pdf',
      mime_type: 'application/pdf',
      uploaded_at: nowIso,
    })
    .select()
    .single();

  if (recordError) {
    return NextResponse.json({ error: recordError.message }, { status: 500 });
  }

  // Update routing status to results_ready, linking the new result record.
  const { error: routingError } = await supabase
    .from('lab_order_routing')
    .update({
      status: 'results_ready',
      result_health_record_id: record.id,
      updated_at: nowIso,
    })
    .eq('id', routing_id)
    .eq('lab_tenant_id', tenantId);

  if (routingError) {
    return NextResponse.json({ error: routingError.message }, { status: 500 });
  }

  return NextResponse.json({ record, routing_id }, { status: 201 });
}
