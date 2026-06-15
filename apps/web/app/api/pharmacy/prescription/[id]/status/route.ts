import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getServiceClient() {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/**
 * GET /api/pharmacy/prescription/[id]/status — public, returns status timeline for a routing record
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getServiceClient();

    const { data, error } = await supabase
      .from('prescription_routing')
      .select(`
        id, status, routed_at, received_at, stock_confirmation, ready_at, collected_at,
        pharmacy_tenant_id,
        tenants:pharmacy_tenant_id(name_ar, name_en)
      `)
      .eq('id', id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Prescription routing not found' }, { status: 404 });
    }

    // Build timeline
    const timeline: Array<{ step: string; label_ar: string; label_en: string; timestamp: string | null; completed: boolean }> = [
      {
        step: 'routed',
        label_ar: 'تم إرسال الوصفة',
        label_en: 'Prescription Sent',
        timestamp: data.routed_at,
        completed: !!data.routed_at,
      },
      {
        step: 'received',
        label_ar: 'تم الاستلام بالصيدلية',
        label_en: 'Received by Pharmacy',
        timestamp: data.received_at,
        completed: !!data.received_at,
      },
      {
        step: 'stock_checked',
        label_ar: 'تم فحص التوفر',
        label_en: 'Stock Checked',
        // prescription_routing has no stock_checked_at timestamp; completion is
        // signalled by the presence of the stock_confirmation JSONB.
        timestamp: null,
        completed: !!data.stock_confirmation,
      },
      {
        step: 'ready',
        label_ar: 'جاهزة للاستلام',
        label_en: 'Ready for Pickup',
        timestamp: data.ready_at,
        completed: !!data.ready_at,
      },
      {
        step: 'collected',
        label_ar: 'تم الاستلام',
        label_en: 'Collected',
        timestamp: data.collected_at,
        completed: !!data.collected_at,
      },
    ];

    return NextResponse.json({
      id: data.id,
      status: data.status,
      pharmacy: data.tenants,
      timeline,
    });
  } catch {
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
