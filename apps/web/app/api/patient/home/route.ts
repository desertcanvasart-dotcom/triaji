import { NextResponse } from 'next/server';
import { createServerClient } from '@triaji/shared/supabase';
import { getAuthenticatedPatient } from '@/lib/auth/get-patient';

export const dynamic = 'force-dynamic';

/**
 * GET /api/patient/home
 * Aggregates data for the mobile home screen:
 * - Active alerts (overdue follow-ups, protocol alerts)
 * - Upcoming bookings
 * - Current medications
 * - Protocol alerts
 */
export async function GET() {
  const patient = await getAuthenticatedPatient();
  if (!patient) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const supabase = createServerClient();
  const now = new Date().toISOString();

  // patient_medications is keyed by patient_profile_id (not patient_id);
  // resolve the profile id first so the medications query can scope to it.
  const { data: profileRow } = await supabase
    .from('patient_profiles')
    .select('id')
    .eq('patient_id', patient.patientId)
    .single();
  const profileId = (profileRow as { id: string } | null)?.id ?? null;

  // Run all queries in parallel
  const [
    upcomingBookingsResult,
    medicationsResult,
    overdueFollowUpsResult,
    protocolAlertsResult,
  ] = await Promise.all([
    // Upcoming bookings (next 30 days)
    supabase
      .from('bookings')
      .select(`
        id,
        appointment_datetime,
        doctors!inner (
          name_ar,
          name_en,
          specialties:specialty_id (
            name_ar,
            name_en
          )
        )
      `)
      .eq('patient_id', patient.patientId)
      .eq('status', 'confirmed')
      .gte('appointment_datetime', now)
      .order('appointment_datetime', { ascending: true })
      .limit(5),

    // Current medications (keyed by patient_profile_id)
    profileId
      ? supabase
          .from('patient_medications')
          .select('id, drug_name_ar, drug_name_en, dose, frequency_ar')
          .eq('patient_profile_id', profileId)
          .order('sort_order', { ascending: true })
          .limit(10)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),

    // Overdue follow-ups
    supabase
      .from('follow_up_entries')
      .select('id, specialty_ar, specialty_en, follow_up_date, reason_ar, reason_en')
      .eq('patient_id', patient.patientId)
      .eq('status', 'scheduled')
      .lt('follow_up_date', now.split('T')[0])
      .limit(5),

    // Active protocol alerts
    supabase
      .from('protocol_alerts')
      .select('id, protocol_name_ar, protocol_name_en, message_ar, message_en, severity')
      .eq('patient_id', patient.patientId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  // Build alerts from overdue follow-ups
  const alerts: {
    id: string;
    type: string;
    title_ar: string;
    title_en: string;
    description_ar: string;
    description_en: string;
    severity: 'warning' | 'info' | 'error';
  }[] = [];

  if (overdueFollowUpsResult.data) {
    for (const fu of overdueFollowUpsResult.data) {
      const daysOverdue = Math.floor(
        (Date.now() - new Date(fu.follow_up_date).getTime()) / (1000 * 60 * 60 * 24)
      );
      alerts.push({
        id: `fu-${fu.id}`,
        type: 'overdue_followup',
        title_ar: `موعد متابعة متأخر — ${fu.specialty_ar ?? ''}`,
        title_en: `Overdue follow-up — ${fu.specialty_en ?? fu.specialty_ar ?? ''}`,
        description_ar: `${fu.reason_ar ?? 'موعد المتابعة'} متأخر ${daysOverdue} يوم`,
        description_en: `${fu.reason_en ?? fu.reason_ar ?? 'Follow-up'} is ${daysOverdue} days overdue`,
        severity: daysOverdue > 14 ? 'error' : 'warning',
      });
    }
  }

  // Map upcoming bookings.
  // `bookings` stores a single appointment_datetime; split it into date/time for the UI.
  const upcomingBookings = (upcomingBookingsResult.data ?? []).map((b: Record<string, unknown>) => {
    const doctor = b.doctors as {
      name_ar: string;
      name_en?: string;
      specialties?: { name_ar: string; name_en?: string } | null;
    } | null;
    const specialty = doctor?.specialties ?? null;
    const datetime = b.appointment_datetime as string | null;
    const [datePart, timePart] = datetime ? datetime.split('T') : ['', ''];
    return {
      id: b.id as string,
      doctor_name_ar: doctor?.name_ar ?? '',
      doctor_name_en: doctor?.name_en ?? doctor?.name_ar ?? '',
      specialty_ar: specialty?.name_ar ?? '',
      specialty_en: specialty?.name_en ?? specialty?.name_ar ?? '',
      appointment_date: datePart ?? '',
      appointment_time: (timePart ?? '').slice(0, 5),
    };
  });

  // Map medications
  const medications = (medicationsResult.data ?? []).map((m: Record<string, unknown>) => ({
    id: m.id as string,
    name: (m.drug_name_ar as string) ?? (m.drug_name_en as string) ?? '',
    dosage: (m.dose as string) ?? '',
    frequency_ar: (m.frequency_ar as string) ?? '',
    frequency_en: (m.frequency_ar as string) ?? '',
  }));

  // Map protocol alerts
  const protocolAlerts = (protocolAlertsResult.data ?? []).map((pa: Record<string, unknown>) => ({
    id: pa.id as string,
    protocol_name_ar: pa.protocol_name_ar as string,
    protocol_name_en: (pa.protocol_name_en as string) ?? (pa.protocol_name_ar as string),
    message_ar: pa.message_ar as string,
    message_en: (pa.message_en as string) ?? (pa.message_ar as string),
  }));

  return NextResponse.json({
    alerts,
    upcomingBookings,
    medications,
    protocolAlerts,
  });
}
