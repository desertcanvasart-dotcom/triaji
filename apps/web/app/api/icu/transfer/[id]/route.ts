/**
 * ICU Transfer Request Detail API
 *
 * GET  /api/icu/transfer/[id] — get transfer request details
 * PUT  /api/icu/transfer/[id] — update status (en_route, cancel)
 * Auth: requesting doctor only (match requesting_account_id)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { IcuTransferRequest } from '@triaji/shared/types/icu';
import { sendTransferStatusNotification } from '@/lib/icu/notifications';

export const dynamic = 'force-dynamic';

function getServiceClient() {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function extractToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7);
  return request.cookies.get('sb-access-token')?.value || null;
}

async function verifyRequestingDoctor(
  supabase: ReturnType<typeof getServiceClient>,
  token: string,
  transferId: string
): Promise<{ transfer: IcuTransferRequest; error?: string; status?: number } | { transfer?: never; error: string; status: number }> {
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) {
    return { error: 'Invalid session', status: 401 };
  }

  const { data: doctorAccount } = await supabase
    .from('doctor_accounts')
    .select('id')
    .eq('user_id', userData.user.id)
    .single();

  if (!doctorAccount) {
    return { error: 'Doctor account required', status: 403 };
  }

  const { data: transfer, error: transferError } = await supabase
    .from('icu_transfer_requests')
    .select('*')
    .eq('id', transferId)
    .single();

  if (transferError || !transfer) {
    return { error: 'Transfer request not found', status: 404 };
  }

  if (transfer.requesting_account_id !== doctorAccount.id) {
    return { error: 'Not authorized to access this transfer', status: 403 };
  }

  return { transfer: transfer as IcuTransferRequest };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const token = extractToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getServiceClient();
    const result = await verifyRequestingDoctor(supabase, token, id);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const transfer = result.transfer!;

    // Enrich with unit + hospital info
    const { data: unitInfo } = await supabase
      .from('icu_units')
      .select('unit_name_ar, unit_name_en, phone_direct, tenant_id')
      .eq('id', transfer.icu_unit_id)
      .single();

    let hospitalName = '';
    if (unitInfo) {
      const { data: tenant } = await supabase
        .from('tenants')
        .select('name_ar, name_en')
        .eq('id', unitInfo.tenant_id)
        .single();
      hospitalName = tenant?.name_ar || '';
    }

    return NextResponse.json({
      transfer,
      unit: unitInfo
        ? {
            unit_name_ar: unitInfo.unit_name_ar,
            unit_name_en: unitInfo.unit_name_en,
            phone_direct: unitInfo.phone_direct,
          }
        : null,
      hospital_name: hospitalName,
    });
  } catch (err) {
    console.error('[ICU Transfer Detail] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const token = extractToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getServiceClient();
    const result = await verifyRequestingDoctor(supabase, token, id);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const body = await request.json();
    const { action } = body as { action: string };

    if (!['en_route', 'cancel'].includes(action)) {
      return NextResponse.json(
        { error: 'action must be "en_route" or "cancel"' },
        { status: 400 }
      );
    }

    const transfer = result.transfer!;

    // ── Validate state transitions ──────────────────────────────────────
    if (action === 'en_route') {
      if (transfer.status !== 'accepted') {
        return NextResponse.json(
          { error: 'Can only mark en_route when transfer is accepted' },
          { status: 400 }
        );
      }

      const { error: updateError } = await supabase
        .from('icu_transfer_requests')
        .update({
          status: 'en_route',
          en_route_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (updateError) {
        return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
      }

      // Notify receiving hospital
      try {
        const { data: tenant } = await supabase
          .from('tenants')
          .select('icu_coordinator_phone, preferred_lang')
          .eq('id', transfer.receiving_tenant_id)
          .single();

        if (tenant?.icu_coordinator_phone) {
          const lang = tenant.preferred_lang === 'en' ? 'en' : 'ar';
          await sendTransferStatusNotification(
            tenant.icu_coordinator_phone,
            lang,
            { status: 'en_route', patientName: transfer.patient_name_ar }
          );
        }
      } catch (notifErr) {
        console.error('[ICU Transfer] Status notification failed:', notifErr);
      }

      return NextResponse.json({ status: 'en_route' });
    }

    if (action === 'cancel') {
      if (['arrived', 'cancelled'].includes(transfer.status)) {
        return NextResponse.json(
          { error: 'Cannot cancel a transfer that is already arrived or cancelled' },
          { status: 400 }
        );
      }

      const { error: updateError } = await supabase
        .from('icu_transfer_requests')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (updateError) {
        return NextResponse.json({ error: 'Failed to cancel' }, { status: 500 });
      }

      return NextResponse.json({ status: 'cancelled' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    console.error('[ICU Transfer Detail] PUT error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
