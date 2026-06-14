import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin, requirePharmacyAccess, tenantScope } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** GET /api/admin/pharmacy/stats — dashboard stats */
export async function GET(request: NextRequest) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;
  const { admin } = authResult;
  const pharmacyCheck = requirePharmacyAccess(admin);
  if (pharmacyCheck) return pharmacyCheck;

  const supabase = createAdminClient();
  const tenant = tenantScope(admin);
  const today = new Date().toISOString().split('T')[0];

  // Prescriptions today
  let prescriptionsTodayQuery = supabase
    .from('prescription_routing')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', `${today}T00:00:00`)
    .lte('created_at', `${today}T23:59:59`);
  if (tenant) prescriptionsTodayQuery = prescriptionsTodayQuery.eq('pharmacy_tenant_id', tenant);
  const { count: prescriptionsToday } = await prescriptionsTodayQuery;

  // Pending (received but not ready)
  let pendingQuery = supabase
    .from('prescription_routing')
    .select('*', { count: 'exact', head: true })
    .in('status', ['pending', 'routed', 'received']);
  if (tenant) pendingQuery = pendingQuery.eq('pharmacy_tenant_id', tenant);
  const { count: pendingCount } = await pendingQuery;

  // Ready for collection
  let readyQuery = supabase
    .from('prescription_routing')
    .select('*', { count: 'exact', head: true })
    .in('status', ['ready', 'partial_ready']);
  if (tenant) readyQuery = readyQuery.eq('pharmacy_tenant_id', tenant);
  const { count: readyCount } = await readyQuery;

  // Collected today
  let collectedQuery = supabase
    .from('prescription_routing')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'collected')
    .gte('collected_at', `${today}T00:00:00`)
    .lte('collected_at', `${today}T23:59:59`);
  if (tenant) collectedQuery = collectedQuery.eq('pharmacy_tenant_id', tenant);
  const { count: collectedToday } = await collectedQuery;

  // Average preparation time (last 7 days — from received_at to ready_at)
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoStr = weekAgo.toISOString();

  let prepTimeQuery = supabase
    .from('prescription_routing')
    .select('received_at, ready_at')
    .in('status', ['ready', 'partial_ready', 'collected'])
    .not('received_at', 'is', null)
    .not('ready_at', 'is', null)
    .gte('ready_at', weekAgoStr)
    .limit(100);
  if (tenant) prepTimeQuery = prepTimeQuery.eq('pharmacy_tenant_id', tenant);
  const { data: prepData } = await prepTimeQuery;

  let avgPrepMinutes: number | null = null;
  if (prepData && prepData.length > 0) {
    const totalMs = prepData.reduce((sum, row) => {
      const received = new Date(row.received_at).getTime();
      const ready = new Date(row.ready_at).getTime();
      return sum + (ready - received);
    }, 0);
    avgPrepMinutes = Math.round((totalMs / prepData.length / (1000 * 60)) * 10) / 10;
  }

  return NextResponse.json({
    prescriptions_today: prescriptionsToday ?? 0,
    pending: pendingCount ?? 0,
    ready: readyCount ?? 0,
    collected_today: collectedToday ?? 0,
    avg_prep_minutes: avgPrepMinutes,
  });
}
