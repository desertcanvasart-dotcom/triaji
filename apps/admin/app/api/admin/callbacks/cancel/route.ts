/**
 * POST /api/admin/callbacks/cancel
 * Cancel a pending callback from the admin panel.
 * Used when an admin knows the patient already called back themselves.
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await request.json();
    const callbackId = body.callbackId;

    if (!callbackId || typeof callbackId !== 'string') {
      return NextResponse.json(
        { error: 'callbackId is required' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('callback_queue')
      .update({
        status: 'cancelled',
        notes: 'Cancelled by admin',
      })
      .eq('id', callbackId)
      .eq('status', 'scheduled')
      .select('id')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Callback not found or already processed' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: 'Failed to cancel callback' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, id: data.id });
  } catch {
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  }
}
