import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin, requireChainAccess } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';

/**
 * POST /api/admin/chain/[id]/doctors/assign — Assign doctor to branches
 * Body: { doctor_id, branch_ids }
 * Creates/updates doctor_branch_assignments
 * Auth: chain_owner
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;
  const { admin } = authResult;
  const { id: chainId } = await params;

  const chainCheck = requireChainAccess(admin, chainId);
  if (chainCheck) return chainCheck;

  try {
    const body = await request.json();
    const { doctor_id, branch_ids } = body;

    if (!doctor_id || !branch_ids || !Array.isArray(branch_ids)) {
      return NextResponse.json(
        { error: 'doctor_id and branch_ids (array) are required.' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Verify all branch_ids belong to this chain
    const { data: validBranches } = await supabase
      .from('tenants')
      .select('id')
      .eq('chain_id', chainId)
      .in('id', branch_ids);

    const validBranchIds = (validBranches ?? []).map((b) => b.id);
    const invalidIds = branch_ids.filter((id: string) => !validBranchIds.includes(id));

    if (invalidIds.length > 0) {
      return NextResponse.json(
        { error: `Invalid branch IDs: ${invalidIds.join(', ')}. They do not belong to this chain.` },
        { status: 400 }
      );
    }

    // Verify doctor exists in one of the chain's branches
    const { data: doctor } = await supabase
      .from('doctors')
      .select('id')
      .eq('id', doctor_id)
      .in('tenant_id', validBranchIds)
      .single();

    if (!doctor) {
      return NextResponse.json(
        { error: 'Doctor not found in this chain.' },
        { status: 404 }
      );
    }

    // Upsert assignment
    const { data: existing } = await supabase
      .from('doctor_branch_assignments')
      .select('id')
      .eq('chain_id', chainId)
      .eq('doctor_id', doctor_id)
      .single();

    let result;
    if (existing) {
      const { data, error } = await supabase
        .from('doctor_branch_assignments')
        .update({
          branch_ids: validBranchIds,
          is_active: true,
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating assignment:', error);
        return NextResponse.json(
          { error: 'Failed to update assignment.' },
          { status: 500 }
        );
      }
      result = data;
    } else {
      const { data, error } = await supabase
        .from('doctor_branch_assignments')
        .insert({
          chain_id: chainId,
          doctor_id,
          branch_ids: validBranchIds,
          schedule: {},
          is_active: true,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating assignment:', error);
        return NextResponse.json(
          { error: 'Failed to create assignment.' },
          { status: 500 }
        );
      }
      result = data;
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body.' },
      { status: 400 }
    );
  }
}
