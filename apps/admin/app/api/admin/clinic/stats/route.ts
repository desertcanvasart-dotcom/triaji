import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin, requireClinicAccess, tenantScope } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** GET /api/admin/clinic/stats — queue + revenue statistics */
export async function GET(request: NextRequest) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;
  const { admin } = authResult;
  const clinicCheck = requireClinicAccess(admin);
  if (clinicCheck) return clinicCheck;

  const supabase = createAdminClient();
  const tenant = tenantScope(admin);
  const { searchParams } = request.nextUrl;
  const period = searchParams.get('period') ?? 'today';

  // Determine date range
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  let dateFrom = today;

  if (period === 'week') {
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    dateFrom = weekAgo.toISOString().split('T')[0];
  } else if (period === 'month') {
    const monthAgo = new Date(now);
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    dateFrom = monthAgo.toISOString().split('T')[0];
  }

  // Queue stats (queue_date rides along for the daily breakdown below,
  // which previously re-fetched the same rows in a third query)
  let queueQuery = supabase
    .from('clinic_queue')
    .select('status, wait_minutes_actual, queue_date')
    .gte('queue_date', dateFrom)
    .lte('queue_date', today);

  if (tenant) queueQuery = queueQuery.eq('tenant_id', tenant);

  // Revenue stats
  let revenueQuery = supabase
    .from('clinic_invoices')
    .select('patient_pays_egp, status')
    .gte('invoice_date', dateFrom)
    .lte('invoice_date', today);

  if (tenant) revenueQuery = revenueQuery.eq('tenant_id', tenant);

  // Independent — run in parallel.
  const [{ data: queueData }, { data: invoiceData }] = await Promise.all([
    queueQuery,
    revenueQuery,
  ]);
  const entries = queueData ?? [];

  const totalPatients = entries.length;
  const completed = entries.filter((e) => e.status === 'completed').length;
  const noShows = entries.filter((e) => e.status === 'no_show').length;
  const leftBeforeSeen = entries.filter((e) => e.status === 'left').length;

  const waitsWithData = entries
    .filter((e) => e.wait_minutes_actual !== null)
    .map((e) => e.wait_minutes_actual as number);
  const avgWaitMinutes = waitsWithData.length > 0
    ? Math.round(waitsWithData.reduce((a, b) => a + b, 0) / waitsWithData.length)
    : 0;

  const invoices = invoiceData ?? [];

  const totalRevenue = invoices
    .filter((i) => i.status === 'paid')
    .reduce((sum, i) => sum + Number(i.patient_pays_egp), 0);

  const totalInvoices = invoices.length;

  // Daily breakdown (for charts) — reuses the queue rows fetched above.
  const dailyBreakdown = new Map<string, { total: number; completed: number; noShow: number }>();

  for (const entry of entries) {
    const day = dailyBreakdown.get(entry.queue_date) ?? { total: 0, completed: 0, noShow: 0 };
    day.total++;
    if (entry.status === 'completed') day.completed++;
    if (entry.status === 'no_show') day.noShow++;
    dailyBreakdown.set(entry.queue_date, day);
  }

  return NextResponse.json({
    period,
    queue: {
      totalPatients,
      completed,
      noShows,
      leftBeforeSeen,
      avgWaitMinutes,
    },
    revenue: {
      totalRevenue,
      totalInvoices,
    },
    daily: Array.from(dailyBreakdown.entries()).map(([date, stats]) => ({
      date,
      ...stats,
    })),
  });
}
