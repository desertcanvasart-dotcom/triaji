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
import { createServerClient } from '@triaji/shared/supabase';
import { sendFollowUpReminder } from '@/lib/followup/notifications';

export const dynamic = 'force-dynamic';

interface CronResult {
  sevenDayReminders: number;
  oneDayReminders: number;
  markedOverdue: number;
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

  // ─── 1. Seven-day reminders ─────────────────────────────────────────────────

  const { data: sevenDayFollowUps } = await supabase
    .from('follow_up_schedule')
    .select(`
      id, patient_id, follow_up_date, reason_ar,
      doctor_accounts!inner(name_ar),
      patients!inner(phone_number, patient_profiles(preferred_language))
    `)
    .eq('follow_up_date', sevenDayTarget)
    .eq('status', 'scheduled')
    .is('reminder_1_sent_at', null);

  for (const fu of sevenDayFollowUps ?? []) {
    try {
      const patient = (Array.isArray(fu.patients) ? fu.patients[0] : fu.patients) as { phone_number: string; patient_profiles: { preferred_language: string | null }[] | null } | undefined;
      const doctor = (Array.isArray(fu.doctor_accounts) ? fu.doctor_accounts[0] : fu.doctor_accounts) as { name_ar: string } | undefined;
      if (!patient?.phone_number) continue;

      const res = await sendFollowUpReminder(
        patient.phone_number,
        patient.patient_profiles?.[0]?.preferred_language ?? 'ar',
        '7days',
        {
          doctorName: doctor?.name_ar ?? '',
          followUpDate: fu.follow_up_date,
          reasonAr: fu.reason_ar ?? '',
        }
      );

      if (res.success) {
        await supabase
          .from('follow_up_schedule')
          .update({ reminder_1_sent_at: now.toISOString() })
          .eq('id', fu.id);
        result.sevenDayReminders++;
      } else {
        result.errors.push(`7d reminder failed for ${fu.id}: ${res.error}`);
      }
    } catch (err) {
      result.errors.push(`7d reminder error for ${fu.id}: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
  }

  // ─── 2. One-day reminders ───────────────────────────────────────────────────

  const { data: oneDayFollowUps } = await supabase
    .from('follow_up_schedule')
    .select(`
      id, patient_id, follow_up_date, reason_ar,
      doctor_accounts!inner(name_ar),
      patients!inner(phone_number, patient_profiles(preferred_language))
    `)
    .eq('follow_up_date', oneDayTarget)
    .eq('status', 'scheduled')
    .is('reminder_2_sent_at', null);

  for (const fu of oneDayFollowUps ?? []) {
    try {
      const patient = (Array.isArray(fu.patients) ? fu.patients[0] : fu.patients) as { phone_number: string; patient_profiles: { preferred_language: string | null }[] | null } | undefined;
      const doctor = (Array.isArray(fu.doctor_accounts) ? fu.doctor_accounts[0] : fu.doctor_accounts) as { name_ar: string } | undefined;
      if (!patient?.phone_number) continue;

      const res = await sendFollowUpReminder(
        patient.phone_number,
        patient.patient_profiles?.[0]?.preferred_language ?? 'ar',
        '1day',
        {
          doctorName: doctor?.name_ar ?? '',
          followUpDate: fu.follow_up_date,
          reasonAr: fu.reason_ar ?? '',
        }
      );

      if (res.success) {
        await supabase
          .from('follow_up_schedule')
          .update({ reminder_2_sent_at: now.toISOString() })
          .eq('id', fu.id);
        result.oneDayReminders++;
      } else {
        result.errors.push(`1d reminder failed for ${fu.id}: ${res.error}`);
      }
    } catch (err) {
      result.errors.push(`1d reminder error for ${fu.id}: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
  }

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
