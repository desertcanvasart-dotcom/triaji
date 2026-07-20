/**
 * POST /api/payments/initiate
 * Create a new payment transaction and get the payment URL/code.
 *
 * NO AUTH REQUIRED — reference-as-token pattern (accessible from WhatsApp links).
 *
 * Body: { payable_type, payable_id, provider, amount_egp?, return_url? }
 * Returns: { reference, paymentUrl?, fawryCode?, expiresAt }
 *
 * Thin HTTP wrapper — the core lives in @/lib/payments/initiate so the
 * booking engine can call it in-process instead of over HTTP.
 */

import { NextRequest, NextResponse } from 'next/server';
import type { PaymentProvider } from '@triaji/payment-adapters';
import {
  initiatePayment,
  VALID_PAYABLE_TYPES,
  VALID_PROVIDERS,
  type PayableType,
} from '@/lib/payments/initiate';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  let body: {
    payable_type?: string;
    payable_id?: string;
    provider?: string;
    amount_egp?: number;
    return_url?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Validate required fields
  if (!body.payable_type || !body.payable_id || !body.provider) {
    return NextResponse.json(
      { error: 'payable_type, payable_id, and provider are required' },
      { status: 400 },
    );
  }

  if (!VALID_PAYABLE_TYPES.includes(body.payable_type as PayableType)) {
    return NextResponse.json(
      { error: `Invalid payable_type. Must be one of: ${VALID_PAYABLE_TYPES.join(', ')}` },
      { status: 400 },
    );
  }

  if (!VALID_PROVIDERS.includes(body.provider as PaymentProvider)) {
    return NextResponse.json(
      { error: `Invalid provider. Must be one of: ${VALID_PROVIDERS.join(', ')}` },
      { status: 400 },
    );
  }

  const result = await initiatePayment({
    payableType: body.payable_type as PayableType,
    payableId: body.payable_id,
    provider: body.provider as PaymentProvider,
    amountEgp: body.amount_egp,
    returnUrl: body.return_url,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    reference: result.reference,
    paymentUrl: result.paymentUrl,
    fawryCode: result.fawryCode,
    expiresAt: result.expiresAt,
  });
}
