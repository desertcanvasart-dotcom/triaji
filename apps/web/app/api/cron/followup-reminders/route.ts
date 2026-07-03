/**
 * Follow-Up Reminders Cron Route
 *
 * GET /api/cron/followup-reminders
 * Called daily by Railway cron.
 * Protected by x-cron-secret header.
 *
 * 1. Send 7-day reminders for follow-ups due in 7 days (no reminder_1_sent_at)
 * 2. Send 1-day reminders for follow-ups due tomorrow (no reminder_2_sent_at)
 * 3. Mark overdue: scheduled follow-ups past their date → status='overdue'
 */

import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from '@triaji/shared/supabase';
import { sendFollowUpReminder } from '@/lib/followup/notifications';

export const dynamic = 'force-dynamic';

/** Max reminders in flight at once — stays well under WhatsApp rate limits. */
const REMINDER_CONCURRENCY = 5;

interface CronResult {
  sevenDayReminders: number;
  oneDayReminders: number;
  markedOverdue: number;
  errors: string[];
}

interface FollowUpRow {
  id: string;
  patient_id: string;
  follow_up_date: string;
  reason_ar: string | null;
  doctor_accounts: unknown;
  patients: unknown;
}

/**
 * Send one kind of reminder for a batch of follow-ups, in bounded-concurrency
 * chunks. Returns the number sent; failures are appended to `errors`.
 */
async function sendReminderBatch(
  supabase: SupabaseClient,
  followUps: FollowUpRow[],
  kind: '7days' | '1day',
  sentColumn: 'reminder_1_sent_at' | 'reminder_2_sent_at',
  sentAt: string,
  errors: string[],
): Promise<number> {
  const label = kind === '7days' ? '7d' : '1d';
  let sent = 0;

  for (let i = 0; i < followUps.length; i += REMINDER_CONCURRENCY) {
    const chunk = followUps.slice(i, i + REMINDER_CONCURRENCY);
    await Promise.all(chunk.map(async (fu) => {
      try {
        const patient = (Array.isArray(fu.patients) ? fu.patients[0] : fu.patients) as { phone_number: string; patient_profiles: { preferred_language: string | null }[] | null } | undefined;
        const doctor = (Array.isArray(fu.doctor_accounts) ? fu.doctor_accounts[0] : fu.doctor_accounts) as { name_ar: string } | undefined;
        if (!patient?.phone_number) return;

        const res = await sendFollowUpReminder(
          patient.phone_number,
          patient.patient_profiles?.[0]?.preferred_language ?? 'ar',
          kind,
          {
            doctorName: doctor?.name_ar ?? '',
            followUpDate: fu.follow_up_date,
            reasonAr: fu.reason_ar ?? '',
          }
        );

        if (res.success) {
          await supabase
            .from('follow_up_schedule')
            .update({ [sentColumn]: sentAt })
            .eq('id', fu.id);
          sent++;
        } else {
          errors.push(`${label} reminder failed for ${fu.id}: ${res.error}`);
        }
      } catch (err) {
        errors.push(`${label} reminder error for ${fu.id}: ${err instanceof Error ? err.message : 'Unknown'}`);
      }
    }));
  }

  return sent;
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

  // Calculate target dates
  const sevenDaysFromNow = new Date(now);
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
  const sevenDayTarget = sevenDaysFromNow.toISOString().slice(0, 10);

  const oneDayFromNow = new Date(now);
  oneDayFromNow.setDate(oneDayFromNow.getDate() + 1);
  const oneDayTarget = oneDayFromNow.toISOString().slice(0, 10);

  const result: CronResult = {
    sevenDayReminders: 0,
    oneDayReminders: 0,
    markedOverdue: 0,
    errors: [],
  };

  const reminderSelect = `
      id, patient_id, follow_up_date, reason_ar,
      doctor_accounts!inner(name_ar),
      patients!inner(phone_number, patient_profiles(preferred_language))
    `;

  // ─── 1. Seven-day reminders ─────────────────────────────────────────────────

  const { data: sevenDayFollowUps } = await supabase
    .from('follow_up_schedule')
    .select(reminderSelect)
    .eq('follow_up_date', sevenDayTarget)
    .eq('status', 'scheduled')
    .is('reminder_1_sent_at', null);

  result.sevenDayReminders = await sendReminderBatch(
    supabase,
    (sevenDayFollowUps ?? []) as unknown as FollowUpRow[],
    '7days',
    'reminder_1_sent_at',
    now.toISOString(),
    result.errors,
  );

  // ─── 2. One-day reminders ───────────────────────────────────────────────────

  const { data: oneDayFollowUps } = await supabase
    .from('follow_up_schedule')
    .select(reminderSelect)
    .eq('follow_up_date', oneDayTarget)
    .eq('status', 'scheduled')
    .is('reminder_2_sent_at', null);

  result.oneDayReminders = await sendReminderBatch(
    supabase,
    (oneDayFollowUps ?? []) as unknown as FollowUpRow[],
    '1day',
    'reminder_2_sent_at',
    now.toISOString(),
    result.errors,
  );

  // ─── 3. Mark overdue ────────────────────────────────────────────────────────

  const { data: overdueResult, error: overdueError } = await supabase
    .from('follow_up_schedule')
    .update({ status: 'overdue' })
    .eq('status', 'scheduled')
    .lt('follow_up_date', today)
    .select('id');

  if (overdueError) {
    result.errors.push(`Mark overdue error: ${overdueError.message}`);
  } else {
    result.markedOverdue = overdueResult?.length ?? 0;
  }

  console.log('[cron/followup-reminders] Result:', JSON.stringify(result));

  return NextResponse.json({
    success: true,
    ...result,
    timestamp: now.toISOString(),
  });
}
