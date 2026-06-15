import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin, requireChainAccess } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';

/**
 * GET /api/admin/chain/[id]/patients — Chain-wide patient list from chain_patient_registry
 * Supports search + pagination
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
  const search = url.searchParams.get('search') ?? '';
  const page = parseInt(url.searchParams.get('page') ?? '1', 10);
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '20', 10), 100);
  const offset = (page - 1) * limit;

  const supabase = createAdminClient();

  // Query chain_patient_registry joined with patients
  let query = supabase
    .from('chain_patient_registry')
    .select(
      `
      id,
      patient_id,
      first_seen_at,
      first_branch_id,
      total_visits,
      last_visit_branch_id,
      last_visit_at,
      patients (
        id,
        name_ar,
        phone_number,
        patient_profiles ( date_of_birth, biological_sex )
      )
    `,
      { count: 'exact' }
    )
    .eq('chain_id', chainId)
    .order('last_visit_at', { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1);

  // Search filter — search patient name or phone via a text search
  // Note: cross-table text search is limited, so we filter post-query if needed
  const { data: registryData, count, error } = await query;

  if (error) {
    console.error('Error fetching patients:', error);
    return NextResponse.json(
      { error: 'Failed to fetch patients.' },
      { status: 500 }
    );
  }

  // Flatten and apply client-side search if term provided
  let patients = (registryData ?? []).map((entry) => {
    const patient = (entry as Record<string, unknown>).patients as Record<string, unknown> | null;
    // dob/sex live on patient_profiles (reverse embed → array); patients has neither,
    // and national_id is not stored anywhere in this schema.
    const profile = Array.isArray(patient?.patient_profiles)
      ? (patient!.patient_profiles[0] as Record<string, unknown> | undefined)
      : (patient?.patient_profiles as Record<string, unknown> | undefined);
    return {
      registry_id: entry.id,
      patient_id: entry.patient_id,
      name: patient?.name_ar ?? null,
      phone: patient?.phone_number ?? null,
      date_of_birth: profile?.date_of_birth ?? null,
      gender: profile?.biological_sex ?? null,
      first_seen_at: entry.first_seen_at,
      first_branch_id: entry.first_branch_id,
      total_visits: entry.total_visits,
      last_visit_branch_id: entry.last_visit_branch_id,
      last_visit_at: entry.last_visit_at,
    };
  });

  if (search) {
    const searchLower = search.toLowerCase();
    patients = patients.filter(
      (p) =>
        (p.name && String(p.name).toLowerCase().includes(searchLower)) ||
        (p.phone && String(p.phone).includes(search))
    );
  }

  // Get branch names for display
  const branchIds = [
    ...new Set(
      patients
        .flatMap((p) => [p.first_branch_id, p.last_visit_branch_id])
        .filter(Boolean)
    ),
  ];

  let branches: Record<string, string> = {};
  if (branchIds.length > 0) {
    const { data: branchData } = await supabase
      .from('tenants')
      .select('id, name_ar')
      .in('id', branchIds);

    branches = (branchData ?? []).reduce(
      (acc, b) => ({ ...acc, [b.id]: b.name_ar }),
      {} as Record<string, string>
    );
  }

  return NextResponse.json({
    patients,
    branches,
    pagination: {
      page,
      limit,
      total: count ?? 0,
      total_pages: Math.ceil((count ?? 0) / limit),
    },
  });
}
