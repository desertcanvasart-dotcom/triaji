import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createHmac } from 'crypto';
import { VodafoneCashAdapter } from '../src/adapters/vodafone';

const API_PASSWORD = 'test-vf-password';

/** Independent re-implementation: HMAC-SHA256 over sorted key=value pairs
 *  joined with '&', excluding the signature field itself. */
function sign(payload: Record<string, string>): string {
  const raw = Object.keys(payload)
    .sort()
    .map((k) => `${k}=${payload[k]}`)
    .join('&');
  return createHmac('sha256', API_PASSWORD).update(raw).digest('hex');
}

const CALLBACK = {
  merchantRefNum: 'booking-abc-123',
  transactionId: 'VF-556677',
  transactionStatus: 'COMPLETED',
  amount: '350.00',
};

beforeEach(() => {
  process.env.VF_BASE_URL = 'https://vfcash.test';
  process.env.VF_MERCHANT_ID = 'VFMERCH1';
  process.env.VF_API_PASSWORD = API_PASSWORD;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('VodafoneCashAdapter.verifyWebhookSignature', () => {
  it('accepts a correctly signed callback', () => {
    const payload = { ...CALLBACK, signature: sign(CALLBACK) };
    expect(VodafoneCashAdapter.verifyWebhookSignature(payload)).toBe(true);
  });

  it('is independent of payload key order', () => {
    const signature = sign(CALLBACK);
    const reordered = {
      transactionStatus: 'COMPLETED',
      amount: '350.00',
      signature,
      transactionId: 'VF-556677',
      merchantRefNum: 'booking-abc-123',
    };
    expect(VodafoneCashAdapter.verifyWebhookSignature(reordered)).toBe(true);
  });

  it('rejects when the amount was tampered with', () => {
    const payload = { ...CALLBACK, amount: '1.00', signature: sign(CALLBACK) };
    expect(VodafoneCashAdapter.verifyWebhookSignature(payload)).toBe(false);
  });

  it('rejects when a FAILED status is forged to COMPLETED', () => {
    const failedSig = sign({ ...CALLBACK, transactionStatus: 'FAILED' });
    const payload = { ...CALLBACK, signature: failedSig };
    expect(VodafoneCashAdapter.verifyWebhookSignature(payload)).toBe(false);
  });

  it('rejects a callback with no signature field', () => {
    expect(VodafoneCashAdapter.verifyWebhookSignature({ ...CALLBACK })).toBe(false);
  });

  it('rejects a signature computed with the wrong password', () => {
    const raw = Object.keys(CALLBACK).sort()
      .map((k) => `${k}=${CALLBACK[k as keyof typeof CALLBACK]}`)
      .join('&');
    const forged = createHmac('sha256', 'attacker-password').update(raw).digest('hex');
    expect(VodafoneCashAdapter.verifyWebhookSignature({ ...CALLBACK, signature: forged })).toBe(false);
  });
});

describe('VodafoneCashAdapter.createPayment', () => {
  const request = {
    amount_egp: 350,
    currency: 'EGP' as const,
    order_reference: 'booking-abc-123',
    description_ar: 'كشف عيادة',
    description_en: 'Clinic visit',
    customer_name: 'Ahmed Ali',
    customer_phone: '01012345678',
    return_url: 'https://app.test/ar/pay/success',
    webhook_url: 'https://app.test/api/webhooks/vodafone',
  };

  it('initiates a USSD push payment and maps the transaction id', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ success: true, transactionId: 'VF-556677', expiryDate: '2026-07-16T21:00:00Z' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await new VodafoneCashAdapter().createPayment(request);

    expect(result.success).toBe(true);
    expect(result.providerOrderId).toBe('VF-556677');
    expect(result.paymentUrl).toBeUndefined(); // USSD push — no redirect URL

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
    expect(body.merchantId).toBe('VFMERCH1');
    expect(body.customerMsisdn).toBe('01012345678');
    expect(body.amount).toBe('350.00');
    expect(body.callbackUrl).toBe('https://app.test/api/webhooks/vodafone');
  });

  it('maps a declined initiation to success: false', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({ success: false, statusCode: '403', statusMessage: 'Wallet not found' }),
    }));

    const result = await new VodafoneCashAdapter().createPayment(request);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Wallet not found');
  });
});

describe('VodafoneCashAdapter.verifyPayment', () => {
  it('maps COMPLETED to paid: true', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({
        statusCode: '200',
        transactionStatus: 'COMPLETED',
        amount: 350,
        completedAt: '2026-07-16T20:30:00Z',
      }),
    }));

    const result = await new VodafoneCashAdapter().verifyPayment('VF-556677');
    expect(result.paid).toBe(true);
    expect(result.amount_egp).toBe(350);
    expect(result.paymentMethod).toBe('vodafone_cash');
  });

  it('maps PENDING to paid: false', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({ statusCode: '200', transactionStatus: 'PENDING', statusMessage: 'Awaiting confirmation' }),
    }));

    const result = await new VodafoneCashAdapter().verifyPayment('VF-556677');
    expect(result.paid).toBe(false);
    expect(result.error).toBe('Awaiting confirmation');
  });
});
