import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin, requireLabAccess, tenantScope } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** GET /api/admin/lab/stats — dashboard stats */
export async function GET(request: NextRequest) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;
  const { admin } = authResult;
  const labCheck = requireLabAccess(admin);
  if (labCheck) return labCheck;

  const supabase = createAdminClient();
  const tenant = tenantScope(admin);
  const today = new Date().toISOString().split('T')[0];

  // Orders today
  let ordersQuery = supabase
    .from('lab_order_routing')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', `${today}T00:00:00`)
    .lte('created_at', `${today}T23:59:59`);
  if (tenant) ordersQuery = ordersQuery.eq('lab_tenant_id', tenant);

  // Pending results
  let pendingQuery = supabase
    .from('lab_order_routing')
    .select('*', { count: 'exact', head: true })
    .in('status', ['pending', 'accepted', 'sample_collected', 'processing']);
  if (tenant) pendingQuery = pendingQuery.eq('lab_tenant_id', tenant);

  // Completed today
  let completedQuery = supabase
    .from('lab_order_routing')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'results_ready')
    .gte('updated_at', `${today}T00:00:00`)
    .lte('updated_at', `${today}T23:59:59`);
  if (tenant) completedQuery = completedQuery.eq('lab_tenant_id', tenant);

  // Average turnaround (completed in last 7 days)
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoStr = weekAgo.toISOString();

  let turnaroundQuery = supabase
    .from('lab_order_routing')
    .select('created_at, updated_at')
    .eq('status', 'results_ready')
    .gte('updated_at', weekAgoStr)
    .limit(100);
  if (tenant) turnaroundQuery = turnaroundQuery.eq('lab_tenant_id', tenant);

  // All four are independent — run in parallel.
  const [
    { count: ordersToday },
    { count: pendingResults },
    { count: completedToday },
    { data: turnaroundData },
  ] = await Promise.all([
    ordersQuery,
    pendingQuery,
    completedQuery,
    turnaroundQuery,
  ]);

  let avgTurnaroundHours: number | null = null;
  if (turnaroundData && turnaroundData.length > 0) {
    const totalMs = turnaroundData.reduce((sum, row) => {
      const created = new Date(row.created_at).getTime();
      const updated = new Date(row.updated_at).getTime();
      return sum + (updated - created);
    }, 0);
    avgTurnaroundHours = Math.round((totalMs / turnaroundData.length / (1000 * 60 * 60)) * 10) / 10;
  }

  return NextResponse.json({
    orders_today: ordersToday ?? 0,
    pending_results: pendingResults ?? 0,
    completed_today: completedToday ?? 0,
    avg_turnaround_hours: avgTurnaroundHours,
  });
}
