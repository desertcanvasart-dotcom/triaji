/**
 * GET /api/admin/payments/summary
 *
 * Returns payment summary for a tenant.
 * Query: period=month|week|all (default: month)
 *
 * Returns:
 * {
 *   totalRevenue, paidCash, paidOnline, unpaid,
 *   totalTransactions,
 *   byProvider: { fawry, paymob, vodafone_cash }
 * }
 *
 * Auth: admin (clinic_owner, clinic_billing, lab_owner, lab_billing,
 *              pharmacy_owner, pharmacy_billing, platform_admin)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateAdmin } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

type Period = 'week' | 'month' | 'all';

function getPeriodStart(period: Period): string | null {
  if (period === 'all') return null;

  const now = new Date();
  if (period === 'week') {
    now.setDate(now.getDate() - 7);
  } else {
    now.setMonth(now.getMonth() - 1);
  }
  return now.toISOString();
}

export async function GET(request: NextRequest) {
  // Auth
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;
  const { admin } = authResult;

  // Only billing/owner/admin roles
  const allowedRoles = [
    'platform_admin',
    'tenant_admin',
    'clinic_owner',
    'clinic_billing',
    'lab_owner',
    'lab_billing',
    'pharmacy_owner',
    'pharmacy_billing',
  ];

  if (!allowedRoles.includes(admin.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const tenantId = admin.tenant_id;
  if (!tenantId && admin.role !== 'platform_admin') {
    return NextResponse.json({ error: 'No tenant associated' }, { status: 400 });
  }

  const period = (request.nextUrl.searchParams.get('period') as Period) ?? 'month';
  const periodStart = getPeriodStart(period);

  const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL']!;
  const supabaseServiceKey = process.env['SUPABASE_SERVICE_ROLE_KEY']!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ─── Online Payment Transactions ────────────────────────────────────

  let txnQuery = supabase
    .from('payment_transactions')
    .select('id, amount_egp, status, provider, completed_at, created_at');

  if (tenantId) {
    // Filter by tenant: we need to join through the payable
    // For simplicity, filter by patient's tenant or booking's tenant
    // Use a view or RPC in production; here we filter via a subquery approach
    txnQuery = txnQuery.eq('tenant_id', tenantId);
  }

  if (periodStart) {
    txnQuery = txnQuery.gte('created_at', periodStart);
  }

  const { data: transactions } = await txnQuery;
  const txns = transactions ?? [];

  // ─── Clinic Invoices (for cash payments) ────────────────────────────

  let invoiceQuery = supabase
    .from('clinic_invoices')
    .select('id, patient_pays_egp, status, payment_method, created_at');

  if (tenantId) {
    invoiceQuery = invoiceQuery.eq('tenant_id', tenantId);
  }

  if (periodStart) {
    invoiceQuery = invoiceQuery.gte('created_at', periodStart);
  }

  const { data: invoices } = await invoiceQuery;
  const invs = invoices ?? [];

  // ─── Calculate Summaries ────────────────────────────────────────────

  // Online payments
  let paidOnline = 0;
  let unpaidOnline = 0;
  const byProvider: Record<string, { count: number; amount: number }> = {
    fawry: { count: 0, amount: 0 },
    paymob: { count: 0, amount: 0 },
    vodafone_cash: { count: 0, amount: 0 },
  };

  for (const txn of txns) {
    const amount = Number(txn.amount_egp) || 0;
    if (txn.status === 'completed') {
      paidOnline += amount;
      const providerKey = txn.provider as string;
      if (byProvider[providerKey]) {
        byProvider[providerKey]!.count++;
        byProvider[providerKey]!.amount += amount;
      }
    } else if (txn.status === 'pending') {
      unpaidOnline += amount;
    }
  }

  // Cash/card payments from invoices
  let paidCash = 0;
  let unpaidInvoice = 0;
  for (const inv of invs) {
    const amount = Number(inv.patient_pays_egp) || 0;
    if (inv.status === 'paid') {
      if (inv.payment_method === 'cash' || inv.payment_method === 'card') {
        paidCash += amount;
      }
    } else if (inv.status === 'issued' || inv.status === 'draft') {
      unpaidInvoice += amount;
    }
  }

  const totalRevenue = paidOnline + paidCash;
  const unpaid = unpaidOnline + unpaidInvoice;
  const totalTransactions = txns.length + invs.length;

  return NextResponse.json({
    totalRevenue,
    paidCash,
    paidOnline,
    unpaid,
    totalTransactions,
    byProvider,
    period,
  });
}
