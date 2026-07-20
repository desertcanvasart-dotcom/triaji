import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createHmac } from 'crypto';
import { PaymobAdapter } from '../src/adapters/paymob';

const HMAC_SECRET = 'test-hmac-secret';

/** The 20 HMAC fields in Paymob's documented lexicographic order —
 *  re-listed independently so a regression in the adapter fails these tests. */
const HMAC_FIELDS = [
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
] as const;

function webhookHmac(payload: Record<string, unknown>): string {
  const concatenated = HMAC_FIELDS.map((field) => {
    let value: unknown = payload;
    for (const part of field.split('.')) {
      value = (value as Record<string, unknown>)?.[part];
    }
    return String(value ?? '');
  }).join('');
  return createHmac('sha512', HMAC_SECRET).update(concatenated).digest('hex');
}

const SUCCESS_PAYLOAD = {
  amount_cents: 35000,
  created_at: '2026-07-16T20:00:00.000000',
  currency: 'EGP',
  error_occured: false,
  has_parent_transaction: false,
  id: 123456789,
  integration_id: 44556,
  is_3d_secure: true,
  is_auth: false,
  is_capture: false,
  is_refunded: false,
  is_standalone_payment: true,
  is_voided: false,
  order: { id: 987654 },
  owner: 42,
  pending: false,
  source_data: { pan: '2346', sub_type: 'MasterCard', type: 'card' },
  success: true,
};

beforeEach(() => {
  process.env.PAYMOB_API_KEY = 'test-api-key';
  process.env.PAYMOB_INTEGRATION_ID = '44556';
  process.env.PAYMOB_IFRAME_ID = '77889';
  process.env.PAYMOB_HMAC_SECRET = HMAC_SECRET;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PaymobAdapter.verifyWebhookSignature', () => {
  it('accepts a correctly signed webhook (incl. nested order.id / source_data fields)', () => {
    const hmac = webhookHmac(SUCCESS_PAYLOAD);
    expect(PaymobAdapter.verifyWebhookSignature(SUCCESS_PAYLOAD, hmac)).toBe(true);
  });

  it('rejects when amount_cents was tampered with', () => {
    const hmac = webhookHmac(SUCCESS_PAYLOAD);
    const tampered = { ...SUCCESS_PAYLOAD, amount_cents: 100 };
    expect(PaymobAdapter.verifyWebhookSignature(tampered, hmac)).toBe(false);
  });

  it('rejects when a failed transaction is forged to success', () => {
    const failedHmac = webhookHmac({ ...SUCCESS_PAYLOAD, success: false });
    expect(PaymobAdapter.verifyWebhookSignature(SUCCESS_PAYLOAD, failedHmac)).toBe(false);
  });

  it('rejects when the nested order id was swapped', () => {
    const hmac = webhookHmac(SUCCESS_PAYLOAD);
    const tampered = { ...SUCCESS_PAYLOAD, order: { id: 111111 } };
    expect(PaymobAdapter.verifyWebhookSignature(tampered, hmac)).toBe(false);
  });

  it('rejects an empty signature', () => {
    expect(PaymobAdapter.verifyWebhookSignature(SUCCESS_PAYLOAD, '')).toBe(false);
  });

  it('treats missing fields as empty strings (documented Paymob behavior)', () => {
    const sparse = { amount_cents: 35000, success: true };
    const hmac = webhookHmac(sparse);
    expect(PaymobAdapter.verifyWebhookSignature(sparse, hmac)).toBe(true);
  });
});

describe('PaymobAdapter.createPayment', () => {
  const request = {
    amount_egp: 99.99,
    currency: 'EGP' as const,
    order_reference: 'booking-xyz-789',
    description_ar: 'كشف عيادة',
    description_en: 'Clinic visit',
    customer_name: 'Mona Hassan',
    customer_phone: '01098765432',
    return_url: 'https://app.test/ar/pay/success',
    webhook_url: 'https://app.test/api/webhooks/paymob',
  };

  it('runs the 3-step flow and builds the iframe URL (amount converted to cents)', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ json: async () => ({ token: 'auth-tok' }) })
      .mockResolvedValueOnce({ json: async () => ({ id: 987654 }) })
      .mockResolvedValueOnce({ json: async () => ({ token: 'payment-key-tok' }) });
    vi.stubGlobal('fetch', fetchMock);

    const result = await new PaymobAdapter().createPayment(request);

    expect(result.success).toBe(true);
    expect(result.providerOrderId).toBe('987654');
    expect(result.paymentUrl).toBe(
      'https://accept.paymob.com/api/acceptance/iframes/77889?payment_token=payment-key-tok',
    );

    // 99.99 EGP must reach Paymob as exactly 9999 cents in both order and payment key
    const orderBody = JSON.parse(fetchMock.mock.calls[1]![1].body as string);
    expect(orderBody.amount_cents).toBe(9999);
    expect(orderBody.merchant_order_id).toBe('booking-xyz-789');
    const keyBody = JSON.parse(fetchMock.mock.calls[2]![1].body as string);
    expect(keyBody.amount_cents).toBe(9999);
    expect(keyBody.integration_id).toBe(44556);
  });

  it('maps an auth failure to success: false instead of throwing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));

    const result = await new PaymobAdapter().createPayment(request);
    expect(result.success).toBe(false);
    expect(result.providerOrderId).toBe('booking-xyz-789');
    expect(result.error).toBe('ECONNREFUSED');
  });
});

describe('PaymobAdapter.verifyPayment', () => {
  it('maps is_paid and converts cents back to EGP', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ json: async () => ({ token: 'auth-tok' }) })
      .mockResolvedValueOnce({
        json: async () => ({
          id: 987654,
          is_paid: true,
          paid_amount_cents: 9999,
          payment_method: 'card',
          created_at: '2026-07-16T20:00:00Z',
        }),
      }));

    const result = await new PaymobAdapter().verifyPayment('987654');
    expect(result.paid).toBe(true);
    expect(result.amount_egp).toBeCloseTo(99.99);
    expect(result.providerOrderId).toBe('987654');
  });

  it('reports unpaid orders as paid: false', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ json: async () => ({ token: 'auth-tok' }) })
      .mockResolvedValueOnce({
        json: async () => ({ id: 987654, is_paid: false, paid_amount_cents: 0 }),
      }));

    const result = await new PaymobAdapter().verifyPayment('987654');
    expect(result.paid).toBe(false);
    expect(result.amount_egp).toBe(0);
  });
});
