/**
 * POST /api/payments/initiate
 * Create a new payment transaction and get the payment URL/code.
 *
 * NO AUTH REQUIRED — reference-as-token pattern (accessible from WhatsApp links).
 *
 * Body: { payable_type, payable_id, provider, amount_egp?, return_url? }
 * Returns: { reference, paymentUrl?, fawryCode?, expiresAt }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@triaji/shared/supabase';
import {
  getPaymentAdapter,
  type PaymentProvider,
} from '@triaji/payment-adapters';
import type { CreatePaymentRequest } from '@triaji/payment-adapters';

export const dynamic = 'force-dynamic';

// ─── Payable type → table mapping ──────────────────────────────────────────────

type PayableType = 'booking' | 'clinic_invoice' | 'lab_invoice' | 'pharmacy_invoice' | 'insurance_copay';

const VALID_PAYABLE_TYPES: PayableType[] = [
  'booking',
  'clinic_invoice',
  'lab_invoice',
  'pharmacy_invoice',
  'insurance_copay',
];

const VALID_PROVIDERS: PaymentProvider[] = ['fawry', 'paymob', 'vodafone_cash'];

interface PayableInfo {
  amount_egp: number;
  patient_id: string;
  patient_name: string;
  patient_phone: string;
  patient_email?: string;
  description_ar: string;
  description_en: string;
}

async function lookupPayable(
  supabase: ReturnType<typeof createServerClient>,
  payableType: PayableType,
  payableId: string,
): Promise<PayableInfo | null> {
  switch (payableType) {
    case 'booking': {
      // `bookings` has no fee_egp/patient_name/patient_phone columns:
      // the consultation fee is on doctors, and patient name/phone are on patients.
      const { data } = await supabase
        .from('bookings')
        .select(`
          patient_id,
          doctors:doctor_id ( name_ar, name_en, consultation_fee_egp ),
          patients:patient_id ( name_ar, phone_number )
        `)
        .eq('id', payableId)
        .single();

      if (!data) return null;
      const doctor = data.doctors as unknown as Record<string, string> | null;
      const patient = data.patients as unknown as Record<string, string> | null;
      return {
        amount_egp: Number(doctor?.consultation_fee_egp ?? 0),
        patient_id: data.patient_id,
        patient_name: patient?.name_ar ?? '',
        patient_phone: patient?.phone_number ?? '',
        description_ar: `حجز موعد — ${doctor?.name_ar ?? ''}`,
        description_en: `Appointment — ${doctor?.name_en ?? ''}`,
      };
    }

    case 'clinic_invoice': {
      const { data } = await supabase
        .from('clinic_invoices')
        .select(`
          patient_pays_egp, patient_id, invoice_number,
          patients:patient_id ( name_ar, phone_number ),
          tenants:tenant_id ( name_ar, name_en )
        `)
        .eq('id', payableId)
        .single();

      if (!data) return null;
      const patient = data.patients as unknown as Record<string, string> | null;
      const tenant = data.tenants as unknown as Record<string, string> | null;
      return {
        amount_egp: data.patient_pays_egp,
        patient_id: data.patient_id,
        patient_name: patient?.name_ar ?? '',
        patient_phone: patient?.phone_number ?? '',
        description_ar: `فاتورة عيادة — ${tenant?.name_ar ?? ''} #${data.invoice_number}`,
        description_en: `Clinic invoice — ${tenant?.name_en ?? ''} #${data.invoice_number}`,
      };
    }

    case 'pharmacy_invoice': {
      const { data } = await supabase
        .from('pharmacy_invoices')
        .select(`
          patient_pays_egp, patient_id, invoice_number,
          patients:patient_id ( name_ar, phone_number )
        `)
        .eq('id', payableId)
        .single();

      if (!data) return null;
      const patient = data.patients as unknown as Record<string, string> | null;
      return {
        amount_egp: data.patient_pays_egp,
        patient_id: data.patient_id,
        patient_name: patient?.name_ar ?? '',
        patient_phone: patient?.phone_number ?? '',
        description_ar: `فاتورة صيدلية #${data.invoice_number}`,
        description_en: `Pharmacy invoice #${data.invoice_number}`,
      };
    }

    case 'lab_invoice': {
      // lab_order_routing carries no price/order-number columns — identify the order
      // by chain_order_id (or the routing id) and require the caller to pass amount_egp.
      const { data } = await supabase
        .from('lab_order_routing')
        .select(`
          patient_id, chain_order_id,
          patients:patient_id ( name_ar, phone_number )
        `)
        .eq('id', payableId)
        .single();

      if (!data) return null;
      const patient = data.patients as unknown as Record<string, string> | null;
      const orderRef = data.chain_order_id ?? payableId;
      return {
        amount_egp: 0,
        patient_id: data.patient_id,
        patient_name: patient?.name_ar ?? '',
        patient_phone: patient?.phone_number ?? '',
        description_ar: `فاتورة تحاليل #${orderRef}`,
        description_en: `Lab invoice #${orderRef}`,
      };
    }

    case 'insurance_copay': {
      const { data } = await supabase
        .from('insurance_claims')
        .select(`
          patient_copay_egp, patient_id,
          patients:patient_id ( name_ar, phone_number )
        `)
        .eq('id', payableId)
        .single();

      if (!data) return null;
      const patient = data.patients as unknown as Record<string, string> | null;
      return {
        amount_egp: data.patient_copay_egp,
        patient_id: data.patient_id,
        patient_name: patient?.name_ar ?? '',
        patient_phone: patient?.phone_number ?? '',
        description_ar: 'مشاركة تأمين',
        description_en: 'Insurance copay',
      };
    }

    default:
      return null;
  }
}

// ─── POST Handler ──────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  let body: {
    payable_type?: string;
    payable_id?: string;
    provider?: string;
    amount_egp?: number;
    return_url?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Validate required fields
  if (!body.payable_type || !body.payable_id || !body.provider) {
    return NextResponse.json(
      { error: 'payable_type, payable_id, and provider are required' },
      { status: 400 },
    );
  }

  if (!VALID_PAYABLE_TYPES.includes(body.payable_type as PayableType)) {
    return NextResponse.json(
      { error: `Invalid payable_type. Must be one of: ${VALID_PAYABLE_TYPES.join(', ')}` },
      { status: 400 },
    );
  }

  if (!VALID_PROVIDERS.includes(body.provider as PaymentProvider)) {
    return NextResponse.json(
      { error: `Invalid provider. Must be one of: ${VALID_PROVIDERS.join(', ')}` },
      { status: 400 },
    );
  }

  const supabase = createServerClient();
  const payableType = body.payable_type as PayableType;
  const provider = body.provider as PaymentProvider;

  // Look up payable to get amount + patient info
  const payable = await lookupPayable(supabase, payableType, body.payable_id);
  if (!payable) {
    return NextResponse.json({ error: 'Payable not found' }, { status: 404 });
  }

  const amount = body.amount_egp ?? payable.amount_egp;
  if (!amount || amount <= 0) {
    return NextResponse.json({ error: 'Invalid payment amount' }, { status: 400 });
  }

  // Generate triaji_reference via RPC
  const { data: refData, error: refError } = await supabase.rpc('next_payment_reference');
  if (refError || !refData) {
    console.error('[payments/initiate] Failed to generate reference:', refError?.message);
    return NextResponse.json({ error: 'Failed to generate payment reference' }, { status: 500 });
  }

  const triajiReference = refData as string;

  // Determine return and webhook URLs
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://triajji.com';
  const returnUrl = body.return_url ?? `${baseUrl}/ar/pay/success?reference=${triajiReference}`;
  const webhookUrl = `${baseUrl}/api/webhooks/${provider === 'vodafone_cash' ? 'vodafone' : provider}`;

  // Call the payment adapter
  const adapter = getPaymentAdapter(provider);
  const paymentReq: CreatePaymentRequest = {
    amount_egp: amount,
    currency: 'EGP',
    order_reference: triajiReference,
    description_ar: payable.description_ar,
    description_en: payable.description_en,
    customer_name: payable.patient_name,
    customer_phone: payable.patient_phone,
    customer_email: payable.patient_email,
    return_url: returnUrl,
    webhook_url: webhookUrl,
    metadata: {
      payable_type: payableType,
      payable_id: body.payable_id,
    },
  };

  const result = await adapter.createPayment(paymentReq);

  if (!result.success) {
    console.error('[payments/initiate] Adapter error:', result.error);
    return NextResponse.json(
      { error: result.error ?? 'Payment provider error' },
      { status: 502 },
    );
  }

  // Create payment_transactions row
  const { error: insertError } = await supabase.from('payment_transactions').insert({
    payable_type: payableType,
    payable_id: body.payable_id,
    patient_id: payable.patient_id,
    provider,
    provider_order_id: result.providerOrderId,
    fawry_code: result.fawryCode ?? null,
    amount_egp: amount,
    currency: 'EGP',
    status: 'pending',
    triaji_reference: triajiReference,
  });

  if (insertError) {
    console.error('[payments/initiate] Failed to create transaction:', insertError.message);
    return NextResponse.json({ error: 'Failed to create payment record' }, { status: 500 });
  }

  return NextResponse.json({
    reference: triajiReference,
    paymentUrl: result.paymentUrl ?? null,
    fawryCode: result.fawryCode ?? null,
    expiresAt: result.expiresAt ?? null,
  });
}
