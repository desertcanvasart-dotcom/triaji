import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin, requirePharmacyAccess, tenantScope } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** GET /api/admin/pharmacy/invoices — list pharmacy invoices with filters */
export async function GET(request: NextRequest) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;
  const { admin } = authResult;
  const pharmacyCheck = requirePharmacyAccess(admin);
  if (pharmacyCheck) return pharmacyCheck;

  const supabase = createAdminClient();
  const tenant = tenantScope(admin);
  const { searchParams } = request.nextUrl;

  const date = searchParams.get('date');
  const dateFrom = searchParams.get('date_from');
  const dateTo = searchParams.get('date_to');
  const status = searchParams.get('status');
  const page = parseInt(searchParams.get('page') ?? '1', 10);
  const limit = parseInt(searchParams.get('limit') ?? '20', 10);
  const offset = (page - 1) * limit;

  let query = supabase
    .from('pharmacy_invoices')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (tenant) query = query.eq('tenant_id', tenant);
  if (date) query = query.eq('invoice_date', date);
  if (dateFrom) query = query.gte('invoice_date', dateFrom);
  if (dateTo) query = query.lte('invoice_date', dateTo);
  if (status) query = query.eq('status', status);

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ invoices: data, total: count, page, limit });
}

/** POST /api/admin/pharmacy/invoices — create a pharmacy invoice (auto invoice_number) */
export async function POST(request: NextRequest) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;
  const { admin } = authResult;
  const pharmacyCheck = requirePharmacyAccess(admin);
  if (pharmacyCheck) return pharmacyCheck;

  const supabase = createAdminClient();
  const tenantId = admin.tenant_id;

  if (!tenantId) {
    return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 });
  }

  const body = await request.json();
  const {
    patient_name_ar, prescription_routing_id, line_items,
    discount_egp = 0, insurance_covered = 0,
    payment_method, patient_id, notes_ar,
    status: invoiceStatus,
  } = body;

  if (!patient_name_ar || !line_items) {
    return NextResponse.json(
      { error: 'patient_name_ar and line_items are required' },
      { status: 400 }
    );
  }

  // Generate invoice number
  const { data: invoiceNumber, error: rpcError } = await supabase.rpc('next_pharmacy_invoice_number', {
    p_tenant_id: tenantId,
  });

  if (rpcError) {
    // Fallback: generate a timestamp-based number if RPC doesn't exist yet
    const fallbackNumber = `PH-${tenantId.substring(0, 4).toUpperCase()}-${Date.now()}`;
    const subtotal = (line_items as Array<{ qty: number; unit_price_egp: number }>)
      .reduce((sum, item) => sum + (item.qty * item.unit_price_egp), 0);
    const patientPays = Math.max(0, subtotal - discount_egp - insurance_covered);

    const { data: invoice, error: insertError } = await supabase
      .from('pharmacy_invoices')
      .insert({
        tenant_id: tenantId,
        patient_name_ar,
        routing_id: prescription_routing_id ?? null,
        invoice_number: fallbackNumber,
        line_items,
        subtotal_egp: subtotal,
        discount_egp,
        insurance_covered,
        patient_pays_egp: patientPays,
        status: invoiceStatus ?? 'draft',
        payment_method: payment_method ?? null,
        paid_at: invoiceStatus === 'paid' ? new Date().toISOString() : null,
        patient_id: patient_id ?? null,
        notes_ar: notes_ar ?? null,
        created_by: admin.id,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ invoice }, { status: 201 });
  }

  // Calculate subtotal
  const subtotal = (line_items as Array<{ qty: number; unit_price_egp: number }>)
    .reduce((sum, item) => sum + (item.qty * item.unit_price_egp), 0);
  const patientPays = Math.max(0, subtotal - discount_egp - insurance_covered);

  const { data: invoice, error: insertError } = await supabase
    .from('pharmacy_invoices')
    .insert({
      tenant_id: tenantId,
      patient_name_ar,
      routing_id: prescription_routing_id ?? null,
      invoice_number: invoiceNumber,
      line_items,
      subtotal_egp: subtotal,
      discount_egp,
      insurance_covered,
      patient_pays_egp: patientPays,
      status: invoiceStatus ?? 'draft',
      payment_method: payment_method ?? null,
      paid_at: invoiceStatus === 'paid' ? new Date().toISOString() : null,
      patient_id: patient_id ?? null,
      notes_ar: notes_ar ?? null,
      created_by: admin.id,
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ invoice }, { status: 201 });
}
