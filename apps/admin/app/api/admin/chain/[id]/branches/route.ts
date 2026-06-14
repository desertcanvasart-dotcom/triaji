import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin, requireChainAccess } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';

/**
 * GET /api/admin/chain/[id]/branches — List branches with today's stats
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

  // Fetch branches (tenants with this chain_id)
  const { data: branches, error } = await supabase
    .from('tenants')
    .select('id, name_ar, name_en, governorate_id, phone, is_active, created_at, tier')
    .eq('chain_id', chainId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching branches:', error);
    return NextResponse.json(
      { error: 'Failed to fetch branches.' },
      { status: 500 }
    );
  }

  // For each branch, get today's stats
  const today = new Date().toISOString().split('T')[0];
  const branchesWithStats = await Promise.all(
    (branches ?? []).map(async (branch) => {
      // Patient count today
      const { count: todayPatients } = await supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', branch.id)
        .gte('created_at', `${today}T00:00:00`)
        .lte('created_at', `${today}T23:59:59`);

      // Doctor count
      const { count: doctorCount } = await supabase
        .from('doctors')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', branch.id)
        .eq('is_active', true);

      // Today's revenue
      const { data: revenueData } = await supabase
        .from('invoices')
        .select('total_amount')
        .eq('tenant_id', branch.id)
        .gte('created_at', `${today}T00:00:00`)
        .lte('created_at', `${today}T23:59:59`)
        .eq('status', 'paid');

      const todayRevenue = (revenueData ?? []).reduce(
        (sum, inv) => sum + (inv.total_amount ?? 0),
        0
      );

      return {
        ...branch,
        today_patients: todayPatients ?? 0,
        doctor_count: doctorCount ?? 0,
        today_revenue: todayRevenue,
        status: branch.is_active ? 'active' : 'inactive',
      };
    })
  );

  return NextResponse.json({ branches: branchesWithStats });
}

/**
 * POST /api/admin/chain/[id]/branches — Add a new branch
 * Creates new tenant with chain_id, copies tenant_config from source if specified
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
    const {
      branch_name_ar,
      branch_name_en,
      address,
      governorate_id,
      phone,
      copy_from_branch_id,
      doctor_ids,
    } = body;

    if (!branch_name_ar) {
      return NextResponse.json(
        { error: 'branch_name_ar is required.' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Verify chain exists
    const { data: chain } = await supabase
      .from('chains')
      .select('id, chain_type')
      .eq('id', chainId)
      .single();

    if (!chain) {
      return NextResponse.json({ error: 'Chain not found.' }, { status: 404 });
    }

    // Determine tier from chain_type
    const tierMap: Record<string, string> = {
      clinic_chain: 'clinic',
      lab_chain: 'lab',
      radiology_chain: 'lab',
      pharmacy_chain: 'pharmacy',
      mixed: 'clinic',
    };
    const tier = tierMap[chain.chain_type] ?? 'clinic';

    // Create the tenant (branch)
    const { data: newTenant, error: tenantError } = await supabase
      .from('tenants')
      .insert({
        name_ar: branch_name_ar,
        name_en: branch_name_en ?? null,
        chain_id: chainId,
        address: address ?? null,
        governorate_id: governorate_id ?? null,
        phone: phone ?? null,
        tier,
        is_active: true,
      })
      .select()
      .single();

    if (tenantError || !newTenant) {
      console.error('Error creating branch tenant:', tenantError);
      return NextResponse.json(
        { error: 'Failed to create branch.' },
        { status: 500 }
      );
    }

    // Copy tenant_config from source branch if specified
    if (copy_from_branch_id) {
      const { data: sourceConfig } = await supabase
        .from('tenant_config')
        .select('*')
        .eq('tenant_id', copy_from_branch_id)
        .single();

      if (sourceConfig) {
        const { id: _id, tenant_id: _tid, ...configToCopy } = sourceConfig;
        await supabase
          .from('tenant_config')
          .upsert({
            ...configToCopy,
            tenant_id: newTenant.id,
          });
      }
    }

    // Assign doctors if provided
    if (doctor_ids && Array.isArray(doctor_ids) && doctor_ids.length > 0) {
      for (const doctorId of doctor_ids) {
        // Check if assignment exists
        const { data: existing } = await supabase
          .from('doctor_branch_assignments')
          .select('id, branch_ids')
          .eq('chain_id', chainId)
          .eq('doctor_id', doctorId)
          .single();

        if (existing) {
          // Add new branch to existing assignment
          const updatedBranchIds = [...new Set([...existing.branch_ids, newTenant.id])];
          await supabase
            .from('doctor_branch_assignments')
            .update({ branch_ids: updatedBranchIds })
            .eq('id', existing.id);
        } else {
          // Create new assignment
          await supabase
            .from('doctor_branch_assignments')
            .insert({
              chain_id: chainId,
              doctor_id: doctorId,
              branch_ids: [newTenant.id],
              schedule: {},
              is_active: true,
            });
        }
      }
    }

    return NextResponse.json(newTenant, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body.' },
      { status: 400 }
    );
  }
}
