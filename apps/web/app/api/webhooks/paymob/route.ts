/**
 * POST /api/webhooks/paymob
 * Receives Paymob payment webhook callbacks.
 * Verifies HMAC-SHA512 signature, then delegates to shared processor.
 */

import { NextRequest, NextResponse } from 'next/server';
import { PaymobAdapter } from '@triaji/payment-adapters';
import { processPaymentCompletion } from '@/lib/payments/process-webhook';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  let payload: Record<string, unknown>;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Paymob sends HMAC in query parameter or header
  const hmac =
    request.nextUrl.searchParams.get('hmac') ??
    request.headers.get('x-hmac') ??
    '';

  if (!hmac) {
    console.error('[webhook/paymob] Missing HMAC');
    return NextResponse.json({ error: 'Missing HMAC' }, { status: 401 });
  }

  // Verify HMAC-SHA512 signature
  const isValid = PaymobAdapter.verifyWebhookSignature(payload, hmac);
  if (!isValid) {
    console.error('[webhook/paymob] Invalid HMAC signature');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // Extract transaction details from Paymob callback
  const obj = payload.obj as Record<string, unknown> | undefined;
  const txnPayload = obj ?? payload;

  const success = txnPayload.success === true || txnPayload.success === 'true';
  if (!success) {
    console.log('[webhook/paymob] Non-success transaction:', txnPayload.id);
    return NextResponse.json({ received: true });
  }

  // Extract our reference from order merchant_order_id
  const order = txnPayload.order as Record<string, unknown> | undefined;
  const triajiReference =
    (order?.merchant_order_id as string) ??
    (txnPayload.merchant_order_id as string) ??
    '';

  if (!triajiReference) {
    console.error('[webhook/paymob] Missing merchant_order_id');
    return NextResponse.json({ error: 'Missing reference' }, { status: 400 });
  }

  // Determine payment method from source_data
  const sourceData = txnPayload.source_data as Record<string, string> | undefined;
  const paymentMethod = sourceData
    ? `card_${sourceData.sub_type ?? sourceData.type ?? 'unknown'}`
    : 'card';

  const result = await processPaymentCompletion(triajiReference, {
    providerOrderId: String(txnPayload.id ?? ''),
    paymentMethod,
    paidAt: txnPayload.created_at
      ? new Date(txnPayload.created_at as string)
      : new Date(),
    webhookPayload: payload,
  });

  if (!result.success) {
    console.error('[webhook/paymob] Processing failed:', result.error);
    return NextResponse.json({ received: true, error: result.error });
  }

  return NextResponse.json({ received: true, success: true });
}
