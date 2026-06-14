/**
 * Builds the medical-record view-model in the exact shape the
 * MedicalRecordDashboard / SharedMedicalRecord components consume
 * (MedicalRecordData). Shared by the authenticated dashboard route and the
 * token-based "medical passport" route so the two never drift apart.
 *
 * Every field is always present, so the client never crashes on a missing array.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// Maps a family-history relation code to bilingual labels.
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

// Display metadata + adult reference ranges per vital_type (enum from migration 039).
const VITAL_META: Record<
  string,
  { title_ar: string; title_en: string; reference_min?: number; reference_max?: number }
> = {
  weight_kg: { title_ar: 'الوزن', title_en: 'Weight' },
  height_cm: { title_ar: 'الطول', title_en: 'Height' },
  bmi: { title_ar: 'مؤشر كتلة الجسم', title_en: 'BMI', reference_min: 18.5, reference_max: 24.9 },
  blood_pressure_systolic: { title_ar: 'الضغط الانقباضي', title_en: 'Systolic BP', reference_min: 90, reference_max: 120 },
  blood_pressure_diastolic: { title_ar: 'الضغط الانبساطي', title_en: 'Diastolic BP', reference_min: 60, reference_max: 80 },
  blood_glucose_fasting: { title_ar: 'سكر صائم', title_en: 'Fasting glucose', reference_min: 70, reference_max: 100 },
  blood_glucose_random: { title_ar: 'سكر عشوائي', title_en: 'Random glucose', reference_min: 70, reference_max: 140 },
  heart_rate: { title_ar: 'معدل ضربات القلب', title_en: 'Heart rate', reference_min: 60, reference_max: 100 },
  oxygen_saturation: { title_ar: 'تشبع الأكسجين', title_en: 'Oxygen saturation', reference_min: 95, reference_max: 100 },
  temperature: { title_ar: 'درجة الحرارة', title_en: 'Temperature', reference_min: 36.1, reference_max: 37.2 },
  waist_cm: { title_ar: 'محيط الخصر', title_en: 'Waist circumference' },
};

// Best-effort abnormal check from a "min-max" reference range string; null if undecidable.
function isOutOfRange(value: number | string, range?: string): boolean | null {
  if (!range) return null;
  const m = range.match(/^\s*([\d.]+)\s*-\s*([\d.]+)\s*$/);
  const v = typeof value === 'string' ? parseFloat(value) : value;
  if (!m || Number.isNaN(v)) return null;
  return v < parseFloat(m[1]!) || v > parseFloat(m[2]!);
}

/** Complete, empty view-model for a patient with no profile yet. */
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

/**
 * Loads and shapes the full longitudinal medical record for a patient.
 * Returns a plain object (caller wraps in NextResponse.json).
 */
export async function buildMedicalRecord(
  supabase: SupabaseClient,
  pid: string,
  nameAr: string
) {
  const [
    profileResult,
    followUpsResult,
    labResultsResult,
    vitalsResult,
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
      .select('lab_values, lab_name, lab_date, has_abnormal_values')
      .eq('patient_id', pid)
      .eq('record_type', 'lab_result')
      .is('deleted_at', null)
      .order('lab_date', { ascending: false })
      .limit(10),

    supabase
      .from('vitals_history')
      .select('vital_type, value, unit, measured_at, source')
      .eq('patient_id', pid)
      .order('measured_at', { ascending: true })
      .limit(500),

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

  if (profileResult.error || !profileResult.data) {
    return emptyRecord(nameAr, null);
  }

  const profile = profileResult.data as Record<string, unknown>;

  const toMap = (rows: OptionRow[] | null) =>
    new Map((rows ?? []).map((o) => [o.code, o]));
  const allergyMap = toMap(allergyOpts.data as OptionRow[] | null);
  const conditionMap = toMap(conditionOpts.data as OptionRow[] | null);
  const surgeryMap = toMap(surgeryOpts.data as OptionRow[] | null);
  const familyMap = toMap(familyOpts.data as OptionRow[] | null);

  const allergyRows = (profile.patient_allergies as { allergy_code: string }[]) ?? [];
  const allergies = allergyRows.map((a) => {
    const o = allergyMap.get(a.allergy_code);
    return { name_ar: o?.name_ar ?? a.allergy_code, name_en: o?.name_en ?? a.allergy_code };
  });

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

  const lastLab = (labResultsResult.data as { lab_date: string }[] | null)?.[0];
  const days_since_last_lab = lastLab?.lab_date
    ? Math.floor((todayMs - new Date(lastLab.lab_date).getTime()) / 86400000)
    : null;

  type VitalRow = { vital_type: string; value: number; unit: string; measured_at: string; source: string };
  const trendMap = new Map<string, VitalRow[]>();
  for (const v of (vitalsResult.data as VitalRow[] | null) ?? []) {
    const arr = trendMap.get(v.vital_type) ?? [];
    arr.push(v);
    trendMap.set(v.vital_type, arr);
  }
  const vital_trends = [...trendMap.entries()]
    .filter(([type]) => VITAL_META[type])
    .map(([type, rows]) => {
      const meta = VITAL_META[type]!;
      return {
        type,
        title_ar: meta.title_ar,
        title_en: meta.title_en,
        unit: rows[0]?.unit ?? '',
        data: rows.map((r) => ({
          date: r.measured_at,
          value: Number(r.value),
          source: r.source as 'clinic_visit' | 'lab_result' | 'patient_self',
        })),
        ...(meta.reference_min !== undefined ? { reference_min: meta.reference_min } : {}),
        ...(meta.reference_max !== undefined ? { reference_max: meta.reference_max } : {}),
      };
    });

  type LabValueItem = {
    test_code?: string;
    test_name?: string;
    value: number | string;
    unit?: string;
    reference_range?: string;
  };
  type LabRecord = {
    lab_values: LabValueItem[] | null;
    lab_name: string | null;
    lab_date: string;
    has_abnormal_values: boolean | null;
  };
  const latest_results = ((labResultsResult.data as LabRecord[] | null) ?? []).flatMap((rec) => {
    const items = Array.isArray(rec.lab_values) ? rec.lab_values : [];
    return items.map((it) => {
      const code = String(it.test_code ?? it.test_name ?? 'unknown');
      const name = String(it.test_name ?? it.test_code ?? code);
      return {
        testCode: code,
        testNameAr: name,
        testNameEn: name,
        value: String(it.value ?? ''),
        unit: it.unit ?? '',
        isAbnormal: isOutOfRange(it.value, it.reference_range) ?? (rec.has_abnormal_values ?? false),
        date: rec.lab_date,
      };
    });
  });

  return {
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
    vital_trends,
    follow_ups,
    latest_results,
    surgeries,
    family_history,
    is_paediatric: (profile.is_paediatric as boolean) ?? false,
    ...(profile.is_paediatric ? { child_id: pid } : {}),
  };
}
