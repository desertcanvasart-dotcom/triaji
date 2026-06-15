/**
 * POST /api/webhooks/lab-chain/almokhtabar
 *
 * Receives Al-Mokhtabar lab result webhooks.
 * Verifies HMAC signature, logs to lab_chain_webhooks, and processes results.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@triaji/shared/supabase';
import { getLabChainAdapter } from '@triaji/lab-chain-adapters';
import { processChainResults } from '@/lib/lab/process-chain-results';

export const dynamic = 'force-dynamic';

const CHAIN_CODE = 'almokhtabar' as const;

export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  let rawBody: string;

  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  // ─── Verify webhook signature ───────────────────────────────────────────────
  const signature = request.headers.get('x-mokhtabar-signature') ?? '';
  const timestamp = request.headers.get('x-mokhtabar-timestamp') ?? '';

  const adapter = getLabChainAdapter(CHAIN_CODE);
  const isValid = adapter.verifyWebhook({
    payload: rawBody,
    signature,
    timestamp,
  });

  if (!isValid) {
    console.error(`[webhook/almokhtabar] Invalid signature`);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // ─── Parse payload ──────────────────────────────────────────────────────────
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const eventType = payload.event_type as string | undefined;
  const chainOrderId = payload.order_id as string | undefined;

  // ─── Find routing record (correlate the webhook to an order) ────────────────
  let routing: { id: string; status: string } | null = null;
  if (chainOrderId) {
    const { data } = await supabase
      .from('lab_order_routing')
      .select('id, status')
      .eq('chain_code', CHAIN_CODE)
      .eq('chain_order_id', chainOrderId)
      .maybeSingle();
    routing = (data as { id: string; status: string } | null) ?? null;
  }

  // ─── Log webhook to lab_chain_webhooks ──────────────────────────────────────
  // chain_order_id lives inside payload; correlation is via routing_id.
  await supabase
    .from('lab_chain_webhooks')
    .insert({
      chain_code: CHAIN_CODE,
      event_type: eventType ?? 'unknown',
      payload,
      signature,
      is_verified: isValid,
      routing_id: routing?.id ?? null,
    })
    .then(({ error }) => {
      if (error) console.error(`[webhook/almokhtabar] Failed to log webhook:`, error);
    });

  if (!chainOrderId) {
    console.log(`[webhook/almokhtabar] No order_id in payload, event: ${eventType}`);
    return NextResponse.json({ received: true });
  }

  if (!routing) {
    console.warn(`[webhook/almokhtabar] No routing found for chain_order_id: ${chainOrderId}`);
    return NextResponse.json({ received: true, warning: 'Unknown order' });
  }

  // ─── Handle results_ready event ─────────────────────────────────────────────
  if (eventType === 'results_ready' || eventType === 'results_partial') {
    try {
      const results = await adapter.getResults(chainOrderId);

      if (results) {
        await processChainResults(routing.id as string, results);
      }
    } catch (err) {
      console.error(`[webhook/almokhtabar] Failed to process results for ${chainOrderId}:`, err);
      // lab_chain_webhooks has no processing_error column; the error is logged above.
    }
  }

  // ─── Handle status update events ────────────────────────────────────────────
  if (eventType === 'sample_collected' || eventType === 'in_progress') {
    const statusMap: Record<string, string> = {
      sample_collected: 'sample_collected',
      in_progress: 'processing',
    };

    await supabase
      .from('lab_order_routing')
      .update({ status: statusMap[eventType] ?? eventType })
      .eq('id', routing.id);
  }

  return NextResponse.json({ received: true, success: true });
}
