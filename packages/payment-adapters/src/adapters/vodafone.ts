/**
 * Vodafone Cash Business API Adapter
 *
 * Initiates mobile-wallet payment requests to Vodafone Cash.
 * The patient receives a USSD push on their phone to confirm payment.
 *
 * Environment variables:
 *   VF_BASE_URL     — Vodafone Cash API base URL
 *   VF_MERCHANT_ID  — Merchant ID from Vodafone Business portal
 *   VF_API_PASSWORD — API password / secret
 */

import { createHmac } from 'crypto';
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

const getBaseUrl = () => env('VF_BASE_URL');
const getMerchantId = () => env('VF_MERCHANT_ID');
const getApiPassword = () => env('VF_API_PASSWORD');

// ─── Adapter ──────────────────────────────────────────────────────────────────

export class VodafoneCashAdapter implements PaymentAdapter {
  async createPayment(req: CreatePaymentRequest): Promise<CreatePaymentResult> {
    try {
      const body = {
        merchantId: getMerchantId(),
        password: getApiPassword(),
        merchantRefNum: req.order_reference,
        customerMsisdn: req.customer_phone,
        amount: req.amount_egp.toFixed(2),
        currency: req.currency,
        description: req.description_en,
        callbackUrl: req.webhook_url,
      };

      const res = await fetch(`${getBaseUrl()}/api/v1/payments/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = (await res.json()) as {
        success?: boolean;
        statusCode?: string;
        statusMessage?: string;
        transactionId?: string;
        expiryDate?: string;
      };

      if (!data.success && data.statusCode !== '200') {
        return {
          success: false,
          providerOrderId: req.order_reference,
          error: data.statusMessage || 'Vodafone Cash payment initiation failed',
        };
      }

      return {
        success: true,
        providerOrderId: data.transactionId || req.order_reference,
        expiresAt: data.expiryDate || new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        // No paymentUrl — VF Cash uses USSD push to the customer's phone
      };
    } catch (err) {
      return {
        success: false,
        providerOrderId: req.order_reference,
        error: err instanceof Error ? err.message : 'Vodafone Cash payment failed',
      };
    }
  }

  async verifyPayment(providerOrderId: string): Promise<PaymentVerificationResult> {
    try {
      const res = await fetch(`${getBaseUrl()}/api/v1/payments/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantId: getMerchantId(),
          password: getApiPassword(),
          transactionId: providerOrderId,
        }),
      });

      const data = (await res.json()) as {
        statusCode?: string;
        statusMessage?: string;
        transactionStatus?: string;
        amount?: number;
        completedAt?: string;
      };

      const paid = data.transactionStatus === 'COMPLETED';

      return {
        paid,
        amount_egp: data.amount || 0,
        providerOrderId,
        paidAt: paid ? data.completedAt : undefined,
        paymentMethod: 'vodafone_cash',
        error: paid ? undefined : data.statusMessage,
      };
    } catch (err) {
      return {
        paid: false,
        amount_egp: 0,
        providerOrderId,
        paymentMethod: 'vodafone_cash',
        error: err instanceof Error ? err.message : 'Verification failed',
      };
    }
  }

  async refund(providerOrderId: string, amount_egp?: number): Promise<RefundResult> {
    try {
      const body: Record<string, unknown> = {
        merchantId: getMerchantId(),
        password: getApiPassword(),
        transactionId: providerOrderId,
      };

      if (amount_egp !== undefined) {
        body.refundAmount = amount_egp.toFixed(2);
      }

      const res = await fetch(`${getBaseUrl()}/api/v1/payments/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = (await res.json()) as {
        success?: boolean;
        statusCode?: string;
        statusMessage?: string;
        refundTransactionId?: string;
      };

      return {
        success: data.success || data.statusCode === '200',
        refundReference: data.refundTransactionId,
        error: data.success ? undefined : data.statusMessage,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Refund failed',
      };
    }
  }

  // ─── Webhook verification ────────────────────────────────────────────────

  /**
   * Verify an incoming Vodafone Cash webhook callback.
   * Computes HMAC-SHA256 of the sorted payload fields using the API password.
   */
  static verifyWebhookSignature(payload: Record<string, string>): boolean {
    const receivedHash = payload['signature'];
    if (!receivedHash) return false;

    const fieldsToSign = { ...payload };
    delete fieldsToSign['signature'];

    const sortedKeys = Object.keys(fieldsToSign).sort();
    const raw = sortedKeys.map((k) => `${k}=${fieldsToSign[k]}`).join('&');

    const expected = createHmac('sha256', getApiPassword()).update(raw).digest('hex');
    return expected === receivedHash;
  }
}
