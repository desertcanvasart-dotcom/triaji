/**
 * GET /api/chain/[slug]
 *
 * Public endpoint — returns chain info + branches for patient-facing chain profile page.
 * No auth required (public page).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@triaji/shared/supabase';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const supabase = createServerClient();

  // Fetch chain by slug
  const { data: chain, error: chainError } = await supabase
    .from('chains')
    .select('id, name_ar, name_en, slug, chain_type, logo_url, main_phone, main_email, website, primary_color, is_active')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (chainError || !chain) {
    return NextResponse.json({ error: 'Chain not found' }, { status: 404 });
  }

  // Fetch specialties for the chain (from chain_specialties or derived from branches)
  const { data: specialtyRows } = await supabase
    .from('chain_branches')
    .select('tenants!inner(specialty_ar)')
    .eq('chain_id', chain.id)
    .eq('is_active', true);

  const specialtiesSet = new Set<string>();
  if (specialtyRows) {
    for (const row of specialtyRows) {
      const t = row.tenants as unknown as { specialty_ar?: string } | null;
      if (t?.specialty_ar) specialtiesSet.add(t.specialty_ar);
    }
  }

  // Fetch active branches
  const { data: branchRows } = await supabase
    .from('chain_branches')
    .select(`
      tenant_id,
      branch_name,
      branch_name_en,
      branch_number,
      is_active,
      tenants!inner(
        slug,
        address_ar,
        address_en,
        phone,
        lat,
        lng,
        working_hours_ar,
        working_hours_en,
        tenant_type
      )
    `)
    .eq('chain_id', chain.id)
    .eq('is_active', true)
    .order('branch_number', { ascending: true });

  const branches = (branchRows ?? []).map((b) => {
    const tenant = b.tenants as unknown as Record<string, unknown> | null;
    return {
      tenant_id: b.tenant_id,
      branch_name: b.branch_name,
      branch_name_en: b.branch_name_en ?? null,
      branch_number: b.branch_number ?? 0,
      slug: (tenant?.slug as string) ?? null,
      address_ar: (tenant?.address_ar as string) ?? null,
      address_en: (tenant?.address_en as string) ?? null,
      phone: (tenant?.phone as string) ?? null,
      lat: (tenant?.lat as number) ?? null,
      lng: (tenant?.lng as number) ?? null,
      working_hours_ar: (tenant?.working_hours_ar as string) ?? null,
      working_hours_en: (tenant?.working_hours_en as string) ?? null,
      is_active: b.is_active,
      distance_km: null,
      tenant_type: (tenant?.tenant_type as string) ?? 'clinic',
    };
  });

  return NextResponse.json({
    chain: {
      ...chain,
      specialties: Array.from(specialtiesSet),
    },
    branches,
  });
}
