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

  // Fetch branches (tenants with this chain_id). Governorate/address/phone live
  // on tenant_config (one row per tenant, joined by tenant_id) — embed it.
  const { data: branches, error } = await supabase
    .from('tenants')
    .select(`
      id, name_ar, name_en, is_active, created_at, tier,
      branch_name_ar, branch_name_en, branch_number,
      tenant_config (
        default_governorate_id,
        address_ar,
        address_en,
        clinic_phone,
        phone_number
      )
    `)
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
      // tenant_config embed returns an array — read [0].
      const cfg = Array.isArray(branch.tenant_config)
        ? branch.tenant_config[0] ?? null
        : (branch.tenant_config ?? null);
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

      const { tenant_config: _config, ...branchBase } = branch;

      return {
        ...branchBase,
        governorate_id: cfg?.default_governorate_id ?? null,
        address_ar: cfg?.address_ar ?? null,
        address_en: cfg?.address_en ?? null,
        phone: cfg?.clinic_phone ?? cfg?.phone_number ?? null,
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
      branch_number,
      address,
      address_ar,
      address_en,
      governorate_id,
      phone,
      latitude,
      longitude,
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

    // Generate a unique slug (tenants.slug is NOT NULL / unique).
    const slugBase =
      (branch_name_en || branch_name_ar)
        .toString()
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || 'branch';
    const slug = `${slugBase}-${Date.now().toString(36)}`;

    // Create the tenant (branch) with only real `tenants` columns.
    // Location/contact (governorate/address/phone) belong on tenant_config.
    const { data: newTenant, error: tenantError } = await supabase
      .from('tenants')
      .insert({
        name_ar: branch_name_ar,
        name_en: branch_name_en ?? branch_name_ar,
        slug,
        chain_id: chainId,
        branch_name_ar: branch_name_ar,
        branch_name_en: branch_name_en ?? null,
        branch_number: branch_number ?? null,
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

    // Persist location/contact on tenant_config. If copying from a source
    // branch, start from its config; otherwise start fresh. Then overlay any
    // governorate/address/phone/coords provided on this request.
    let configToWrite: Record<string, unknown> = { tenant_id: newTenant.id };

    if (copy_from_branch_id) {
      const { data: sourceConfig } = await supabase
        .from('tenant_config')
        .select('*')
        .eq('tenant_id', copy_from_branch_id)
        .single();

      if (sourceConfig) {
        const { id: _id, tenant_id: _tid, ...configToCopy } = sourceConfig;
        configToWrite = { ...configToCopy, tenant_id: newTenant.id };
      }
    }

    const resolvedAddressAr = address_ar ?? address ?? null;
    if (governorate_id != null) configToWrite.default_governorate_id = governorate_id;
    if (resolvedAddressAr != null) configToWrite.address_ar = resolvedAddressAr;
    if (address_en != null) configToWrite.address_en = address_en;
    if (phone != null) configToWrite.clinic_phone = phone;
    if (latitude != null) configToWrite.latitude = latitude;
    if (longitude != null) configToWrite.longitude = longitude;

    // Only write a config row if we have something beyond the tenant_id, or if
    // we copied from a source branch.
    if (Object.keys(configToWrite).length > 1) {
      const { error: configError } = await supabase
        .from('tenant_config')
        .upsert(configToWrite, { onConflict: 'tenant_id' });

      if (configError) {
        console.error('Error creating branch tenant_config:', configError);
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
