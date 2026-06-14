import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin, requireChainAccess } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';

/**
 * PUT /api/admin/chain/[id]/pricing/[priceId] — Update price with branch exceptions
 * Auth: chain_owner
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; priceId: string }> }
) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;
  const { admin } = authResult;
  const { id: chainId, priceId } = await params;

  const chainCheck = requireChainAccess(admin, chainId);
  if (chainCheck) return chainCheck;

  try {
    const body = await request.json();
    const allowedFields = [
      'service_type', 'service_code', 'service_name_ar', 'service_name_en',
      'price_egp', 'urgent_price_egp', 'applies_to_all_branches',
      'branch_exceptions', 'effective_from', 'sort_order', 'is_active',
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

    const supabase = createAdminClient();

    // Verify the price belongs to this chain
    const { data: existing } = await supabase
      .from('chain_pricing')
      .select('id')
      .eq('id', priceId)
      .eq('chain_id', chainId)
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: 'Price not found in this chain.' },
        { status: 404 }
      );
    }

    const { data, error } = await supabase
      .from('chain_pricing')
      .update(updates)
      .eq('id', priceId)
      .select()
      .single();

    if (error) {
      console.error('Error updating price:', error);
      return NextResponse.json(
        { error: 'Failed to update price.' },
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
