import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin, requireChainAccess } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';

/**
 * GET /api/admin/chain/[id]/doctors — Chain-wide doctor list with branch assignments
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

  const supabase = createAdminClient();

  // Get all branches for this chain
  const { data: branches } = await supabase
    .from('tenants')
    .select('id, name_ar, name_en')
    .eq('chain_id', chainId);

  const branchIds = (branches ?? []).map((b) => b.id);

  if (branchIds.length === 0) {
    return NextResponse.json({ doctors: [], branches: [] });
  }

  // Get all doctors in these branches
  const { data: doctors, error } = await supabase
    .from('doctors')
    .select('id, name_ar, name_en, specialty, phone, is_active, tenant_id, avatar_url')
    .in('tenant_id', branchIds)
    .order('name_ar', { ascending: true });

  if (error) {
    console.error('Error fetching doctors:', error);
    return NextResponse.json(
      { error: 'Failed to fetch doctors.' },
      { status: 500 }
    );
  }

  // Get branch assignments
  const { data: assignments } = await supabase
    .from('doctor_branch_assignments')
    .select('*')
    .eq('chain_id', chainId)
    .eq('is_active', true);

  // Map assignments to doctors
  const doctorsWithAssignments = (doctors ?? []).map((doc) => {
    const assignment = (assignments ?? []).find((a) => a.doctor_id === doc.id);
    return {
      ...doc,
      branch_assignments: assignment?.branch_ids ?? [doc.tenant_id],
      schedule: assignment?.schedule ?? {},
    };
  });

  return NextResponse.json({
    doctors: doctorsWithAssignments,
    branches: branches ?? [],
  });
}
