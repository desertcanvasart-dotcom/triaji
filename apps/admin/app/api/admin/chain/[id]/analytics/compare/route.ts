import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin, requireChainAccess } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';

/**
 * GET /api/admin/chain/[id]/analytics/compare — Branch comparison table
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
  const period = url.searchParams.get('period') ?? 'month';

  const now = new Date();
  let startDate: Date;
  switch (period) {
    case 'quarter':
      startDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
      break;
    case 'week':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
      break;
    case 'month':
    default:
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      break;
  }

  const startISO = startDate.toISOString();

  const supabase = createAdminClient();

  // Get branches
  const { data: branches } = await supabase
    .from('tenants')
    .select('id, name_ar, name_en, is_active, created_at')
    .eq('chain_id', chainId)
    .order('created_at', { ascending: true });

  if (!branches || branches.length === 0) {
    return NextResponse.json({ comparison: [], period });
  }

  const comparison = await Promise.all(
    branches.map(async (branch) => {
      // Total bookings in period
      const { count: totalBookings } = await supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', branch.id)
        .gte('created_at', startISO);

      // Completed bookings
      const { count: completed } = await supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', branch.id)
        .eq('status', 'completed')
        .gte('created_at', startISO);

      // No-shows
      const { count: noShows } = await supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', branch.id)
        .eq('status', 'no_show')
        .gte('created_at', startISO);

      // Revenue
      const { data: revenueData } = await supabase
        .from('invoices')
        .select('total_amount')
        .eq('tenant_id', branch.id)
        .eq('status', 'paid')
        .gte('created_at', startISO);

      const revenue = (revenueData ?? []).reduce(
        (sum, inv) => sum + (inv.total_amount ?? 0),
        0
      );

      // Doctor count
      const { count: doctorCount } = await supabase
        .from('doctors')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', branch.id)
        .eq('is_active', true);

      // Unique patients
      const { count: uniquePatients } = await supabase
        .from('bookings')
        .select('patient_id', { count: 'exact', head: true })
        .eq('tenant_id', branch.id)
        .gte('created_at', startISO);

      // Avg wait
      const { data: waitData } = await supabase
        .from('bookings')
        .select('wait_minutes')
        .eq('tenant_id', branch.id)
        .gte('created_at', startISO)
        .not('wait_minutes', 'is', null);

      const waitValues = (waitData ?? []).map((w) => w.wait_minutes).filter(Boolean);
      const avgWait = waitValues.length > 0
        ? Math.round(waitValues.reduce((a, b) => a + b, 0) / waitValues.length)
        : 0;

      const completionRate = totalBookings
        ? Math.round(((completed ?? 0) / (totalBookings ?? 1)) * 100)
        : 0;

      return {
        branch_id: branch.id,
        branch_name: branch.name_ar,
        branch_name_en: branch.name_en,
        is_active: branch.is_active,
        total_bookings: totalBookings ?? 0,
        completed: completed ?? 0,
        no_shows: noShows ?? 0,
        completion_rate: completionRate,
        revenue,
        doctor_count: doctorCount ?? 0,
        unique_patients: uniquePatients ?? 0,
        avg_wait_minutes: avgWait,
      };
    })
  );

  return NextResponse.json({ comparison, period });
}
