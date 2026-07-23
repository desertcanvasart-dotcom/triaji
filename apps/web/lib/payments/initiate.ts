/**
 * Shared payment-initiation core.
 *
 * Creates a payment transaction with the chosen provider adapter and records
 * it in payment_transactions. Called in-process by the booking engine
 * (payment-pending bookings) and by POST /api/payments/initiate — the engine
 * previously reached the route over HTTP against its own base URL, paying an
 * extra network hop on every paid booking.
 */

import { createServerClient } from '@triaji/shared/supabase';
import {
  getPaymentAdapter,
  type PaymentProvider,
} from '@triaji/payment-adapters';
import type { CreatePaymentRequest } from '@triaji/payment-adapters';

// ─── Payable type → table mapping ──────────────────────────────────────────────

export type PayableType = 'booking' | 'clinic_invoice' | 'lab_invoice' | 'pharmacy_invoice' | 'insurance_copay';

export const VALID_PAYABLE_TYPES: PayableType[] = [
  'booking',
  'clinic_invoice',
  'lab_invoice',
  'pharmacy_invoice',
  'insurance_copay',
];

export const VALID_PROVIDERS: PaymentProvider[] = ['fawry', 'paymob', 'vodafone_cash'];

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

// ─── Core ──────────────────────────────────────────────────────────────────────

export interface InitiatePaymentParams {
  payableType: PayableType;
  payableId: string;
  provider: PaymentProvider;
  /** Overrides the payable's own amount (required for lab_invoice). */
  amountEgp?: number;
  returnUrl?: string;
}

export type InitiatePaymentResult =
  | {
      ok: true;
      reference: string;
      paymentUrl: string | null;
      fawryCode: string | null;
      expiresAt: string | null;
    }
  | { ok: false; status: number; error: string };

export async function initiatePayment(
  params: InitiatePaymentParams,
): Promise<InitiatePaymentResult> {
  // Never throws — callers (the HTTP route and the booking engine's
  // revert-on-failure path) both branch on `ok`.
  try {
    return await initiatePaymentInner(params);
  } catch (err) {
    console.error('[payments/initiate] Unexpected error:', err);
    return { ok: false, status: 500, error: 'Payment initiation failed' };
  }
}

async function initiatePaymentInner(
  params: InitiatePaymentParams,
): Promise<InitiatePaymentResult> {
  const supabase = createServerClient();

  // Look up payable to get amount + patient info
  const payable = await lookupPayable(supabase, params.payableType, params.payableId);
  if (!payable) {
    return { ok: false, status: 404, error: 'Payable not found' };
  }

  const amount = params.amountEgp ?? payable.amount_egp;
  if (!amount || amount <= 0) {
    return { ok: false, status: 400, error: 'Invalid payment amount' };
  }

  // Generate triaji_reference via RPC
  const { data: refData, error: refError } = await supabase.rpc('next_payment_reference');
  if (refError || !refData) {
    console.error('[payments/initiate] Failed to generate reference:', refError?.message);
    return { ok: false, status: 500, error: 'Failed to generate payment reference' };
  }

  const triajiReference = refData as string;

  // Determine return and webhook URLs
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://doctortrio.online';
  const returnUrl = params.returnUrl ?? `${baseUrl}/ar/pay/success?reference=${triajiReference}`;
  const webhookUrl = `${baseUrl}/api/webhooks/${params.provider === 'vodafone_cash' ? 'vodafone' : params.provider}`;

  // Call the payment adapter
  const adapter = getPaymentAdapter(params.provider);
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
      payable_type: params.payableType,
      payable_id: params.payableId,
    },
  };

  const result = await adapter.createPayment(paymentReq);

  if (!result.success) {
    console.error('[payments/initiate] Adapter error:', result.error);
    return { ok: false, status: 502, error: result.error ?? 'Payment provider error' };
  }

  // Create payment_transactions row
  const { error: insertError } = await supabase.from('payment_transactions').insert({
    payable_type: params.payableType,
    payable_id: params.payableId,
    patient_id: payable.patient_id,
    provider: params.provider,
    provider_order_id: result.providerOrderId,
    fawry_code: result.fawryCode ?? null,
    amount_egp: amount,
    currency: 'EGP',
    status: 'pending',
    triaji_reference: triajiReference,
  });

  if (insertError) {
    console.error('[payments/initiate] Failed to create transaction:', insertError.message);
    return { ok: false, status: 500, error: 'Failed to create payment record' };
  }

  return {
    ok: true,
    reference: triajiReference,
    paymentUrl: result.paymentUrl ?? null,
    fawryCode: result.fawryCode ?? null,
    expiresAt: result.expiresAt ?? null,
  };
}
