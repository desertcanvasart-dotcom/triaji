import { NextResponse } from 'next/server';
import { createServerClient } from '@triaji/shared/supabase';
import { getAuthenticatedPatient } from '@/lib/auth/get-patient';

export const dynamic = 'force-dynamic';

// Maps a family-history relation code to bilingual labels for the dashboard.
const RELATION_LABELS: Record<string, { ar: string; en: string }> = {
  father: { ar: 'الأب', en: 'Father' },
  mother: { ar: 'الأم', en: 'Mother' },
  sibling: { ar: 'أخ / أخت', en: 'Sibling' },
  brother: { ar: 'أخ', en: 'Brother' },
  sister: { ar: 'أخت', en: 'Sister' },
  grandfather: { ar: 'الجد', en: 'Grandfather' },
  grandmother: { ar: 'الجدة', en: 'Grandmother' },
  uncle: { ar: 'عم / خال', en: 'Uncle' },
  aunt: { ar: 'عمة / خالة', en: 'Aunt' },
};

type OptionRow = { code: string; name_ar: string; name_en: string };

/**
 * Builds the dashboard view-model in the exact shape the MedicalRecordDashboard
 * component (MedicalRecordData) consumes. Every field is always present so the
 * client never crashes on a missing array.
 *
 * NOTE: `vital_trends` and `latest_results` require derived transforms
 * (grouping vitals into trend series with reference metadata, and parsing the
 * health_records.lab_values blob into per-test rows). Those are returned empty
 * for now — the dashboard renders graceful empty states — and are tracked as a
 * follow-up once the vital-type metadata + lab_values schema are finalised.
 */
function emptyRecord(nameAr: string, nameEn: string | null) {
  return {
    patient_name_ar: nameAr,
    patient_name_en: nameEn,
    last_updated: new Date().toISOString(),
    brs_score: 0,
    upcoming_appointments_count: 0,
    active_medications_count: 0,
    days_since_last_lab: null as number | null,
    allergies: [],
    medications: [],
    chronic_conditions: [],
    vital_trends: [],
    follow_ups: [],
    latest_results: [],
    surgeries: [],
    family_history: [],
    is_paediatric: false,
  };
}

// ─── GET /api/patient/medical-record ──────────────────────────────────────────
// Returns the full longitudinal medical record for the authenticated patient,
// shaped as MedicalRecordData for the dashboard component.
export async function GET() {
  const patient = await getAuthenticatedPatient();
  if (!patient) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const supabase = createServerClient();
  const pid = patient.patientId;

  // Patient display name (patients table only carries name_ar)
  const { data: patientRow } = await supabase
    .from('patients')
    .select('name_ar')
    .eq('id', pid)
    .single();
  const nameAr = (patientRow?.name_ar as string) ?? 'مريض';

  // Run the heavy queries in parallel
  const [
    profileResult,
    followUpsResult,
    labResultsResult,
    bookingsResult,
    allergyOpts,
    conditionOpts,
    surgeryOpts,
    familyOpts,
  ] = await Promise.all([
    supabase
      .from('patient_profiles')
      .select(`
        *,
        patient_allergies(*),
        patient_chronic_conditions(*),
        patient_medications(*),
        patient_surgeries(*),
        patient_family_history(*)
      `)
      .eq('patient_id', pid)
      .single(),

    supabase
      .from('follow_up_schedule')
      .select('id, doctor_id, follow_up_date, reason_ar, reason_en, status')
      .eq('patient_id', pid)
      .neq('status', 'cancelled')
      .order('follow_up_date', { ascending: true }),

    supabase
      .from('health_records')
      .select('id, lab_date')
      .eq('patient_id', pid)
      .eq('record_type', 'lab_result')
      .is('deleted_at', null)
      .order('lab_date', { ascending: false })
      .limit(1),

    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('patient_id', pid)
      .gte('appointment_datetime', new Date().toISOString())
      .in('status', ['confirmed', 'pending']),

    supabase.from('allergy_options').select('code, name_ar, name_en'),
    supabase.from('chronic_condition_options').select('code, name_ar, name_en'),
    supabase.from('surgery_options').select('code, name_ar, name_en'),
    supabase.from('family_history_options').select('code, name_ar, name_en'),
  ]);

  // No profile yet → return a complete, empty record (page renders onboarding-style empties)
  if (profileResult.error || !profileResult.data) {
    return NextResponse.json(emptyRecord(nameAr, null));
  }

  const profile = profileResult.data as Record<string, unknown>;

  // Build code → name lookups from the option reference tables
  const toMap = (rows: OptionRow[] | null) =>
    new Map((rows ?? []).map((o) => [o.code, o]));
  const allergyMap = toMap(allergyOpts.data as OptionRow[] | null);
  const conditionMap = toMap(conditionOpts.data as OptionRow[] | null);
  const surgeryMap = toMap(surgeryOpts.data as OptionRow[] | null);
  const familyMap = toMap(familyOpts.data as OptionRow[] | null);

  // Allergies
  const allergyRows = (profile.patient_allergies as { allergy_code: string }[]) ?? [];
  const allergies = allergyRows.map((a) => {
    const o = allergyMap.get(a.allergy_code);
    return { name_ar: o?.name_ar ?? a.allergy_code, name_en: o?.name_en ?? a.allergy_code };
  });

  // Chronic conditions
  const conditionRows =
    (profile.patient_chronic_conditions as { condition_code: string; diagnosed_year: number | null }[]) ?? [];
  const chronic_conditions = conditionRows.map((c) => {
    const o = conditionMap.get(c.condition_code);
    return {
      name_ar: o?.name_ar ?? c.condition_code,
      name_en: o?.name_en ?? c.condition_code,
      since: c.diagnosed_year ? String(c.diagnosed_year) : undefined,
    };
  });

  // Surgeries
  const surgeryRows =
    (profile.patient_surgeries as { surgery_code: string; year_approximate: number | null }[]) ?? [];
  const surgeries = surgeryRows.map((s) => {
    const o = surgeryMap.get(s.surgery_code);
    return {
      name_ar: o?.name_ar ?? s.surgery_code,
      name_en: o?.name_en ?? s.surgery_code,
      date: s.year_approximate ? String(s.year_approximate) : undefined,
    };
  });

  // Family history
  const familyRows =
    (profile.patient_family_history as { condition_code: string; relation: string }[]) ?? [];
  const family_history = familyRows.map((f) => {
    const o = familyMap.get(f.condition_code);
    const rel = RELATION_LABELS[f.relation] ?? { ar: f.relation, en: f.relation };
    return {
      relation_ar: rel.ar,
      relation_en: rel.en,
      condition_ar: o?.name_ar ?? f.condition_code,
      condition_en: o?.name_en ?? f.condition_code,
    };
  });

  // Current medications (patient-reported list) → adherence records
  const medRows =
    (profile.patient_medications as {
      id: string;
      drug_name_ar: string;
      drug_name_en: string | null;
      dose: string | null;
      frequency_ar: string | null;
    }[]) ?? [];
  const medications = medRows.map((m) => ({
    id: m.id,
    drug_name_ar: m.drug_name_ar,
    drug_name_en: m.drug_name_en ?? m.drug_name_ar,
    dose: m.dose ?? '',
    frequency_ar: m.frequency_ar ?? '',
    frequency_en: m.frequency_ar ?? '',
    status: 'dispensed' as const,
    prescription_id: null,
  }));

  // Follow-ups (resolve doctor names in one batched lookup)
  const fuRows =
    (followUpsResult.data as {
      id: string;
      doctor_id: string;
      follow_up_date: string;
      reason_ar: string | null;
      reason_en: string | null;
      status: string;
    }[]) ?? [];
  const doctorIds = [...new Set(fuRows.map((f) => f.doctor_id).filter(Boolean))];
  const doctorNames = new Map<string, string>();
  if (doctorIds.length > 0) {
    const { data: docs } = await supabase
      .from('doctors')
      .select('id, name_ar')
      .in('id', doctorIds);
    for (const d of (docs as { id: string; name_ar: string }[]) ?? []) {
      doctorNames.set(d.id, d.name_ar);
    }
  }
  const todayMs = Date.now();
  const follow_ups = fuRows.map((f) => {
    const dueMs = new Date(f.follow_up_date).getTime();
    const isOverdue = f.status === 'scheduled' && dueMs < todayMs;
    const status: 'scheduled' | 'completed' | 'overdue' =
      f.status === 'completed' ? 'completed' : isOverdue ? 'overdue' : 'scheduled';
    return {
      id: f.id,
      scheduled_date: f.follow_up_date,
      doctor_name_ar: doctorNames.get(f.doctor_id) ?? '',
      doctor_name_en: null,
      reason_ar: f.reason_ar ?? '',
      reason_en: f.reason_en,
      status,
      ...(isOverdue ? { days_overdue: Math.floor((todayMs - dueMs) / 86400000) } : {}),
    };
  });

  // Days since last lab
  const lastLab = (labResultsResult.data as { lab_date: string }[] | null)?.[0];
  const days_since_last_lab = lastLab?.lab_date
    ? Math.floor((todayMs - new Date(lastLab.lab_date).getTime()) / 86400000)
    : null;

  return NextResponse.json({
    patient_name_ar: nameAr,
    patient_name_en: null,
    last_updated: (profile.updated_at as string) ?? new Date().toISOString(),
    brs_score: (profile.background_risk_score as number) ?? 0,
    upcoming_appointments_count: bookingsResult.count ?? 0,
    active_medications_count: medications.length,
    days_since_last_lab,
    allergies,
    medications,
    chronic_conditions,
    // TODO: derive trend series (group vitals_history by type + reference metadata)
    vital_trends: [],
    follow_ups,
    // TODO: parse health_records.lab_values blob into per-test LabResult rows
    latest_results: [],
    surgeries,
    family_history,
    is_paediatric: (profile.is_paediatric as boolean) ?? false,
    ...(profile.is_paediatric ? { child_id: pid } : {}),
  });
}
