/**
 * POST /api/webhooks/fawry
 * Receives Fawry payment webhook callbacks.
 * Verifies HMAC signature, then delegates to shared processor.
 */

import { NextRequest, NextResponse } from 'next/server';
import { FawryAdapter } from '@triaji/payment-adapters';
import { processPaymentCompletion } from '@/lib/payments/process-webhook';

export const dynamic = 'force-dynamic';

// Fawry sends webhooks as POST with JSON body
export async function POST(request: NextRequest) {
  let payload: Record<string, string>;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Verify Fawry HMAC signature
  const receivedHash = payload.messageSignature;
  if (!receivedHash) {
    console.error('[webhook/fawry] Missing messageSignature');
    return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
  }

  const isValid = FawryAdapter.verifyWebhookSignature(
    {
      referenceNumber: payload.referenceNumber ?? '',
      merchantRefNum: payload.merchantRefNum ?? '',
      paymentAmount: payload.paymentAmount ?? '',
      orderAmount: payload.orderAmount ?? '',
      orderStatus: payload.orderStatus ?? '',
      paymentMethod: payload.paymentMethod ?? '',
      fawryFees: payload.fawryFees ?? '',
    },
    receivedHash,
  );

  if (!isValid) {
    console.error('[webhook/fawry] Invalid signature');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // Only process successful payments
  const status = payload.orderStatus?.toUpperCase();
  if (status !== 'PAID' && status !== 'NEW') {
    // Log non-success statuses but acknowledge receipt
    console.log('[webhook/fawry] Non-payment status:', status, 'ref:', payload.merchantRefNum);
    return NextResponse.json({ received: true });
  }

  if (status !== 'PAID') {
    return NextResponse.json({ received: true });
  }

  // Extract reference — merchantRefNum is our triaji_reference
  const triajiReference = payload.merchantRefNum;
  if (!triajiReference) {
    console.error('[webhook/fawry] Missing merchantRefNum');
    return NextResponse.json({ error: 'Missing reference' }, { status: 400 });
  }

  const result = await processPaymentCompletion(triajiReference, {
    providerOrderId: payload.referenceNumber ?? '',
    paymentMethod: `fawry_${payload.paymentMethod ?? 'unknown'}`,
    paidAt: new Date(),
    webhookPayload: payload,
  });

  if (!result.success) {
    console.error('[webhook/fawry] Processing failed:', result.error);
    // Still return 200 to avoid Fawry retries for known errors
    return NextResponse.json({ received: true, error: result.error });
  }

  return NextResponse.json({ received: true, success: true });
}
