import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin, requireClinicAccess, tenantScope } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** GET /api/admin/invoices/daily-summary — daily cash totals */
export async function GET(request: NextRequest) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;
  const { admin } = authResult;
  const clinicCheck = requireClinicAccess(admin);
  if (clinicCheck) return clinicCheck;

  const supabase = createAdminClient();
  const tenant = tenantScope(admin);
  const { searchParams } = request.nextUrl;
  const date = searchParams.get('date') ?? new Date().toISOString().split('T')[0];

  // Fetch all invoices for the date
  let query = supabase
    .from('clinic_invoices')
    .select('*')
    .eq('invoice_date', date);

  if (tenant) query = query.eq('tenant_id', tenant);

  const { data: invoices, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const allInvoices = invoices ?? [];
  const paidInvoices = allInvoices.filter((i) => i.status === 'paid');

  // Group by payment method
  const byMethod = new Map<string, { count: number; total: number }>();
  for (const inv of paidInvoices) {
    const method = inv.payment_method ?? 'cash';
    const existing = byMethod.get(method) ?? { count: 0, total: 0 };
    existing.count++;
    existing.total += Number(inv.patient_pays_egp);
    byMethod.set(method, existing);
  }

  const byPaymentMethod = Array.from(byMethod.entries()).map(([method, data]) => ({
    method,
    count: data.count,
    total: data.total,
  }));

  return NextResponse.json({
    date,
    totalInvoices: allInvoices.length,
    totalRevenue: paidInvoices.reduce((sum, i) => sum + Number(i.patient_pays_egp), 0),
    byPaymentMethod,
    pendingInvoices: allInvoices.filter((i) => i.status !== 'paid' && i.status !== 'cancelled').length,
  });
}
