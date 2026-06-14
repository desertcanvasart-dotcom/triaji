import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin, requireChainAccess } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';

/**
 * PUT /api/admin/chain/[id]/doctors/[doctorId]/schedule — Update cross-branch schedule
 * Body: { schedule: Record<branchId, { days, slots }> }
 * Auth: chain_owner
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; doctorId: string }> }
) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;
  const { admin } = authResult;
  const { id: chainId, doctorId } = await params;

  const chainCheck = requireChainAccess(admin, chainId);
  if (chainCheck) return chainCheck;

  try {
    const body = await request.json();
    const { schedule } = body;

    if (!schedule || typeof schedule !== 'object') {
      return NextResponse.json(
        { error: 'schedule (object) is required. Format: Record<branchId, { days: number[], slots?: string[] }>' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Verify branch IDs in schedule belong to this chain
    const branchIds = Object.keys(schedule);
    if (branchIds.length > 0) {
      const { data: validBranches } = await supabase
        .from('tenants')
        .select('id')
        .eq('chain_id', chainId)
        .in('id', branchIds);

      const validIds = new Set((validBranches ?? []).map((b) => b.id));
      const invalidIds = branchIds.filter((id) => !validIds.has(id));

      if (invalidIds.length > 0) {
        return NextResponse.json(
          { error: `Invalid branch IDs in schedule: ${invalidIds.join(', ')}` },
          { status: 400 }
        );
      }
    }

    // Find existing assignment
    const { data: existing } = await supabase
      .from('doctor_branch_assignments')
      .select('id')
      .eq('chain_id', chainId)
      .eq('doctor_id', doctorId)
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: 'Doctor assignment not found. Assign the doctor to branches first.' },
        { status: 404 }
      );
    }

    // Update schedule
    const { data, error } = await supabase
      .from('doctor_branch_assignments')
      .update({ schedule })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating schedule:', error);
      return NextResponse.json(
        { error: 'Failed to update schedule.' },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body.' },
      { status: 400 }
    );
  }
}
