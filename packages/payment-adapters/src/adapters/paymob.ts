/**
 * Paymob Accept API Adapter
 * Docs: https://docs.paymob.com/docs/accept-standard-redirect
 *
 * Flow:
 *   1. POST /api/auth/tokens            → auth_token
 *   2. POST /api/ecommerce/orders       → order_id
 *   3. POST /api/acceptance/payment_keys → payment_key
 *   4. Redirect patient to iframe: https://accept.paymob.com/api/acceptance/iframes/{IFRAME_ID}?payment_token={payment_key}
 *
 * Environment variables:
 *   PAYMOB_API_KEY         — API key from Paymob dashboard
 *   PAYMOB_INTEGRATION_ID  — Integration ID for the payment method
 *   PAYMOB_IFRAME_ID       — iFrame ID from Paymob dashboard
 *   PAYMOB_HMAC_SECRET     — HMAC secret for webhook verification
 */

import { createHmac } from 'crypto';
import type {
  PaymentAdapter,
  CreatePaymentRequest,
  CreatePaymentResult,
  PaymentVerificationResult,
  RefundResult,
} from '../interface';

// ─── Constants ────────────────────────────────────────────────────────────────

const PAYMOB_BASE = 'https://accept.paymob.com';

function env(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing env var: ${key}`);
  return val;
}

const getApiKey = () => env('PAYMOB_API_KEY');
const getIntegrationId = () => env('PAYMOB_INTEGRATION_ID');
const getIframeId = () => env('PAYMOB_IFRAME_ID');
const getHmacSecret = () => env('PAYMOB_HMAC_SECRET');

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function authenticate(): Promise<string> {
  const res = await fetch(`${PAYMOB_BASE}/api/auth/tokens`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: getApiKey() }),
  });
  const data = (await res.json()) as { token: string };
  return data.token;
}

async function createOrder(
  authToken: string,
  amountCents: number,
  merchantOrderId: string,
  items: { name: string; amount_cents: number; quantity: number }[],
): Promise<number> {
  const res = await fetch(`${PAYMOB_BASE}/api/ecommerce/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      auth_token: authToken,
      delivery_needed: false,
      amount_cents: amountCents,
      currency: 'EGP',
      merchant_order_id: merchantOrderId,
      items,
    }),
  });
  const data = (await res.json()) as { id: number };
  return data.id;
}

async function getPaymentKey(
  authToken: string,
  orderId: number,
  amountCents: number,
  billingData: Record<string, string>,
  integrationId: string,
): Promise<string> {
  const res = await fetch(`${PAYMOB_BASE}/api/acceptance/payment_keys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      auth_token: authToken,
      amount_cents: amountCents,
      expiration: 3600, // 1 hour
      order_id: orderId,
      billing_data: billingData,
      currency: 'EGP',
      integration_id: parseInt(integrationId, 10),
    }),
  });
  const data = (await res.json()) as { token: string };
  return data.token;
}

// ─── Adapter ──────────────────────────────────────────────────────────────────

export class PaymobAdapter implements PaymentAdapter {
  async createPayment(req: CreatePaymentRequest): Promise<CreatePaymentResult> {
    try {
      const amountCents = Math.round(req.amount_egp * 100);

      // Step 1: Authenticate
      const authToken = await authenticate();

      // Step 2: Create order
      const orderId = await createOrder(authToken, amountCents, req.order_reference, [
        {
          name: req.description_en,
          amount_cents: amountCents,
          quantity: 1,
        },
      ]);

      // Step 3: Get payment key
      const nameParts = req.customer_name.split(' ');
      const billingData: Record<string, string> = {
        first_name: nameParts[0] || req.customer_name,
        last_name: nameParts.slice(1).join(' ') || req.customer_name,
        phone_number: req.customer_phone,
        email: req.customer_email || 'patient@triaji.com',
        apartment: 'N/A',
        floor: 'N/A',
        street: 'N/A',
        building: 'N/A',
        shipping_method: 'N/A',
        postal_code: 'N/A',
        city: 'Cairo',
        country: 'EG',
        state: 'Cairo',
      };

      const paymentKey = await getPaymentKey(
        authToken,
        orderId,
        amountCents,
        billingData,
        getIntegrationId(),
      );

      // Step 4: Build iframe URL
      const paymentUrl = `${PAYMOB_BASE}/api/acceptance/iframes/${getIframeId()}?payment_token=${paymentKey}`;

      return {
        success: true,
        paymentUrl,
        providerOrderId: String(orderId),
        expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
      };
    } catch (err) {
      return {
        success: false,
        providerOrderId: req.order_reference,
        error: err instanceof Error ? err.message : 'Paymob payment creation failed',
      };
    }
  }

  async verifyPayment(providerOrderId: string): Promise<PaymentVerificationResult> {
    try {
      const authToken = await authenticate();

      const res = await fetch(`${PAYMOB_BASE}/api/ecommerce/orders/${providerOrderId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
      });

      const data = (await res.json()) as {
        id: number;
        paid_amount_cents: number;
        is_paid: boolean;
        payment_method?: string;
        created_at?: string;
      };

      return {
        paid: data.is_paid,
        amount_egp: (data.paid_amount_cents || 0) / 100,
        providerOrderId: String(data.id),
        paidAt: data.is_paid ? data.created_at : undefined,
        paymentMethod: data.payment_method || 'card',
      };
    } catch (err) {
      return {
        paid: false,
        amount_egp: 0,
        providerOrderId,
        paymentMethod: 'unknown',
        error: err instanceof Error ? err.message : 'Verification failed',
      };
    }
  }

  async refund(providerOrderId: string, amount_egp?: number): Promise<RefundResult> {
    try {
      const authToken = await authenticate();

      const body: Record<string, unknown> = {
        auth_token: authToken,
        transaction_id: providerOrderId,
      };

      if (amount_egp !== undefined) {
        body.amount_cents = Math.round(amount_egp * 100);
      }

      const res = await fetch(`${PAYMOB_BASE}/api/acceptance/void_refund/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = (await res.json()) as {
        success: boolean;
        id?: number;
        message?: string;
      };

      return {
        success: data.success,
        refundReference: data.id ? String(data.id) : undefined,
        error: data.success ? undefined : data.message,
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
   * Verify the HMAC-SHA512 signature on an incoming Paymob webhook.
   * Paymob sends the HMAC in the `hmac` query parameter or header.
   *
   * The HMAC is computed over a lexicographically-sorted concatenation of
   * specific transaction response fields.
   */
  static verifyWebhookSignature(
    payload: Record<string, unknown>,
    hmacHeader: string,
  ): boolean {
    // Paymob HMAC fields — must be sorted alphabetically
    const hmacFields = [
      'amount_cents',
      'created_at',
      'currency',
      'error_occured',
      'has_parent_transaction',
      'id',
      'integration_id',
      'is_3d_secure',
      'is_auth',
      'is_capture',
      'is_refunded',
      'is_standalone_payment',
      'is_voided',
      'order.id',
      'owner',
      'pending',
      'source_data.pan',
      'source_data.sub_type',
      'source_data.type',
      'success',
    ];

    const concatenated = hmacFields
      .map((field) => {
        const parts = field.split('.');
        let value: unknown = payload;
        for (const part of parts) {
          value = (value as Record<string, unknown>)?.[part];
        }
        return String(value ?? '');
      })
      .join('');

    const expected = createHmac('sha512', getHmacSecret())
      .update(concatenated)
      .digest('hex');

    return expected === hmacHeader;
  }
}
