import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin, requireChainAccess } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';

/**
 * GET /api/admin/chain/[id]/analytics — Consolidated analytics
 * Revenue per branch, patient counts, doctor performance, peak hours
 * Query: period (week/month/quarter)
 * Auth: chain_owner
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;
  const { admin } = authResult;
  const { id: chainId } = await params;

  const chainCheck = requireChainAccess(admin, chainId);
  if (chainCheck) return chainCheck;

  const url = request.nextUrl;
  const period = url.searchParams.get('period') ?? 'week';

  // Calculate date range
  const now = new Date();
  let startDate: Date;
  switch (period) {
    case 'quarter':
      startDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
      break;
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      break;
    case 'week':
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
      break;
  }

  const startISO = startDate.toISOString();
  const today = new Date().toISOString().split('T')[0];

  const supabase = createAdminClient();

  // Get all branches
  const { data: branches } = await supabase
    .from('tenants')
    .select('id, name_ar, name_en, is_active')
    .eq('chain_id', chainId);

  if (!branches || branches.length === 0) {
    return NextResponse.json({
      total_patients: 0,
      today_patients: 0,
      monthly_revenue: 0,
      avg_wait_minutes: 0,
      branches: [],
      revenue_by_branch: [],
      new_patients_trend: [],
    });
  }

  const branchIds = branches.map((b) => b.id);

  // Total patients (all time)
  const { count: totalPatients } = await supabase
    .from('chain_patient_registry')
    .select('id', { count: 'exact', head: true })
    .eq('chain_id', chainId);

  // Today's patients
  const { count: todayPatients } = await supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .in('tenant_id', branchIds)
    .gte('created_at', `${today}T00:00:00`)
    .lte('created_at', `${today}T23:59:59`);

  // Revenue in period
  const { data: revenueData } = await supabase
    .from('clinic_invoices')
    .select('tenant_id, total_amount:patient_pays_egp, created_at')
    .in('tenant_id', branchIds)
    .gte('created_at', startISO)
    .eq('status', 'paid');

  const totalRevenue = (revenueData ?? []).reduce(
    (sum, inv) => sum + (inv.total_amount ?? 0),
    0
  );

  // Revenue by branch
  const revenueByBranch = branches.map((branch) => {
    const branchRevenue = (revenueData ?? [])
      .filter((inv) => inv.tenant_id === branch.id)
      .reduce((sum, inv) => sum + (inv.total_amount ?? 0), 0);
    return {
      branch_id: branch.id,
      branch_name: branch.name_ar,
      revenue: branchRevenue,
    };
  });

  // Average wait time across branches.
  // `bookings` has no wait_minutes column (no source for this metric yet).
  const avgWait = 0;

  // Per-branch status cards
  const branchStats = await Promise.all(
    branches.map(async (branch) => {
      const { count: patCount } = await supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', branch.id)
        .gte('created_at', `${today}T00:00:00`)
        .lte('created_at', `${today}T23:59:59`);

      const { count: docCount } = await supabase
        .from('doctors')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', branch.id)
        .eq('is_active', true);

      // `bookings` has no wait_minutes column (no source for this metric yet).
      const branchAvgWait = 0;

      return {
        branch_id: branch.id,
        branch_name: branch.name_ar,
        branch_name_en: branch.name_en,
        is_active: branch.is_active,
        today_patients: patCount ?? 0,
        doctor_count: docCount ?? 0,
        avg_wait_minutes: branchAvgWait,
      };
    })
  );

  // New patients trend (daily, in period)
  const { data: newPatientsData } = await supabase
    .from('chain_patient_registry')
    .select('first_seen_at')
    .eq('chain_id', chainId)
    .gte('first_seen_at', startISO)
    .order('first_seen_at', { ascending: true });

  // Group by date
  const trendMap: Record<string, number> = {};
  for (const entry of newPatientsData ?? []) {
    const date = entry.first_seen_at?.split('T')[0];
    if (date) {
      trendMap[date] = (trendMap[date] ?? 0) + 1;
    }
  }
  const newPatientsTrend = Object.entries(trendMap).map(([date, count]) => ({
    date,
    count,
  }));

  return NextResponse.json({
    total_patients: totalPatients ?? 0,
    today_patients: todayPatients ?? 0,
    monthly_revenue: totalRevenue,
    avg_wait_minutes: avgWait,
    branches: branchStats,
    revenue_by_branch: revenueByBranch,
    new_patients_trend: newPatientsTrend,
    period,
  });
}
