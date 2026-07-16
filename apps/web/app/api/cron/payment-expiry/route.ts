/**
 * POST /api/cron/payment-expiry
 *
 * Cron job (runs every 30 minutes). Secured by CRON_SECRET.
 *
 * Finds payment_transactions where status='pending' that have exceeded the
 * provider-specific expiry window:
 *   - Fawry:         24 hours
 *   - Paymob (card): 1 hour
 *   - Vodafone Cash: 30 minutes
 *
 * For each expired payment:
 *   1. Sets status='expired', expired_at=NOW()
 *   2. If payable_type='booking': releases the slot, cancels the booking,
 *      and sends WhatsApp to patient explaining the release + offering a new booking link
 *   3. For invoices: leaves as unpaid (patient can retry)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@triaji/shared/supabase';
import { sendWhatsAppMessage } from '@/lib/whatsapp/client';
import { bookingPaymentExpiredMessage } from '@/lib/whatsapp/templates';
import { sendPaymentExpiredNotification } from '@/lib/payments/notifications';
import type { Lang } from '@triaji/shared/i18n/strings';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60s execution

// ─── Provider Expiry Windows (in minutes) ─────────────────────────────────────

const EXPIRY_MINUTES: Record<string, number> = {
  fawry: 24 * 60,        // 24 hours
  paymob: 60,            // 1 hour
  vodafone_cash: 30,     // 30 minutes
};

// ─── Auth ─────────────────────────────────────────────────────────────────────

function verifyCronSecret(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const authHeader = request.headers.get('authorization');
  if (authHeader === `Bearer ${secret}`) return true;

  const urlSecret = request.nextUrl.searchParams.get('secret');
  return urlSecret === secret;
}

// ─── POST Handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServerClient();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://triajji.com';
  const now = new Date();

  let totalExpired = 0;
  let bookingsReleased = 0;
  let notificationsSent = 0;
  const errors: string[] = [];

  // Process each provider separately due to different expiry windows
  for (const [provider, expiryMinutes] of Object.entries(EXPIRY_MINUTES)) {
    const cutoff = new Date(now.getTime() - expiryMinutes * 60 * 1000);

    // Find expired pending transactions for this provider
    const { data: expiredTxns, error: fetchError } = await supabase
      .from('payment_transactions')
      .select('*')
      .eq('status', 'pending')
      .eq('provider', provider)
      .lt('created_at', cutoff.toISOString())
      .limit(100);

    if (fetchError) {
      console.error(`[cron/payment-expiry] Error fetching ${provider} transactions:`, fetchError.message);
      errors.push(`${provider}: ${fetchError.message}`);
      continue;
    }

    if (!expiredTxns || expiredTxns.length === 0) continue;

    for (const txn of expiredTxns) {
      try {
        // 1. Mark transaction as expired
        await supabase
          .from('payment_transactions')
          .update({
            status: 'expired',
            expired_at: now.toISOString(),
          })
          .eq('id', txn.id);

        totalExpired++;

        // 2. Look up patient for phone + language preference
        const { data: patient } = await supabase
          .from('patients')
          .select('phone_number, name_ar, patient_profiles(preferred_language)')
          .eq('id', txn.patient_id)
          .single();

        const patientPhone = patient?.phone_number ?? '';
        const lang: Lang =
          ((patient?.patient_profiles as { preferred_language: string | null }[] | null)?.[0]
            ?.preferred_language as Lang) ?? 'ar';
        const patientName = patient?.name_ar ?? '';

        // 3. Handle based on payable_type
        if (txn.payable_type === 'booking') {
          // Get booking details before cancelling
          const { data: booking } = await supabase
            .from('bookings')
            .select(`
              id, slot_id, doctor_id,
              doctors:doctor_id ( name_ar, name_en, tenant_id )
            `)
            .eq('id', txn.payable_id)
            .single();

          if (booking) {
            // Release the slot
            if (booking.slot_id) {
              await supabase
                .from('doctor_availability')
                .update({ is_booked: false })
                .eq('id', booking.slot_id);
            }

            // Cancel the booking.
            // `bookings` has no cancelled_reason column; record the reason in notes_ar.
            await supabase
              .from('bookings')
              .update({
                status: 'cancelled',
                notes_ar: 'تم الإلغاء — انتهت صلاحية الدفع',
              })
              .eq('id', booking.id);

            bookingsReleased++;

            // AMENDMENT: Send WhatsApp explaining release + offering new booking link
            if (patientPhone) {
              try {
                const doctor = booking.doctors as unknown as Record<string, string> | null;
                const doctorName = lang === 'en'
                  ? (doctor?.name_en ?? doctor?.name_ar ?? '')
                  : (doctor?.name_ar ?? '');

                const newBookingLink = `${baseUrl}/${lang}/chat`;

                await sendWhatsAppMessage(
                  patientPhone,
                  bookingPaymentExpiredMessage(lang, {
                    patientName,
                    doctorName,
                    newBookingLink,
                  }),
                );
                notificationsSent++;
              } catch (notifyErr) {
                console.error('[cron/payment-expiry] Failed to send booking expiry WhatsApp:', notifyErr);
              }
            }
          }
        } else {
          // For invoice-type payables: send expiry notification but don't cancel
          // Patient can retry payment
          if (patientPhone) {
            try {
              const descriptions: Record<string, { ar: string; en: string }> = {
                clinic_invoice: { ar: 'فاتورة عيادة', en: 'Clinic invoice' },
                pharmacy_invoice: { ar: 'فاتورة صيدلية', en: 'Pharmacy invoice' },
                lab_invoice: { ar: 'فاتورة تحاليل', en: 'Lab invoice' },
                insurance_copay: { ar: 'مشاركة تأمين', en: 'Insurance copay' },
              };

              const desc = descriptions[txn.payable_type]?.[lang] ?? (lang === 'ar' ? 'دفع' : 'Payment');

              await sendPaymentExpiredNotification(patientPhone, lang, {
                description: desc,
                amount: Number(txn.amount_egp),
              });
              notificationsSent++;
            } catch (notifyErr) {
              console.error('[cron/payment-expiry] Failed to send invoice expiry notification:', notifyErr);
            }
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        console.error(`[cron/payment-expiry] Error processing txn ${txn.id}:`, msg);
        errors.push(`txn ${txn.id}: ${msg}`);
      }
    }
  }

  console.log(
    `[cron/payment-expiry] Done: ${totalExpired} expired, ${bookingsReleased} bookings released, ${notificationsSent} notifications sent`,
  );

  return NextResponse.json({
    success: true,
    totalExpired,
    bookingsReleased,
    notificationsSent,
    errors: errors.length > 0 ? errors : undefined,
  });
}

/**
 * GET handler — Vercel cron invokes GET by default.
 * Delegate to POST logic.
 */
export async function GET(request: NextRequest) {
  return POST(request);
}
