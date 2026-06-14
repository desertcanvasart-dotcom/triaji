/**
 * POST /api/webhooks/vodafone
 * Receives Vodafone Cash payment webhook callbacks.
 * Verifies HMAC-SHA256 signature, then delegates to shared processor.
 */

import { NextRequest, NextResponse } from 'next/server';
import { VodafoneCashAdapter } from '@triaji/payment-adapters';
import { processPaymentCompletion } from '@/lib/payments/process-webhook';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  let payload: Record<string, string>;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Verify signature
  const isValid = VodafoneCashAdapter.verifyWebhookSignature(payload);
  if (!isValid) {
    console.error('[webhook/vodafone] Invalid signature');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // Check status
  const status = payload.status?.toUpperCase();
  if (status !== 'SUCCESS' && status !== 'PAID') {
    console.log('[webhook/vodafone] Non-success status:', status, 'ref:', payload.order_id);
    return NextResponse.json({ received: true });
  }

  // Extract our reference from the order_id / merchant_ref field
  const triajiReference = payload.merchant_ref ?? payload.order_id ?? '';
  if (!triajiReference) {
    console.error('[webhook/vodafone] Missing merchant_ref / order_id');
    return NextResponse.json({ error: 'Missing reference' }, { status: 400 });
  }

  const result = await processPaymentCompletion(triajiReference, {
    providerOrderId: payload.transaction_id ?? payload.order_id ?? '',
    paymentMethod: 'vodafone_cash',
    paidAt: new Date(),
    webhookPayload: payload,
  });

  if (!result.success) {
    console.error('[webhook/vodafone] Processing failed:', result.error);
    return NextResponse.json({ received: true, error: result.error });
  }

  return NextResponse.json({ received: true, success: true });
}
