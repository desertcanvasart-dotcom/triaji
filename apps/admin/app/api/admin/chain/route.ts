import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';

/**
 * POST /api/admin/chain — Create a new chain
 * Auth: platform_admin or a user creating their own chain (promoted to chain_owner)
 */
export async function POST(request: NextRequest) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;
  const { admin } = authResult;

  if (admin.role !== 'platform_admin' && admin.role !== 'chain_owner') {
    return NextResponse.json(
      { error: 'Forbidden. Only platform admins or chain owners can create chains.' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { name_ar, name_en, chain_type, slug } = body;

    if (!name_ar || !chain_type) {
      return NextResponse.json(
        { error: 'name_ar and chain_type are required.' },
        { status: 400 }
      );
    }

    const validTypes = ['clinic_chain', 'lab_chain', 'radiology_chain', 'pharmacy_chain', 'mixed'];
    if (!validTypes.includes(chain_type)) {
      return NextResponse.json(
        { error: `Invalid chain_type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Check slug uniqueness if provided
    if (slug) {
      const { data: existing } = await supabase
        .from('chains')
        .select('id')
        .eq('slug', slug)
        .single();
      if (existing) {
        return NextResponse.json(
          { error: 'A chain with this slug already exists.' },
          { status: 409 }
        );
      }
    }

    const { data: chain, error } = await supabase
      .from('chains')
      .insert({
        name_ar,
        name_en: name_en ?? null,
        chain_type,
        slug: slug ?? null,
        owner_account_id: admin.id,
        shared_pricing: true,
        shared_patient_records: true,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating chain:', error);
      return NextResponse.json(
        { error: 'Failed to create chain.' },
        { status: 500 }
      );
    }

    // Promote the creator to chain_owner if not already
    if (admin.role !== 'platform_admin') {
      await supabase
        .from('admin_users')
        .update({ role: 'chain_owner', chain_id: chain.id })
        .eq('id', admin.id);
    }

    return NextResponse.json(chain, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body.' },
      { status: 400 }
    );
  }
}
