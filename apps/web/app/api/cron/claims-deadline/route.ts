/**
 * Claims Deadline Cron Route
 *
 * GET /api/cron/claims-deadline
 * Called daily by Railway cron.
 * Protected by x-cron-secret header.
 *
 * Finds invoices with insurance patients where:
 * - No claim has been submitted yet
 * - The submission deadline is within 5 days or past
 *
 * Sends WhatsApp alerts to provider tenants about approaching deadlines.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@triaji/shared/supabase';
import { sendWhatsAppMessage } from '@/lib/whatsapp/client';

export const dynamic = 'force-dynamic';

interface CronResult {
  approaching: number;
  overdue: number;
  notified: number;
  errors: string[];
}

export async function GET(request: NextRequest) {
  // Verify cron secret
  const secret = request.headers.get('x-cron-secret');
  const cronSecret = process.env['CRON_SECRET'];

  if (!cronSecret || secret !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServerClient();
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  // 5 days from now
  const fiveDaysFromNow = new Date(now);
  fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5);
  const deadlineCutoff = fiveDaysFromNow.toISOString().slice(0, 10);

  const result: CronResult = {
    approaching: 0,
    overdue: 0,
    notified: 0,
    errors: [],
  };

  try {
    // Find draft claims (invoices created but claim not submitted) with approaching deadlines
    const { data: draftClaims, error: draftError } = await supabase
      .from('insurance_claims')
      .select(`
        id,
        claim_number,
        patient_id,
        provider_tenant_id,
        total_amount_egp,
        submission_deadline,
        claim_type
      `)
      .eq('status', 'draft')
      .not('submission_deadline', 'is', null)
      .lte('submission_deadline', deadlineCutoff)
      .order('submission_deadline', { ascending: true });

    if (draftError) {
      result.errors.push(`Query error: ${draftError.message}`);
      return NextResponse.json({ result }, { status: 500 });
    }

    if (!draftClaims || draftClaims.length === 0) {
      return NextResponse.json({
        result,
        message: 'No claims approaching deadline',
      });
    }

    // Group claims by provider tenant
    const byProvider = new Map<string, typeof draftClaims>();
    for (const claim of draftClaims) {
      const key = claim.provider_tenant_id;
      if (!byProvider.has(key)) byProvider.set(key, []);
      byProvider.get(key)!.push(claim);
    }

    // Count approaching vs overdue
    for (const claim of draftClaims) {
      if (claim.submission_deadline && claim.submission_deadline < today) {
        result.overdue++;
      } else {
        result.approaching++;
      }
    }

    // Send notification to each provider tenant
    for (const [tenantId, claims] of byProvider.entries()) {
      try {
        // Provider phone lives on tenant_config (clinic_phone), not tenants.
        const { data: tenantConfig } = await supabase
          .from('tenant_config')
          .select('clinic_phone, phone_number')
          .eq('tenant_id', tenantId)
          .single();

        const tenantPhone = tenantConfig?.clinic_phone ?? tenantConfig?.phone_number;
        if (!tenantPhone) continue;

        const overdueClaims = claims.filter((c) => c.submission_deadline && c.submission_deadline < today);
        const approachingClaims = claims.filter((c) => c.submission_deadline && c.submission_deadline >= today);

        const lines = [
          `تنبيه: مواعيد تقديم المطالبات`,
          ``,
        ];

        if (overdueClaims.length > 0) {
          lines.push(`مطالبات متأخرة (${overdueClaims.length}):`);
          for (const c of overdueClaims.slice(0, 5)) {
            lines.push(`  - ${c.claim_number ?? c.id.slice(0, 8)} | الموعد: ${c.submission_deadline}`);
          }
          if (overdueClaims.length > 5) {
            lines.push(`  ... و ${overdueClaims.length - 5} مطالبة أخرى`);
          }
          lines.push('');
        }

        if (approachingClaims.length > 0) {
          lines.push(`مطالبات قريبة الموعد (${approachingClaims.length}):`);
          for (const c of approachingClaims.slice(0, 5)) {
            lines.push(`  - ${c.claim_number ?? c.id.slice(0, 8)} | الموعد: ${c.submission_deadline}`);
          }
          if (approachingClaims.length > 5) {
            lines.push(`  ... و ${approachingClaims.length - 5} مطالبة أخرى`);
          }
          lines.push('');
        }

        lines.push('من فضلك ارفع المطالبات المعلقة قبل انتهاء الموعد.');
        lines.push('ترياچي للرعاية الصحية');

        const whatsappResult = await sendWhatsAppMessage(tenantPhone, lines.join('\n'));

        if (whatsappResult.success) {
          result.notified++;
        } else {
          result.errors.push(`WhatsApp failed for tenant ${tenantId}: ${whatsappResult.error}`);
        }
      } catch (notifErr) {
        result.errors.push(
          `Notification error for tenant ${tenantId}: ${notifErr instanceof Error ? notifErr.message : 'Unknown'}`
        );
      }
    }
  } catch (err) {
    result.errors.push(`Unexpected error: ${err instanceof Error ? err.message : 'Unknown'}`);
  }

  console.log('[Claims Deadline Cron]', JSON.stringify(result));

  return NextResponse.json({ result });
}
