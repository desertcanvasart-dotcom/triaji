/**
 * Fawry Accept API v2 Adapter
 * Docs: https://developer.fawrystaging.com
 *
 * Supports:
 * - Online card payment (redirect to Fawry checkout)
 * - Fawry reference code (pay at any Fawry retail point)
 *
 * Environment variables:
 *   FAWRY_BASE_URL       — e.g. https://atfawry.fawrystaging.com (staging) or https://atfawry.com (production)
 *   FAWRY_MERCHANT_CODE  — merchant code from Fawry dashboard
 *   FAWRY_SECURITY_KEY   — secret key for HMAC signature
 */

import { createHash } from 'crypto';
import type {
  PaymentAdapter,
  CreatePaymentRequest,
  CreatePaymentResult,
  PaymentVerificationResult,
  RefundResult,
} from '../interface';

// ─── Env helpers ──────────────────────────────────────────────────────────────

function env(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing env var: ${key}`);
  return val;
}

const getBaseUrl = () => env('FAWRY_BASE_URL');
const getMerchantCode = () => env('FAWRY_MERCHANT_CODE');
const getSecurityKey = () => env('FAWRY_SECURITY_KEY');

// ─── Signature helpers ────────────────────────────────────────────────────────

/**
 * Build the signature for a charge request.
 * Fawry v2 uses a plain SHA-256 digest (NOT HMAC) of the concatenated fields
 * with the secure key appended:
 *   SHA256(merchantCode + merchantRefNum + customerMobile + amount + currencyCode + secureKey)
 */
function buildChargeSignature(
  merchantRefNum: string,
  customerMobile: string,
  amount: string,
  currencyCode: string,
): string {
  const raw =
    getMerchantCode() +
    merchantRefNum +
    customerMobile +
    amount +
    currencyCode +
    getSecurityKey();
  return createHash('sha256').update(raw).digest('hex');
}

/**
 * Build the signature for a status query.
 * Fawry status signature = SHA256(merchantCode + merchantRefNum + secureKey) — plain SHA-256, not HMAC.
 */
function buildStatusSignature(merchantRefNum: string): string {
  const raw = getMerchantCode() + merchantRefNum + getSecurityKey();
  return createHash('sha256').update(raw).digest('hex');
}

// ─── Adapter ──────────────────────────────────────────────────────────────────

export class FawryAdapter implements PaymentAdapter {
  async createPayment(req: CreatePaymentRequest): Promise<CreatePaymentResult> {
    const amountStr = req.amount_egp.toFixed(2);

    const signature = buildChargeSignature(
      req.order_reference,
      req.customer_phone,
      amountStr,
      req.currency,
    );

    const body = {
      merchantCode: getMerchantCode(),
      merchantRefNum: req.order_reference,
      customerMobile: req.customer_phone,
      customerEmail: req.customer_email || '',
      customerName: req.customer_name,
      paymentExpiry: Date.now() + 24 * 60 * 60 * 1000, // 24h from now
      chargeItems: [
        {
          itemId: req.order_reference,
          description: req.description_en,
          price: parseFloat(amountStr),
          quantity: 1,
        },
      ],
      returnUrl: req.return_url,
      authCaptureModePayment: false,
      currencyCode: req.currency,
      signature,
    };

    const res = await fetch(`${getBaseUrl()}/ECommerceWeb/Fawry/payments/charge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = (await res.json()) as {
      statusCode?: number;
      statusDescription?: string;
      referenceNumber?: string;
      merchantRefNumber?: string;
      paymentURL?: string;
      expiryDate?: number;
    };

    if (data.statusCode !== 200) {
      return {
        success: false,
        providerOrderId: data.merchantRefNumber || req.order_reference,
        error: data.statusDescription || 'Fawry charge failed',
      };
    }

    return {
      success: true,
      paymentUrl: data.paymentURL,
      fawryCode: data.referenceNumber,
      expiresAt: data.expiryDate ? new Date(data.expiryDate).toISOString() : undefined,
      providerOrderId: data.referenceNumber || req.order_reference,
    };
  }

  async verifyPayment(providerOrderId: string): Promise<PaymentVerificationResult> {
    const signature = buildStatusSignature(providerOrderId);

    const url = new URL(`${getBaseUrl()}/ECommerceWeb/Fawry/payments/status/v2`);
    url.searchParams.set('merchantCode', getMerchantCode());
    url.searchParams.set('merchantRefNumber', providerOrderId);
    url.searchParams.set('signature', signature);

    const res = await fetch(url.toString(), { method: 'GET' });
    const data = (await res.json()) as {
      statusCode?: number;
      statusDescription?: string;
      orderStatus?: string;
      paymentAmount?: number;
      paymentMethod?: string;
      paymentTime?: number;
    };

    const paid = data.orderStatus === 'PAID';

    return {
      paid,
      amount_egp: data.paymentAmount || 0,
      providerOrderId,
      paidAt: data.paymentTime ? new Date(data.paymentTime).toISOString() : undefined,
      paymentMethod: data.paymentMethod || 'unknown',
      error: paid ? undefined : data.statusDescription,
    };
  }

  async refund(providerOrderId: string, amount_egp?: number): Promise<RefundResult> {
    const refundAmount = amount_egp?.toFixed(2);
    const raw =
      getMerchantCode() +
      providerOrderId +
      (refundAmount || '') +
      getSecurityKey();
    // Fawry refund signature is a plain SHA-256 digest, not HMAC.
    const signature = createHash('sha256').update(raw).digest('hex');

    const body: Record<string, unknown> = {
      merchantCode: getMerchantCode(),
      referenceNumber: providerOrderId,
      reason: 'Patient refund via Triaji',
      signature,
    };

    if (refundAmount) {
      body.refundAmount = parseFloat(refundAmount);
    }

    const res = await fetch(`${getBaseUrl()}/ECommerceWeb/Fawry/payments/refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = (await res.json()) as {
      statusCode?: number;
      statusDescription?: string;
    };

    return {
      success: data.statusCode === 200,
      refundReference: providerOrderId,
      error: data.statusCode !== 200 ? data.statusDescription : undefined,
    };
  }

  // ─── Webhook verification ────────────────────────────────────────────────

  /**
   * Verify the signature on an incoming Fawry server-to-server notification (V2).
   * The callback POST body contains a `messageSignature` field.
   *
   * Per Fawry's V2 docs the signature is a plain SHA-256 digest (NOT HMAC) of:
   *   fawryRefNumber + merchantRefNum + paymentAmount + orderAmount + orderStatus
   *   + paymentMethod + paymentReferenceNumber + secureKey
   * paymentReferenceNumber is empty for some notifications (e.g. order creation).
   * Note: fawryFees is intentionally NOT part of the signature.
   */
  static verifyWebhookSignature(
    payload: {
      referenceNumber: string;
      merchantRefNum: string;
      paymentAmount: string;
      orderAmount: string;
      orderStatus: string;
      paymentMethod: string;
      paymentReferenceNumber: string;
    },
    receivedHash: string,
  ): boolean {
    const raw =
      payload.referenceNumber +
      payload.merchantRefNum +
      payload.paymentAmount +
      payload.orderAmount +
      payload.orderStatus +
      payload.paymentMethod +
      payload.paymentReferenceNumber +
      getSecurityKey();
    const expected = createHash('sha256').update(raw).digest('hex');
    return expected === receivedHash;
  }
}
