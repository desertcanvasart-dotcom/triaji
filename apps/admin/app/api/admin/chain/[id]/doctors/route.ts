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

  // Get all doctors in these branches.
  // `doctors` has no `phone`/`specialty` columns: specialty name comes from the
  // embedded `specialties` row; phone (when present) lives on `doctor_accounts`.
  const { data: doctors, error } = await supabase
    .from('doctors')
    .select('id, name_ar, name_en, specialty_id, is_active, tenant_id, photo_url, specialties(name_ar, name_en)')
    .in('tenant_id', branchIds)
    .order('name_ar', { ascending: true });

  if (error) {
    console.error('Error fetching doctors:', error);
    return NextResponse.json(
      { error: 'Failed to fetch doctors.' },
      { status: 500 }
    );
  }

  const doctorIds = (doctors ?? []).map((d) => d.id);

  // Phone lives on doctor_accounts (not every directory doctor has an account).
  const { data: accounts } = doctorIds.length
    ? await supabase
        .from('doctor_accounts')
        .select('doctor_id, phone')
        .in('doctor_id', doctorIds)
    : { data: [] as { doctor_id: string; phone: string | null }[] };

  const phoneByDoctorId = new Map(
    (accounts ?? []).map((a) => [a.doctor_id, a.phone ?? null])
  );

  // Get branch assignments
  const { data: assignments } = await supabase
    .from('doctor_branch_assignments')
    .select('*')
    .eq('chain_id', chainId)
    .eq('is_active', true);

  // Map assignments to doctors
  const doctorsWithAssignments = (doctors ?? []).map((doc) => {
    const assignment = (assignments ?? []).find((a) => a.doctor_id === doc.id);
    // PostgREST may type the embedded relation as an array or object depending on inference.
    const specialtyRel = doc.specialties as unknown as
      | { name_ar: string; name_en: string | null }
      | { name_ar: string; name_en: string | null }[]
      | null;
    const specialty = Array.isArray(specialtyRel) ? (specialtyRel[0] ?? null) : specialtyRel;
    return {
      ...doc,
      specialty: specialty?.name_ar ?? null,
      specialty_en: specialty?.name_en ?? null,
      phone: phoneByDoctorId.get(doc.id) ?? null,
      branch_assignments: assignment?.branch_ids ?? [doc.tenant_id],
      schedule: assignment?.schedule ?? {},
    };
  });

  return NextResponse.json({
    doctors: doctorsWithAssignments,
    branches: branches ?? [],
  });
}
