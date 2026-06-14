/**
 * GET /api/cron/callbacks
 * Called every 2 minutes by Railway cron.
 * Protected by x-cron-secret header.
 *
 * Processes due callbacks from the callback_queue:
 *   1. Finds callbacks where status='scheduled' AND scheduled_for <= NOW()
 *   2. Initiates outbound Twilio calls (max 10 per run)
 *   3. Handles WhatsApp fallback after max attempts exhausted
 */

import { NextRequest, NextResponse } from 'next/server';
import { processDueCallbacks } from '@/lib/phone/callbacks';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Verify cron secret
  const secret = request.headers.get('x-cron-secret');
  const cronSecret = process.env['CRON_SECRET'];

  if (!cronSecret || secret !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const stats = await processDueCallbacks();

    console.log(
      `[Callback Cron] Done: processed=${stats.processed} called=${stats.called} whatsapp=${stats.whatsappSent} errors=${stats.errors}`
    );

    return NextResponse.json({
      success: true,
      ...stats,
    });
  } catch (err) {
    console.error('[Callback Cron] Fatal error:', err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: 'Cron job failed' },
      { status: 500 }
    );
  }
}
