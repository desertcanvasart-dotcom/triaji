/**
 * POST /api/webhooks/lab-chain/alborg
 *
 * Receives Al-Borg lab result webhooks.
 * Verifies HMAC signature, logs to lab_chain_webhooks, and processes results.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@triaji/shared/supabase';
import { getLabChainAdapter } from '@triaji/lab-chain-adapters';
import { processChainResults } from '@/lib/lab/process-chain-results';

export const dynamic = 'force-dynamic';

const CHAIN_CODE = 'alborg' as const;

export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  let rawBody: string;

  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  // ─── Verify webhook signature ───────────────────────────────────────────────
  const signature = request.headers.get('x-alborg-signature') ?? '';
  const timestamp = request.headers.get('x-alborg-timestamp') ?? '';

  const adapter = getLabChainAdapter(CHAIN_CODE);
  const isValid = adapter.verifyWebhook({
    payload: rawBody,
    signature,
    timestamp,
  });

  if (!isValid) {
    console.error(`[webhook/alborg] Invalid signature`);
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

  // ─── Log webhook to lab_chain_webhooks ──────────────────────────────────────
  await supabase
    .from('lab_chain_webhooks')
    .insert({
      chain_code: CHAIN_CODE,
      event_type: eventType ?? 'unknown',
      chain_order_id: chainOrderId,
      payload,
      received_at: new Date().toISOString(),
    })
    .then(({ error }) => {
      if (error) console.error(`[webhook/alborg] Failed to log webhook:`, error);
    });

  // ─── Find routing record ───────────────────────────────────────────────────
  if (!chainOrderId) {
    console.log(`[webhook/alborg] No order_id in payload, event: ${eventType}`);
    return NextResponse.json({ received: true });
  }

  const { data: routing } = await supabase
    .from('lab_order_routing')
    .select('id, status')
    .eq('chain_code', CHAIN_CODE)
    .eq('chain_order_id', chainOrderId)
    .maybeSingle();

  if (!routing) {
    console.warn(`[webhook/alborg] No routing found for chain_order_id: ${chainOrderId}`);
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
      console.error(`[webhook/alborg] Failed to process results for ${chainOrderId}:`, err);
      // Update webhook log with error
      await supabase
        .from('lab_chain_webhooks')
        .update({ processing_error: (err as Error).message })
        .eq('chain_code', CHAIN_CODE)
        .eq('chain_order_id', chainOrderId)
        .order('received_at', { ascending: false })
        .limit(1);
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
