/**
 * Payment Adapter Interface
 * Every payment provider adapter must implement this interface.
 * Adding a new provider = creating a new class that implements PaymentAdapter.
 */

// ─── Request / Response Types ─────────────────────────────────────────────────

export interface CreatePaymentRequest {
  /** Amount in Egyptian Pounds (EGP). Integer piasters handled internally. */
  amount_egp: number;
  /** ISO 4217 currency code — always 'EGP' for now. */
  currency: 'EGP';
  /** Triaji-side order reference (e.g. booking UUID). */
  order_reference: string;
  /** Arabic description shown to patient. */
  description_ar: string;
  /** English description shown to patient. */
  description_en: string;
  /** Patient full name. */
  customer_name: string;
  /** Patient phone (Egyptian format, e.g. 01012345678). */
  customer_phone: string;
  /** Patient email — optional. */
  customer_email?: string;
  /** URL to redirect patient after payment completes. */
  return_url: string;
  /** URL the provider POSTs webhook notifications to. */
  webhook_url: string;
  /** Arbitrary metadata passed through the payment flow. */
  metadata?: Record<string, string>;
}

export interface CreatePaymentResult {
  success: boolean;
  /** URL to redirect the patient to for card / online payment. */
  paymentUrl?: string;
  /** Fawry reference code for pay-at-retail (Fawry only). */
  fawryCode?: string;
  /** When the payment link or code expires. */
  expiresAt?: string;
  /** Provider-side order / transaction ID. */
  providerOrderId: string;
  /** Error message when success = false. */
  error?: string;
}

export interface PaymentVerificationResult {
  /** Whether the payment has been completed. */
  paid: boolean;
  /** Confirmed amount in EGP. */
  amount_egp: number;
  /** Provider-side order / transaction ID. */
  providerOrderId: string;
  /** ISO timestamp of when payment was confirmed. */
  paidAt?: string;
  /** Method used: card, fawry_code, vodafone_cash, etc. */
  paymentMethod: string;
  /** Error message if verification failed. */
  error?: string;
}

export interface RefundResult {
  success: boolean;
  /** Provider-side refund reference. */
  refundReference?: string;
  /** Error message when success = false. */
  error?: string;
}

// ─── Adapter Interface ────────────────────────────────────────────────────────

export interface PaymentAdapter {
  /** Create a payment session / link / code. */
  createPayment(req: CreatePaymentRequest): Promise<CreatePaymentResult>;

  /** Verify whether a payment has been completed. */
  verifyPayment(providerOrderId: string): Promise<PaymentVerificationResult>;

  /** Issue a full or partial refund. */
  refund(providerOrderId: string, amount_egp?: number): Promise<RefundResult>;
}
