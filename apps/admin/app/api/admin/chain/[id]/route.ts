import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin, requireChainAccess } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';

/**
 * GET /api/admin/chain/[id] — Chain details with branch count + stats
 * Auth: chain_owner or platform_admin
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

  // Fetch chain
  const { data: chain, error } = await supabase
    .from('chains')
    .select('*')
    .eq('id', chainId)
    .single();

  if (error || !chain) {
    return NextResponse.json({ error: 'Chain not found.' }, { status: 404 });
  }

  // Fetch branch count
  const { count: branchCount } = await supabase
    .from('tenants')
    .select('id', { count: 'exact', head: true })
    .eq('chain_id', chainId);

  // Fetch doctor count
  const { count: doctorCount } = await supabase
    .from('doctor_branch_assignments')
    .select('id', { count: 'exact', head: true })
    .eq('chain_id', chainId)
    .eq('is_active', true);

  // Fetch patient count
  const { count: patientCount } = await supabase
    .from('chain_patient_registry')
    .select('id', { count: 'exact', head: true })
    .eq('chain_id', chainId);

  return NextResponse.json({
    ...chain,
    branch_count: branchCount ?? 0,
    doctor_count: doctorCount ?? 0,
    patient_count: patientCount ?? 0,
  });
}

/**
 * PUT /api/admin/chain/[id] — Update chain settings
 * Auth: chain_owner
 */
export async function PUT(
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
    const allowedFields = [
      'name_ar', 'name_en', 'slug', 'logo_url', 'main_phone', 'main_email',
      'website', 'shared_pricing', 'shared_patient_records', 'primary_color',
    ];

    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (field in body) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update.' },
        { status: 400 }
      );
    }

    updates['updated_at'] = new Date().toISOString();

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('chains')
      .update(updates)
      .eq('id', chainId)
      .select()
      .single();

    if (error) {
      console.error('Error updating chain:', error);
      return NextResponse.json(
        { error: 'Failed to update chain.' },
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
