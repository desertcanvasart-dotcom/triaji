/**
 * Builds the paediatric medical-record view-model (ChildRecordData) consumed by
 * ChildMedicalRecordDashboard. Mirrors build-medical-record.ts for the shared
 * bits (allergies, medications, follow-ups) and adds child-specific sections:
 * growth, vaccinations, milestones, school health, recent visits.
 *
 * Every field is always present so the client never crashes on missing data.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

type OptionRow = { code: string; name_ar: string; name_en: string };

function ageGroupLabel(months: number): { ar: string; en: string } {
  if (months <= 2) return { ar: '0–2 شهور', en: '0–2 months' };
  if (months <= 6) return { ar: '3–6 شهور', en: '3–6 months' };
  if (months <= 12) return { ar: '7–12 شهر', en: '7–12 months' };
  if (months <= 24) return { ar: '1–2 سنة', en: '1–2 years' };
  if (months <= 36) return { ar: '2–3 سنوات', en: '2–3 years' };
  if (months <= 60) return { ar: '3–5 سنوات', en: '3–5 years' };
  return { ar: '6+ سنوات', en: '6+ years' };
}

function monthsSince(dob: string | null): number {
  if (!dob) return 0;
  const d = new Date(dob);
  const now = new Date();
  return Math.max(0, (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth()));
}

/** Loads + shapes the full paediatric record for a child patient id. */
export async function buildChildMedicalRecord(supabase: SupabaseClient, childId: string) {
  const [
    patientRes,
    profileRes,
    growthRes,
    vaccRes,
    vaccCatalogRes,
    milestoneRes,
    milestoneCatalogRes,
    schoolRes,
    followUpsRes,
    visitsRes,
    allergyOptsRes,
  ] = await Promise.all([
    supabase.from('patients').select('name_ar').eq('id', childId).single(),
    supabase
      .from('patient_profiles')
      .select('id, date_of_birth, biological_sex, blood_type, updated_at, patient_allergies(*), patient_medications(*)')
      .eq('patient_id', childId)
      .single(),
    supabase
      .from('growth_measurements')
      .select('weight_kg, height_cm, weight_percentile, height_percentile, measured_at')
      .eq('patient_id', childId)
      .order('measured_at', { ascending: false })
      .limit(1),
    supabase
      .from('vaccination_schedule')
      .select('vaccine_code, status, due_date')
      .eq('patient_id', childId),
    supabase.from('vaccine_catalog').select('code, name_ar, name_en'),
    supabase.from('patient_milestones').select('milestone_id, achieved').eq('patient_id', childId),
    supabase.from('milestone_catalog').select('id, age_months, is_red_flag'),
    supabase
      .from('school_health_records')
      .select('exam_date, academic_year, school_name_ar, fit_for_school, restriction_ar')
      .eq('patient_id', childId)
      .order('exam_date', { ascending: false })
      .limit(1),
    supabase
      .from('follow_up_schedule')
      .select('id, doctor_id, follow_up_date, reason_ar, reason_en, status')
      .eq('patient_id', childId)
      .neq('status', 'cancelled')
      .order('follow_up_date', { ascending: true }),
    supabase
      .from('session_summaries')
      .select('chief_complaint_ar, specialty_name_ar, doctor_name_ar, appointment_datetime, created_at')
      .eq('patient_id', childId)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase.from('allergy_options').select('code, name_ar, name_en'),
  ]);

  const nameAr = (patientRes.data?.name_ar as string) ?? 'طفل';
  const profile = (profileRes.data as Record<string, unknown> | null) ?? null;
  const dob = (profile?.date_of_birth as string | null) ?? null;
  const ageMonths = monthsSince(dob);

  // Allergies (codes → names via options)
  const allergyMap = new Map(
    ((allergyOptsRes.data as OptionRow[] | null) ?? []).map((o) => [o.code, o])
  );
  const allergies = (((profile?.patient_allergies as { allergy_code: string }[]) ?? []).map((a) => {
    const o = allergyMap.get(a.allergy_code);
    return { name_ar: o?.name_ar ?? a.allergy_code, name_en: o?.name_en ?? a.allergy_code };
  }));

  // Medications → adherence records
  const medications = (((profile?.patient_medications as {
    id: string; drug_name_ar: string; drug_name_en: string | null; dose: string | null; frequency_ar: string | null;
  }[]) ?? []).map((m) => ({
    id: m.id,
    drug_name_ar: m.drug_name_ar,
    drug_name_en: m.drug_name_en ?? m.drug_name_ar,
    dose: m.dose ?? '',
    frequency_ar: m.frequency_ar ?? '',
    frequency_en: m.frequency_ar ?? '',
    status: 'dispensed' as const,
    prescription_id: null,
  })));

  // Growth (latest)
  const g = (growthRes.data as {
    weight_kg: number | null; height_cm: number | null; weight_percentile: number | null;
    height_percentile: number | null; measured_at: string | null;
  }[] | null)?.[0];
  const growth = {
    latest_weight_kg: g?.weight_kg ?? null,
    latest_height_cm: g?.height_cm ?? null,
    weight_percentile: g?.weight_percentile ?? null,
    height_percentile: g?.height_percentile ?? null,
    last_measured: g?.measured_at ?? null,
  };

  // Vaccinations
  const vaccNameMap = new Map(
    ((vaccCatalogRes.data as OptionRow[] | null) ?? []).map((v) => [v.code, v])
  );
  const vaccRows = (vaccRes.data as { vaccine_code: string; status: string; due_date: string | null }[] | null) ?? [];
  const completed = vaccRows.filter((v) => v.status === 'given').length;
  const upcoming = vaccRows
    .filter((v) => v.status === 'due' || v.status === 'overdue')
    .filter((v) => v.due_date)
    .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime());
  const nextDue = upcoming[0];
  const nextVacc = nextDue ? vaccNameMap.get(nextDue.vaccine_code) : undefined;
  const vaccinations = {
    total: vaccRows.length,
    completed,
    next_due_vaccine_ar: nextVacc?.name_ar ?? null,
    next_due_vaccine_en: nextVacc?.name_en ?? null,
    next_due_date: nextDue?.due_date ?? null,
  };

  // Milestones
  const redFlagIds = new Set(
    ((milestoneCatalogRes.data as { id: string; age_months: number; is_red_flag: boolean }[] | null) ?? [])
      .filter((m) => m.is_red_flag && m.age_months <= ageMonths)
      .map((m) => m.id)
  );
  const milestoneRows = (milestoneRes.data as { milestone_id: string; achieved: boolean | null }[] | null) ?? [];
  const redFlags = milestoneRows.filter((m) => m.achieved === false && redFlagIds.has(m.milestone_id)).length;
  const ag = ageGroupLabel(ageMonths);
  const milestones = {
    current_age_group_ar: ag.ar,
    current_age_group_en: ag.en,
    red_flags: redFlags,
    total_assessed: milestoneRows.length,
  };

  // School health (latest)
  const sh = (schoolRes.data as {
    exam_date: string | null; academic_year: string | null; school_name_ar: string | null;
    fit_for_school: boolean | null; restriction_ar: string | null;
  }[] | null)?.[0];
  const school_health = {
    latest_exam_date: sh?.exam_date ?? null,
    latest_academic_year: sh?.academic_year ?? null,
    latest_school_name: sh?.school_name_ar ?? null,
    fit_for_school: sh?.fit_for_school ?? null,
    has_restrictions: !!sh?.restriction_ar,
  };

  // Follow-ups (resolve doctor names)
  const fuRows = (followUpsRes.data as {
    id: string; doctor_id: string; follow_up_date: string; reason_ar: string | null; reason_en: string | null; status: string;
  }[] | null) ?? [];
  const doctorIds = [...new Set(fuRows.map((f) => f.doctor_id).filter(Boolean))];
  const doctorNames = new Map<string, string>();
  if (doctorIds.length > 0) {
    const { data: docs } = await supabase.from('doctors').select('id, name_ar').in('id', doctorIds);
    for (const d of (docs as { id: string; name_ar: string }[]) ?? []) doctorNames.set(d.id, d.name_ar);
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

  // Recent visits (from triage session summaries)
  const recent_visits = ((visitsRes.data as {
    chief_complaint_ar: string | null; specialty_name_ar: string | null; doctor_name_ar: string | null;
    appointment_datetime: string | null; created_at: string;
  }[] | null) ?? []).map((v) => ({
    date: v.appointment_datetime ?? v.created_at,
    doctor_name_ar: v.doctor_name_ar ?? '',
    doctor_name_en: null,
    specialty_ar: v.specialty_name_ar ?? '',
    specialty_en: v.specialty_name_ar ?? '',
    diagnosis_ar: v.chief_complaint_ar ?? null,
  }));

  return {
    child_name_ar: nameAr,
    child_name_en: null,
    date_of_birth: dob ?? '',
    blood_type: (profile?.blood_type as string | null) ?? null,
    age_months: ageMonths,
    sex: ((profile?.biological_sex as 'male' | 'female') ?? 'male'),
    last_updated: (profile?.updated_at as string) ?? new Date().toISOString(),
    allergies,
    growth,
    vaccinations,
    milestones,
    school_health,
    medications,
    follow_ups,
    recent_visits,
  };
}
