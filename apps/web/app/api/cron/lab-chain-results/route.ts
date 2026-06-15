/**
 * GET /api/cron/lab-chain-results
 *
 * 2-hour polling cron job for lab chain results.
 * Checks all pending chain orders and fetches results from chain APIs.
 * Handles partial results (keeps polling) and complete results (finalizes).
 *
 * Secured by CRON_SECRET header.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@triaji/shared/supabase';
import { getLabChainAdapter, type LabChainCode } from '@triaji/lab-chain-adapters';
import { processChainResults } from '@/lib/lab/process-chain-results';

export const dynamic = 'force-dynamic';
export const maxDuration = 120; // Allow up to 2 minutes for processing

export async function GET(request: NextRequest) {
  // ─── Verify cron secret ─────────────────────────────────────────────────────
  const secret = request.headers.get('x-cron-secret');
  const cronSecret = process.env['CRON_SECRET'];

  if (!cronSecret || secret !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServerClient();
  const now = new Date();

  // Only poll orders from the last 7 days
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // ─── Find pending chain orders ──────────────────────────────────────────────
  const { data: pendingOrders, error: queryError } = await supabase
    .from('lab_order_routing')
    .select('id, chain_code, chain_order_id, status')
    .not('chain_code', 'is', null)
    .not('chain_order_id', 'is', null)
    .in('status', ['received', 'sample_collected', 'processing'])
    .eq('manual_fallback_active', false)
    .gte('created_at', sevenDaysAgo.toISOString())
    .order('created_at', { ascending: true });

  if (queryError) {
    console.error('[cron/lab-chain-results] Query error:', queryError);
    return NextResponse.json({ error: 'Query failed' }, { status: 500 });
  }

  if (!pendingOrders || pendingOrders.length === 0) {
    return NextResponse.json({
      success: true,
      message: 'No pending chain orders to poll',
      polled: 0,
      timestamp: now.toISOString(),
    });
  }

  // ─── Poll each order ───────────────────────────────────────────────────────
  let polled = 0;
  let resultsProcessed = 0;
  let partialReceived = 0;
  let notReady = 0;
  const errors: string[] = [];

  for (const order of pendingOrders) {
    const chainCode = order.chain_code as LabChainCode;
    const chainOrderId = order.chain_order_id as string;
    const routingId = order.id as string;

    polled++;

    try {
      const adapter = getLabChainAdapter(chainCode);
      const result = await adapter.getResults(chainOrderId);

      if (result) {
        if (result.status === 'completed') {
          // Full results — process and finalize
          await processChainResults(routingId, result);
          resultsProcessed++;
        } else {
          // Partial results — store and continue polling
          await processChainResults(routingId, result);
          partialReceived++;
        }
      } else {
        // Not ready yet — nothing to persist (lab_order_routing has no poll-timestamp
        // column); it will be re-polled on the next cron run.
        notReady++;
      }
    } catch (err) {
      const errorMsg = `${chainCode}/${chainOrderId}: ${(err as Error).message}`;
      console.error(`[cron/lab-chain-results] Error polling ${errorMsg}`);
      errors.push(errorMsg);
    }
  }

  return NextResponse.json({
    success: true,
    polled,
    resultsProcessed,
    partialReceived,
    notReady,
    errors: errors.length > 0 ? errors : undefined,
    timestamp: now.toISOString(),
  });
}
