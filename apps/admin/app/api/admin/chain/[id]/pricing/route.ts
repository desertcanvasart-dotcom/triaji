import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin, requireChainAccess } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';

/**
 * GET /api/admin/chain/[id]/pricing — Chain pricing list
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

  const { data: pricing, error } = await supabase
    .from('chain_pricing')
    .select('*')
    .eq('chain_id', chainId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('Error fetching pricing:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pricing.' },
      { status: 500 }
    );
  }

  return NextResponse.json({ pricing: pricing ?? [] });
}

/**
 * POST /api/admin/chain/[id]/pricing — Add a price
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
      service_type,
      service_code,
      service_name_ar,
      service_name_en,
      price_egp,
      urgent_price_egp,
      applies_to_all_branches,
      branch_exceptions,
      effective_from,
      sort_order,
    } = body;

    if (!service_type || !service_name_ar || price_egp === undefined) {
      return NextResponse.json(
        { error: 'service_type, service_name_ar, and price_egp are required.' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('chain_pricing')
      .insert({
        chain_id: chainId,
        service_type,
        service_code: service_code ?? null,
        service_name_ar,
        service_name_en: service_name_en ?? null,
        price_egp,
        urgent_price_egp: urgent_price_egp ?? null,
        applies_to_all_branches: applies_to_all_branches ?? true,
        branch_exceptions: branch_exceptions ?? [],
        is_active: true,
        effective_from: effective_from ?? new Date().toISOString(),
        sort_order: sort_order ?? 0,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating price:', error);
      return NextResponse.json(
        { error: 'Failed to create price.' },
        { status: 500 }
      );
    }

    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body.' },
      { status: 400 }
    );
  }
}
