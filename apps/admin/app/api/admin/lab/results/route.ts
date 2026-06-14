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
  const { routing_id, patient_id, patient_name_ar, results, notes, pdf_url } = body;

  if (!routing_id || !results || !Array.isArray(results) || results.length === 0) {
    return NextResponse.json(
      { error: 'routing_id and results array are required' },
      { status: 400 }
    );
  }

  // Create health record for the results
  const { data: record, error: recordError } = await supabase
    .from('health_records')
    .insert({
      tenant_id: tenantId,
      patient_id: patient_id ?? null,
      patient_name_ar: patient_name_ar ?? null,
      record_type: 'lab_result',
      content: {
        results,
        notes: notes ?? null,
        pdf_url: pdf_url ?? null,
        uploaded_by: admin.id,
        uploaded_at: new Date().toISOString(),
      },
      source: 'lab_portal',
    })
    .select()
    .single();

  if (recordError) {
    return NextResponse.json({ error: recordError.message }, { status: 500 });
  }

  // Update individual lab_order_items with results
  for (const result of results) {
    if (result.item_id && result.value !== undefined) {
      await supabase
        .from('lab_order_items')
        .update({
          status: 'completed',
          result_value: result.value,
          unit: result.unit ?? null,
          reference_range: result.reference_range ?? null,
          notes: result.notes ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', result.item_id);
    }
  }

  // Update routing status to results_ready
  const { error: routingError } = await supabase
    .from('lab_order_routing')
    .update({
      status: 'results_ready',
      result_record_id: record.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', routing_id)
    .eq('lab_tenant_id', tenantId);

  if (routingError) {
    return NextResponse.json({ error: routingError.message }, { status: 500 });
  }

  return NextResponse.json({ record, routing_id }, { status: 201 });
}
