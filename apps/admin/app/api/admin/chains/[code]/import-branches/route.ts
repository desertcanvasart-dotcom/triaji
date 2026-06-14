/**
 * POST /api/admin/chains/[code]/import-branches
 *
 * Bulk import branches from JSON body.
 * Body: array of branch objects.
 * Upserts to lab_chain_branches.
 *
 * Auth: platform_admin
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateAdmin } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

const VALID_CHAIN_CODES = new Set(['alborg', 'almokhtabar', 'alfa']);

function getServiceClient() {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

interface BranchImport {
  name_ar: string;
  name_en?: string;
  address_ar: string;
  phone?: string;
  lat?: number;
  lng?: number;
  opening_time?: string;
  closing_time?: string;
  home_collection?: boolean;
  chain_branch_id?: string;
}

interface RouteContext {
  params: Promise<{ code: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  // Auth
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;
  const { admin } = authResult;

  if (admin.role !== 'platform_admin') {
    return NextResponse.json(
      { error: 'Platform admin access required' },
      { status: 403 }
    );
  }

  try {
    const { code } = await context.params;

    if (!VALID_CHAIN_CODES.has(code)) {
      return NextResponse.json(
        { error: `Invalid chain code: ${code}` },
        { status: 400 }
      );
    }

    const body = await request.json();

    // Accept array at top level or { branches: [...] }
    const branches: BranchImport[] = Array.isArray(body) ? body : (body.branches ?? []);

    if (branches.length === 0) {
      return NextResponse.json(
        { error: 'No branches provided. Expected an array of branch objects.' },
        { status: 400 }
      );
    }

    // Validate required fields
    for (let i = 0; i < branches.length; i++) {
      const b = branches[i]!;
      if (!b.name_ar || !b.address_ar) {
        return NextResponse.json(
          { error: `Branch at index ${i} is missing required fields (name_ar, address_ar)` },
          { status: 400 }
        );
      }
    }

    const supabase = getServiceClient();

    // Build records for upsert
    const records = branches.map((b) => ({
      chain_code: code,
      chain_branch_id: b.chain_branch_id ?? null,
      name_ar: b.name_ar,
      name_en: b.name_en ?? null,
      address_ar: b.address_ar,
      phone: b.phone ?? null,
      location:
        b.lat !== undefined && b.lng !== undefined
          ? `SRID=4326;POINT(${b.lng} ${b.lat})`
          : null,
      opening_time: b.opening_time ?? null,
      closing_time: b.closing_time ?? null,
      home_collection: b.home_collection ?? false,
      is_active: true,
    }));

    // Upsert — if chain_branch_id is provided, update existing
    const { data: upserted, error } = await supabase
      .from('lab_chain_branches')
      .upsert(records, {
        onConflict: 'chain_code,chain_branch_id',
        ignoreDuplicates: false,
      })
      .select('id, name_ar, chain_branch_id');

    if (error) {
      // Fallback: insert without upsert constraint
      const { data: inserted, error: insertErr } = await supabase
        .from('lab_chain_branches')
        .insert(records)
        .select('id, name_ar');

      if (insertErr) {
        return NextResponse.json(
          { error: `Import failed: ${insertErr.message}` },
          { status: 500 }
        );
      }

      // Update chain branch_count
      await supabase
        .from('lab_chains')
        .update({ branch_count: (inserted ?? []).length })
        .eq('code', code);

      return NextResponse.json({
        imported: (inserted ?? []).length,
        branches: inserted ?? [],
      });
    }

    // Update chain branch_count
    const { count: totalBranches } = await supabase
      .from('lab_chain_branches')
      .select('*', { count: 'exact', head: true })
      .eq('chain_code', code)
      .eq('is_active', true);

    await supabase
      .from('lab_chains')
      .update({ branch_count: totalBranches ?? 0 })
      .eq('code', code);

    return NextResponse.json({
      imported: (upserted ?? []).length,
      totalBranches: totalBranches ?? 0,
      branches: upserted ?? [],
    });
  } catch (err) {
    console.error('[import-branches] error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
