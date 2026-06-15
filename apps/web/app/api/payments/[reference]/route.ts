/**
 * GET /api/payments/[reference]
 * Check payment status by Triajji reference.
 * NO AUTH REQUIRED — reference-as-token pattern (accessible from WhatsApp links).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@triaji/shared/supabase';

export const dynamic = 'force-dynamic';

// ─── GET Handler ───────────────────────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ reference: string }> },
) {
  const { reference } = await params;

  if (!reference) {
    return NextResponse.json({ error: 'reference is required' }, { status: 400 });
  }

  const supabase = createServerClient();

  const { data: txn, error } = await supabase
    .from('payment_transactions')
    .select(`
      id,
      triaji_reference,
      payable_type,
      payable_id,
      provider,
      provider_order_id,
      fawry_code,
      amount_egp,
      currency,
      status,
      initiated_at,
      completed_at,
      failed_at,
      expired_at,
      failure_reason,
      payment_method_detail,
      created_at
    `)
    .eq('triaji_reference', reference)
    .single();

  if (error || !txn) {
    return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
  }

  // Enrich with payable description
  let description_ar = '';
  let description_en = '';
  let providerName_ar = '';
  let providerName_en = '';

  switch (txn.payable_type) {
    case 'booking': {
      // `bookings` has no date_ar/time_ar columns (only appointment_datetime),
      // and `doctors` uses name_ar/name_en/title_ar (no full_name_* / title_en).
      const { data: booking } = await supabase
        .from('bookings')
        .select(`
          doctors:doctor_id ( name_ar, name_en, title_ar ),
          tenants:tenant_id ( name_ar, name_en )
        `)
        .eq('id', txn.payable_id)
        .single();

      if (booking) {
        const doctor = booking.doctors as unknown as Record<string, string> | null;
        const tenant = booking.tenants as unknown as Record<string, string> | null;
        description_ar = `حجز موعد — ${doctor?.title_ar ?? ''} ${doctor?.name_ar ?? ''}`;
        description_en = `Appointment — ${doctor?.name_en ?? ''}`;
        providerName_ar = tenant?.name_ar ?? '';
        providerName_en = tenant?.name_en ?? '';
      }
      break;
    }

    case 'clinic_invoice': {
      const { data: invoice } = await supabase
        .from('clinic_invoices')
        .select('invoice_number, tenants:tenant_id ( name_ar, name_en )')
        .eq('id', txn.payable_id)
        .single();

      if (invoice) {
        const tenant = invoice.tenants as unknown as Record<string, string> | null;
        description_ar = `فاتورة عيادة #${invoice.invoice_number}`;
        description_en = `Clinic invoice #${invoice.invoice_number}`;
        providerName_ar = tenant?.name_ar ?? '';
        providerName_en = tenant?.name_en ?? '';
      }
      break;
    }

    case 'pharmacy_invoice': {
      const { data: invoice } = await supabase
        .from('pharmacy_invoices')
        .select('invoice_number')
        .eq('id', txn.payable_id)
        .single();

      if (invoice) {
        description_ar = `فاتورة صيدلية #${invoice.invoice_number}`;
        description_en = `Pharmacy invoice #${invoice.invoice_number}`;
      }
      break;
    }

    case 'lab_invoice': {
      const { data: order } = await supabase
        .from('lab_order_routing')
        .select('order_number')
        .eq('id', txn.payable_id)
        .single();

      if (order) {
        description_ar = `فاتورة تحاليل #${order.order_number}`;
        description_en = `Lab invoice #${order.order_number}`;
      }
      break;
    }

    case 'insurance_copay': {
      description_ar = 'مشاركة تأمين';
      description_en = 'Insurance copay';
      break;
    }
  }

  return NextResponse.json({
    ...txn,
    description_ar,
    description_en,
    providerName_ar,
    providerName_en,
  });
}
