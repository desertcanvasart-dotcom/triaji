import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@triaji/shared/supabase';
import { sendWhatsAppMessage } from '@/lib/whatsapp/client';

// ─── GET /api/cron/vaccination-reminders ─────────────────────────────────────
// Daily cron job for vaccination reminders, overdue alerts, and turning-18 checks
export async function GET(request: NextRequest) {
  // Verify cron secret
  const secret = request.headers.get('x-cron-secret');
  const cronSecret = process.env['CRON_SECRET'];

  if (!cronSecret || secret !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServerClient();
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  // Calculate date 14 days from now
  const in14Days = new Date(now);
  in14Days.setDate(in14Days.getDate() + 14);
  const in14DaysStr = in14Days.toISOString().split('T')[0];

  // Calculate date 30 days from now for turning-18 check
  const in30Days = new Date(now);
  in30Days.setDate(in30Days.getDate() + 30);

  let remindersSent = 0;
  let overdueAlertsSent = 0;
  let turning18Sent = 0;

  // ─── 1. Upcoming vaccine reminders (due within 14 days) ───────────────────
  const { data: upcomingVaccines } = await supabase
    .from('vaccination_schedule')
    .select(`
      id,
      patient_id,
      vaccine_code,
      dose_number,
      due_date,
      vaccine:vaccine_catalog!vaccination_schedule_vaccine_code_fkey (
        name_ar,
        name_en
      )
    `)
    .eq('status', 'due')
    .eq('reminder_sent', false)
    .gte('due_date', today)
    .lte('due_date', in14DaysStr);

  for (const vacc of upcomingVaccines ?? []) {
    // Find the guardian for this child
    const { data: guardianRel } = await supabase
      .from('guardian_relationships')
      .select(`
        guardian_patient_id,
        guardian:patients!guardian_relationships_guardian_patient_id_fkey (
          phone_number,
          preferred_language
        )
      `)
      .eq('child_patient_id', vacc.patient_id)
      .eq('is_primary_guardian', true)
      .single();

    if (!guardianRel) continue;

    const guardian = guardianRel.guardian as Record<string, string> | null;
    if (!guardian?.phone_number) continue;

    const guardianLang = guardian.preferred_language ?? 'ar';
    const vaccine = vacc.vaccine as Record<string, string> | null;
    const vaccineName = guardianLang === 'ar'
      ? (vaccine?.name_ar ?? vacc.vaccine_code)
      : (vaccine?.name_en ?? vacc.vaccine_code);

    // Get child name
    const { data: childPatient } = await supabase
      .from('patients')
      .select('display_name')
      .eq('id', vacc.patient_id)
      .single();

    const childName = childPatient?.display_name ?? '';

    const message = guardianLang === 'ar'
      ? `تذكير تطعيم من ترياچي:\n${childName} عنده تطعيم ${vaccineName} (جرعة ${vacc.dose_number}) يوم ${vacc.due_date}.\nاحجز موعد مع طبيب الأطفال.`
      : `Triajji Vaccine Reminder:\n${childName} has a ${vaccineName} (dose ${vacc.dose_number}) due on ${vacc.due_date}.\nBook an appointment with your paediatrician.`;

    await sendWhatsAppMessage(guardian.phone_number, message);

    // Mark reminder as sent
    await supabase
      .from('vaccination_schedule')
      .update({ reminder_sent: true })
      .eq('id', vacc.id);

    remindersSent++;
  }

  // ─── 2. Overdue vaccine alerts ────────────────────────────────────────────
  const { data: overdueVaccines } = await supabase
    .from('vaccination_schedule')
    .select(`
      id,
      patient_id,
      vaccine_code,
      dose_number,
      due_date,
      vaccine:vaccine_catalog!vaccination_schedule_vaccine_code_fkey (
        name_ar,
        name_en
      )
    `)
    .eq('status', 'due')
    .lt('due_date', today);

  // Update status to overdue
  if (overdueVaccines && overdueVaccines.length > 0) {
    const overdueIds = overdueVaccines.map((v) => v.id);
    await supabase
      .from('vaccination_schedule')
      .update({ status: 'overdue' })
      .in('id', overdueIds);
  }

  // Group overdue by patient to avoid sending multiple messages
  const overdueByPatient = new Map<string, typeof overdueVaccines>();
  for (const vacc of overdueVaccines ?? []) {
    const existing = overdueByPatient.get(vacc.patient_id) ?? [];
    existing.push(vacc);
    overdueByPatient.set(vacc.patient_id, existing);
  }

  for (const [patientId, vaccs] of overdueByPatient) {
    const { data: guardianRel } = await supabase
      .from('guardian_relationships')
      .select(`
        guardian_patient_id,
        guardian:patients!guardian_relationships_guardian_patient_id_fkey (
          phone_number,
          preferred_language
        )
      `)
      .eq('child_patient_id', patientId)
      .eq('is_primary_guardian', true)
      .single();

    if (!guardianRel) continue;

    const guardian = guardianRel.guardian as Record<string, string> | null;
    if (!guardian?.phone_number) continue;

    const guardianLang = guardian.preferred_language ?? 'ar';

    const { data: childPatient } = await supabase
      .from('patients')
      .select('display_name')
      .eq('id', patientId)
      .single();

    const childName = childPatient?.display_name ?? '';
    const count = vaccs.length;

    const message = guardianLang === 'ar'
      ? `تنبيه من ترياچي:\n${childName} عنده ${count} تطعيم متأخر. برجاء مراجعة طبيب الأطفال في أقرب وقت.`
      : `Triajji Alert:\n${childName} has ${count} overdue vaccination(s). Please see your paediatrician as soon as possible.`;

    await sendWhatsAppMessage(guardian.phone_number, message);
    overdueAlertsSent++;
  }

  // ─── 3. Turning-18 check ─────────────────────────────────────────────────
  // Find paediatric profiles where DOB + 18 years is within next 30 days
  const eighteenYearsAgoIn30Days = new Date(in30Days);
  eighteenYearsAgoIn30Days.setFullYear(eighteenYearsAgoIn30Days.getFullYear() - 18);
  const eighteenYearsAgoToday = new Date(now);
  eighteenYearsAgoToday.setFullYear(eighteenYearsAgoToday.getFullYear() - 18);

  const { data: turningProfiles } = await supabase
    .from('patient_profiles')
    .select('patient_id, date_of_birth')
    .eq('is_paediatric', true)
    .eq('turning_18_notified', false)
    .gte('date_of_birth', eighteenYearsAgoIn30Days.toISOString().split('T')[0])
    .lte('date_of_birth', eighteenYearsAgoToday.toISOString().split('T')[0]);

  for (const profile of turningProfiles ?? []) {
    const { data: guardianRel } = await supabase
      .from('guardian_relationships')
      .select(`
        guardian_patient_id,
        guardian:patients!guardian_relationships_guardian_patient_id_fkey (
          phone_number,
          preferred_language
        )
      `)
      .eq('child_patient_id', profile.patient_id)
      .eq('is_primary_guardian', true)
      .single();

    if (!guardianRel) continue;

    const guardian = guardianRel.guardian as Record<string, string> | null;
    if (!guardian?.phone_number) continue;

    const guardianLang = guardian.preferred_language ?? 'ar';

    const { data: childPatient } = await supabase
      .from('patients')
      .select('display_name')
      .eq('id', profile.patient_id)
      .single();

    const childName = childPatient?.display_name ?? '';

    const message = guardianLang === 'ar'
      ? `ترياچي — إشعار مهم:\nطفلك ${childName} على وشك بلوغ 18 سنة. سجله الطبي سينتقل قريباً لحساب مستقل. تواصل معنا لتفاصيل الانتقال.`
      : `Triajji — Important Notice:\nYour child ${childName} is about to turn 18. Their medical record will soon transition to an independent account. Contact us for transition details.`;

    await sendWhatsAppMessage(guardian.phone_number, message);

    // Mark as notified
    await supabase
      .from('patient_profiles')
      .update({ turning_18_notified: true })
      .eq('patient_id', profile.patient_id);

    turning18Sent++;
  }

  return NextResponse.json({
    success: true,
    remindersSent,
    overdueAlertsSent,
    turning18Sent,
    timestamp: now.toISOString(),
  });
}
