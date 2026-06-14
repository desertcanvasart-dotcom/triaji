// ─── Payment Types ────────────────────────────────────────────────────────────

/** Supported payment gateway providers in Egypt. */
export type PaymentProvider = 'fawry' | 'paymob' | 'vodafone_cash';

/** Payment lifecycle status. */
export type PaymentStatus =
  | 'pending'      // Payment created, awaiting patient action
  | 'processing'   // Provider is processing the payment
  | 'paid'         // Payment confirmed
  | 'failed'       // Payment attempt failed
  | 'expired'      // Payment window expired (e.g. Fawry code not used)
  | 'refunded'     // Full refund issued
  | 'partially_refunded'; // Partial refund issued

/** What entity this payment is for. */
export type PayableType =
  | 'booking'      // Doctor appointment booking
  | 'consultation' // Telehealth consultation
  | 'lab_order'    // Lab test order
  | 'prescription' // Pharmacy prescription
  | 'clinic_invoice'; // Walk-in clinic invoice

/** Full payment transaction row — maps to `payment_transactions` DB table. */
export interface PaymentTransaction {
  id: string; // UUID
  tenant_id: string;
  patient_id: string;

  /** What this payment is for. */
  payable_type: PayableType;
  /** UUID of the related entity (booking, lab order, etc.). */
  payable_id: string;

  /** Payment provider used. */
  provider: PaymentProvider;
  /** Provider-side order / transaction ID. */
  provider_order_id: string;

  /** Amount in EGP. */
  amount_egp: number;
  currency: 'EGP';
  status: PaymentStatus;

  /** Fawry reference code (pay-at-retail). Null for other providers. */
  fawry_code?: string;
  /** Redirect URL for card payments (Paymob iframe, Fawry checkout). */
  payment_url?: string;

  /** When the payment link / code expires. */
  expires_at?: string;
  /** When payment was confirmed by the provider. */
  paid_at?: string;
  /** Payment method used (card, fawry_code, vodafone_cash, etc.). */
  payment_method?: string;

  /** Refund reference if refunded. */
  refund_reference?: string;
  /** Amount refunded (may differ from amount_egp for partial refunds). */
  refunded_amount_egp?: number;

  /** Arbitrary metadata (booking details, etc.). */
  metadata?: Record<string, string>;

  created_at: string;
  updated_at: string;
}
