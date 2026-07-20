import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createHmac } from 'crypto';
import { FawryAdapter } from '../src/adapters/fawry';

const MERCHANT_CODE = 'MERCH123';
const SECURITY_KEY = 'test-secure-key';

/** Independent re-implementation of the Fawry webhook signature, so a
 *  regression in the adapter formula fails these tests. */
function webhookSignature(p: {
  referenceNumber: string;
  merchantRefNum: string;
  paymentAmount: string;
  orderAmount: string;
  orderStatus: string;
  paymentMethod: string;
  fawryFees: string;
}): string {
  const raw =
    p.referenceNumber +
    p.merchantRefNum +
    p.paymentAmount +
    p.orderAmount +
    p.orderStatus +
    p.paymentMethod +
    p.fawryFees +
    SECURITY_KEY;
  return createHmac('sha256', SECURITY_KEY).update(raw).digest('hex');
}

const PAID_PAYLOAD = {
  referenceNumber: 'FWR-987654',
  merchantRefNum: 'booking-abc-123',
  paymentAmount: '350.00',
  orderAmount: '350.00',
  orderStatus: 'PAID',
  paymentMethod: 'PAYATFAWRY',
  fawryFees: '5.00',
};

beforeEach(() => {
  process.env.FAWRY_BASE_URL = 'https://fawry.test';
  process.env.FAWRY_MERCHANT_CODE = MERCHANT_CODE;
  process.env.FAWRY_SECURITY_KEY = SECURITY_KEY;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('FawryAdapter.verifyWebhookSignature', () => {
  it('accepts a correctly signed webhook', () => {
    const hash = webhookSignature(PAID_PAYLOAD);
    expect(FawryAdapter.verifyWebhookSignature(PAID_PAYLOAD, hash)).toBe(true);
  });

  it('rejects when the payment amount was tampered with', () => {
    const hash = webhookSignature(PAID_PAYLOAD);
    const tampered = { ...PAID_PAYLOAD, paymentAmount: '1.00', orderAmount: '1.00' };
    expect(FawryAdapter.verifyWebhookSignature(tampered, hash)).toBe(false);
  });

  it('rejects when the order status was tampered with (UNPAID forged to PAID)', () => {
    const unpaidHash = webhookSignature({ ...PAID_PAYLOAD, orderStatus: 'UNPAID' });
    expect(FawryAdapter.verifyWebhookSignature(PAID_PAYLOAD, unpaidHash)).toBe(false);
  });

  it('rejects an empty or garbage signature', () => {
    expect(FawryAdapter.verifyWebhookSignature(PAID_PAYLOAD, '')).toBe(false);
    expect(FawryAdapter.verifyWebhookSignature(PAID_PAYLOAD, 'deadbeef')).toBe(false);
  });

  it('rejects a signature computed with a different key', () => {
    const raw =
      PAID_PAYLOAD.referenceNumber +
      PAID_PAYLOAD.merchantRefNum +
      PAID_PAYLOAD.paymentAmount +
      PAID_PAYLOAD.orderAmount +
      PAID_PAYLOAD.orderStatus +
      PAID_PAYLOAD.paymentMethod +
      PAID_PAYLOAD.fawryFees +
      'attacker-key';
    const forged = createHmac('sha256', 'attacker-key').update(raw).digest('hex');
    expect(FawryAdapter.verifyWebhookSignature(PAID_PAYLOAD, forged)).toBe(false);
  });
});

describe('FawryAdapter.createPayment', () => {
  const request = {
    amount_egp: 350,
    currency: 'EGP' as const,
    order_reference: 'booking-abc-123',
    description_ar: 'كشف عيادة',
    description_en: 'Clinic visit',
    customer_name: 'Ahmed Ali',
    customer_phone: '01012345678',
    return_url: 'https://app.test/ar/pay/success',
    webhook_url: 'https://app.test/api/webhooks/fawry',
  };

  it('signs the charge request and maps a successful response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({
        statusCode: 200,
        referenceNumber: 'FWR-987654',
        paymentURL: 'https://fawry.test/pay/xyz',
        expiryDate: 1760000000000,
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await new FawryAdapter().createPayment(request);

    expect(result.success).toBe(true);
    expect(result.paymentUrl).toBe('https://fawry.test/pay/xyz');
    expect(result.fawryCode).toBe('FWR-987654');
    expect(result.providerOrderId).toBe('FWR-987654');

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://fawry.test/ECommerceWeb/Fawry/payments/charge');
    const body = JSON.parse(init.body as string);
    expect(body.merchantCode).toBe(MERCHANT_CODE);
    expect(body.chargeItems[0].price).toBe(350);

    // Charge signature = HMAC(merchantCode + refNum + mobile + amount + currency + key)
    const expectedSig = createHmac('sha256', SECURITY_KEY)
      .update(MERCHANT_CODE + 'booking-abc-123' + '01012345678' + '350.00' + 'EGP' + SECURITY_KEY)
      .digest('hex');
    expect(body.signature).toBe(expectedSig);
  });

  it('maps a failed charge to success: false with the provider message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({ statusCode: 9946, statusDescription: 'Invalid signature' }),
    }));

    const result = await new FawryAdapter().createPayment(request);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid signature');
  });
});

describe('FawryAdapter.verifyPayment', () => {
  it('maps PAID status to paid: true with amount and timestamp', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({
        statusCode: 200,
        orderStatus: 'PAID',
        paymentAmount: 350,
        paymentMethod: 'PAYATFAWRY',
        paymentTime: 1760000000000,
      }),
    }));

    const result = await new FawryAdapter().verifyPayment('booking-abc-123');
    expect(result.paid).toBe(true);
    expect(result.amount_egp).toBe(350);
    expect(result.paidAt).toBe(new Date(1760000000000).toISOString());
  });

  it('maps any non-PAID status to paid: false', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({ statusCode: 200, orderStatus: 'UNPAID', statusDescription: 'Pending' }),
    }));

    const result = await new FawryAdapter().verifyPayment('booking-abc-123');
    expect(result.paid).toBe(false);
    expect(result.error).toBe('Pending');
  });
});
