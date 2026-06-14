import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin, requireClinicAccess, tenantScope } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** GET /api/admin/invoices/[id] — get a single invoice */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;
  const { admin } = authResult;
  const clinicCheck = requireClinicAccess(admin);
  if (clinicCheck) return clinicCheck;

  const { id } = await params;
  const supabase = createAdminClient();
  const tenant = tenantScope(admin);

  let query = supabase
    .from('clinic_invoices')
    .select('*, doctors:doctors(name_ar, name_en)')
    .eq('id', id);

  if (tenant) query = query.eq('tenant_id', tenant);

  const { data, error } = await query.single();

  if (error || !data) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  }

  return NextResponse.json({ invoice: data });
}

/** PUT /api/admin/invoices/[id] — update invoice */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;
  const { admin } = authResult;
  const clinicCheck = requireClinicAccess(admin);
  if (clinicCheck) return clinicCheck;

  const { id } = await params;
  const supabase = createAdminClient();
  const tenant = tenantScope(admin);
  const body = await request.json();

  const update: Record<string, unknown> = {};

  if (body.status) {
    update.status = body.status;
    if (body.status === 'paid') {
      update.paid_at = new Date().toISOString();
    }
  }
  if (body.payment_method !== undefined) update.payment_method = body.payment_method;
  if (body.discount_egp !== undefined) update.discount_egp = body.discount_egp;
  if (body.insurance_covered !== undefined) update.insurance_covered = body.insurance_covered;
  if (body.notes_ar !== undefined) update.notes_ar = body.notes_ar;
  if (body.line_items !== undefined) {
    update.line_items = body.line_items;
    const subtotal = (body.line_items as Array<{ qty: number; unit_price_egp: number }>)
      .reduce((sum: number, item: { qty: number; unit_price_egp: number }) => sum + (item.qty * item.unit_price_egp), 0);
    update.subtotal_egp = subtotal;
    update.patient_pays_egp = Math.max(0,
      subtotal - (body.discount_egp ?? 0) - (body.insurance_covered ?? 0)
    );
  }

  let updateQuery = supabase.from('clinic_invoices').update(update).eq('id', id);
  if (tenant) updateQuery = updateQuery.eq('tenant_id', tenant);

  const { data, error } = await updateQuery.select().single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ invoice: data });
}
