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

  // Branches are `tenants` rows carrying this chain_id. Location (lat/lng) and
  // specialty live on the per-tenant `tenant_config` row, embedded here. There
  // is no working-hours string column, so those fields are returned as null.
  const { data: branchRows } = await supabase
    .from('tenants')
    .select(`
      id,
      branch_name_ar,
      branch_name_en,
      branch_number,
      is_active,
      slug,
      address_ar,
      address_en,
      phone,
      tenant_config(
        latitude,
        longitude,
        clinic_specialty_ar
      )
    `)
    .eq('chain_id', chain.id)
    .eq('is_active', true)
    .order('branch_number', { ascending: true });

  const specialtiesSet = new Set<string>();
  const branches = (branchRows ?? []).map((b) => {
    const cfg = Array.isArray(b.tenant_config)
      ? (b.tenant_config[0] as Record<string, unknown> | undefined)
      : (b.tenant_config as Record<string, unknown> | null);
    const specialty = cfg?.clinic_specialty_ar as string | undefined;
    if (specialty) specialtiesSet.add(specialty);
    return {
      tenant_id: b.id,
      branch_name: b.branch_name_ar,
      branch_name_en: b.branch_name_en ?? null,
      branch_number: b.branch_number ?? 0,
      slug: (b.slug as string) ?? null,
      address_ar: (b.address_ar as string) ?? null,
      address_en: (b.address_en as string) ?? null,
      phone: (b.phone as string) ?? null,
      lat: (cfg?.latitude as number) ?? null,
      lng: (cfg?.longitude as number) ?? null,
      working_hours_ar: null,
      working_hours_en: null,
      is_active: b.is_active,
      distance_km: null,
      tenant_type: 'clinic',
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
