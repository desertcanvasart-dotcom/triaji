/**
 * Health Assistant — Context Loader
 * Loads 11 data sources in parallel for the health assistant system prompt.
 * Cached in Upstash Redis with TTL 3600s, invalidated on data mutations.
 */

import { createServerClient } from '@triaji/shared/supabase';
import { redis } from '@/lib/cache/redis';
import type {
  AssistantContext,
  MedicationSummary,
  LabResultSummary,
  VitalTrendSummary,
  PrescriptionSummary,
  EncounterSummary,
  FollowUpSummary,
  ProtocolStatusSummary,
  FamilyHistorySummary,
} from '@triaji/shared/types';

// ─── Configuration ──────────────────────────────────────────────────────────

const CACHE_KEY_PREFIX = 'assistant_context';
const CACHE_TTL_SECONDS = 3600; // 1 hour
const LAB_LOOKBACK_DAYS = 180; // 6 months
const VITALS_LOOKBACK_DAYS = 365; // 12 months
const PRESCRIPTION_LOOKBACK_DAYS = 90;
const ENCOUNTER_LOOKBACK_DAYS = 180; // 6 months

// ─── Cache Helpers ──────────────────────────────────────────────────────────

function cacheKey(patientId: string): string {
  return `${CACHE_KEY_PREFIX}:${patientId}`;
}

/**
 * Invalidate the cached assistant context for a patient.
 * Called from: health_records save, patient_medications update,
 * patient_chronic_conditions update, follow_up_schedule update,
 * gp_relationships status change.
 */
export async function invalidateAssistantContext(patientId: string): Promise<void> {
  await redis.del(cacheKey(patientId));
}

// ─── Date Helpers ───────────────────────────────────────────────────────────

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

// ─── Vital Trend Calculation ────────────────────────────────────────────────

function computeTrend(values: number[]): 'improving' | 'stable' | 'worsening' {
  if (values.length < 2) return 'stable';
  const recent = values.slice(-3);
  const older = values.slice(0, Math.min(3, values.length - 1));
  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
  const diff = recentAvg - olderAvg;
  const threshold = olderAvg * 0.05; // 5% change threshold
  if (Math.abs(diff) < threshold) return 'stable';
  // For most vitals, lower is better (BP, glucose, weight)
  return diff < 0 ? 'improving' : 'worsening';
}

// ─── Main Loader ────────────────────────────────────────────────────────────

/**
 * Load the full assistant context for a patient.
 * Returns cached version if available, otherwise loads fresh from DB.
 */
export async function loadAssistantContext(
  patientId: string,
  lang: 'ar' | 'en' = 'ar'
): Promise<AssistantContext> {
  // Check cache first
  const cached = await redis.get<AssistantContext>(cacheKey(patientId));
  if (cached) {
    return { ...cached, lang };
  }

  // Load fresh context
  const context = await loadFreshContext(patientId, lang);

  // Cache for 1 hour
  await redis.set(cacheKey(patientId), context, { ex: CACHE_TTL_SECONDS });

  return context;
}

// ─── Row Shapes (typed to the real schema, see supabase/migrations/) ─────────
// createServerClient() returns an untyped SupabaseClient, so every `.from(...)`
// row is `any`. We type each row explicitly so noUncheckedIndexedAccess holds.

type OptionRow = { code: string; name_ar: string; name_en: string };

type GovernorateRow = { name_ar: string; name_en: string };
type ProfileRow = {
  id: string;
  age: number | null;
  biological_sex: 'male' | 'female' | null;
  risk_level: 'low' | 'medium' | 'high' | null;
  governorate_id: string | null;
  governorates: GovernorateRow | GovernorateRow[] | null;
};

type ChronicConditionRow = { condition_code: string };
type AllergyRow = { allergy_code: string };
type FamilyHistoryRow = { condition_code: string; relation: string };
type MedicationRow = {
  drug_name_ar: string;
  drug_name_en: string | null;
  dose: string | null;
  frequency_ar: string | null;
  for_condition_ar: string | null;
};

type VitalRow = { vital_type: string; value: number; measured_at: string };

// health_records.lab_values JSONB item (see apps/web/lib/records/types.ts → LabValue)
type LabValueItem = {
  test_name?: string;
  value?: number | string;
  unit?: string;
  reference_range?: string | null;
  is_abnormal?: boolean;
};
type LabRecordRow = {
  lab_values: LabValueItem[] | null;
  lab_date: string | null;
  lab_name: string | null;
  has_abnormal_values: boolean | null;
};

// health_records.medications JSONB item (see apps/web/lib/records/types.ts → Medication)
type MedicationItem = {
  name_ar?: string | null;
  name_en?: string | null;
  dose?: string | null;
  frequency?: string | null;
  prescribing_doctor?: string | null;
};
type PrescriptionRecordRow = {
  medications: MedicationItem[] | null;
  prescription_date: string | null;
  prescribing_doctor: string | null;
  uploaded_at: string;
};

type SessionSummaryRow = {
  chief_complaint_ar: string | null;
  specialty_name_ar: string | null;
  doctor_name_ar: string | null;
  appointment_datetime: string | null;
  outcome: string | null;
  patient_notes_ar: string | null;
  created_at: string;
};

type FollowUpRow = {
  reason_ar: string | null;
  follow_up_date: string;
  doctor_id: string;
  status: string;
};

type ProtocolEnrollmentRow = {
  condition_code: string;
  overall_compliance_pct: number | null;
  disease_protocols: { name_ar: string; name_en: string } | { name_ar: string; name_en: string }[] | null;
};

type GpRelationshipRow = { doctor_id: string };

// PostgREST may return an embedded relation as an object or a single-element array.
function firstOf<T>(rel: T | T[] | null | undefined): T | null {
  if (Array.isArray(rel)) return rel[0] ?? null;
  return rel ?? null;
}

/**
 * Load all data sources from Supabase, shaped to the real DB schema.
 *
 * Important schema realities (verified against supabase/migrations/):
 *  - patient name is patients.name_ar only (006); there is no name_en, and
 *    patient_profiles has no first_name_* columns.
 *  - the medical-history junction tables (allergies / chronic conditions /
 *    medications / family history) are keyed by patient_profile_id (031), so we
 *    first resolve the profile id(s) for the patient.
 *  - vitals_history uses measured_at (039); follow_up_schedule uses
 *    follow_up_date + doctor_id (039); encounters live in session_summaries
 *    (020); protocols in patient_protocol_enrollment (042).
 *  - health_records (025/038) stores prescriptions in the `medications` JSONB
 *    and labs in the `lab_values` JSONB; ordered by prescription_date / lab_date.
 */
async function loadFreshContext(
  patientId: string,
  lang: 'ar' | 'en'
): Promise<AssistantContext> {
  const supabase = createServerClient();
  const now = new Date().toISOString();
  const labCutoff = daysAgo(LAB_LOOKBACK_DAYS);
  const vitalsCutoff = daysAgo(VITALS_LOOKBACK_DAYS);
  const prescriptionCutoff = daysAgo(PRESCRIPTION_LOOKBACK_DAYS);
  const encounterCutoff = daysAgo(ENCOUNTER_LOOKBACK_DAYS);

  // ── Patient display name (patients.name_ar — the only name column) ──────────
  const { data: patientRow } = await supabase
    .from('patients')
    .select('name_ar')
    .eq('id', patientId)
    .single();
  const patientName = (patientRow as { name_ar: string | null } | null)?.name_ar ?? '';

  // ── Patient profile (+ governorate). Resolve profile id(s) for junctions. ───
  const { data: profileRows } = await supabase
    .from('patient_profiles')
    .select('id, age, biological_sex, risk_level, governorate_id, governorates(name_ar, name_en)')
    .eq('patient_id', patientId);
  const profiles = (profileRows as ProfileRow[] | null) ?? [];
  const profile = profiles[0] ?? null;
  const profileIds = profiles.map((p) => p.id);
  const governorate = firstOf(profile?.governorates);

  // The option catalogs + junction rows + patient-scoped sources, all in parallel.
  const [
    conditionsResult,
    allergiesResult,
    medicationsResult,
    familyHistoryResult,
    conditionOptsResult,
    allergyOptsResult,
    familyOptsResult,
    labResultsResult,
    vitalsResult,
    prescriptionsResult,
    encountersResult,
    followUpsResult,
    protocolsResult,
    gpResult,
  ] = await Promise.all([
    // Chronic conditions (junction keyed by patient_profile_id)
    profileIds.length
      ? supabase
          .from('patient_chronic_conditions')
          .select('condition_code')
          .in('patient_profile_id', profileIds)
      : Promise.resolve({ data: [] as ChronicConditionRow[] }),

    // Allergies (junction keyed by patient_profile_id)
    profileIds.length
      ? supabase
          .from('patient_allergies')
          .select('allergy_code')
          .in('patient_profile_id', profileIds)
      : Promise.resolve({ data: [] as AllergyRow[] }),

    // Current medications (junction keyed by patient_profile_id; no frequency_en)
    profileIds.length
      ? supabase
          .from('patient_medications')
          .select('drug_name_ar, drug_name_en, dose, frequency_ar, for_condition_ar')
          .in('patient_profile_id', profileIds)
          .order('sort_order', { ascending: true })
      : Promise.resolve({ data: [] as MedicationRow[] }),

    // Family history (junction keyed by patient_profile_id)
    profileIds.length
      ? supabase
          .from('patient_family_history')
          .select('condition_code, relation')
          .in('patient_profile_id', profileIds)
      : Promise.resolve({ data: [] as FamilyHistoryRow[] }),

    // Bilingual option catalogs (joined by code, like build-medical-record.ts)
    supabase.from('chronic_condition_options').select('code, name_ar, name_en'),
    supabase.from('allergy_options').select('code, name_ar, name_en'),
    supabase.from('family_history_options').select('code, name_ar, name_en'),

    // Lab results (last 6 months) — health_records.lab_values JSONB
    supabase
      .from('health_records')
      .select('lab_values, lab_date, lab_name, has_abnormal_values')
      .eq('patient_id', patientId)
      .eq('record_type', 'lab_result')
      .is('deleted_at', null)
      .gte('lab_date', labCutoff)
      .order('lab_date', { ascending: false })
      .limit(20),

    // Vitals history (last 12 months) — vitals_history.measured_at
    supabase
      .from('vitals_history')
      .select('vital_type, value, measured_at')
      .eq('patient_id', patientId)
      .gte('measured_at', vitalsCutoff)
      .order('measured_at', { ascending: true }),

    // Prescriptions (last 90 days) — health_records.medications JSONB
    supabase
      .from('health_records')
      .select('medications, prescription_date, prescribing_doctor, uploaded_at')
      .eq('patient_id', patientId)
      .eq('record_type', 'prescription')
      .is('deleted_at', null)
      .gte('prescription_date', prescriptionCutoff)
      .order('prescription_date', { ascending: false })
      .limit(10),

    // Recent encounters (last 6 months) — session_summaries
    supabase
      .from('session_summaries')
      .select('chief_complaint_ar, specialty_name_ar, doctor_name_ar, appointment_datetime, outcome, patient_notes_ar, created_at')
      .eq('patient_id', patientId)
      .gte('created_at', encounterCutoff)
      .order('created_at', { ascending: false })
      .limit(10),

    // Follow-up schedule (scheduled + overdue) — follow_up_schedule
    supabase
      .from('follow_up_schedule')
      .select('reason_ar, follow_up_date, doctor_id, status')
      .eq('patient_id', patientId)
      .in('status', ['scheduled', 'overdue'])
      .order('follow_up_date', { ascending: true }),

    // Disease protocol enrollment — patient_protocol_enrollment
    supabase
      .from('patient_protocol_enrollment')
      .select('condition_code, overall_compliance_pct, disease_protocols(name_ar, name_en)')
      .eq('patient_id', patientId)
      .eq('is_active', true),

    // GP relationship (active) — gp_relationships keyed by patient_id
    supabase
      .from('gp_relationships')
      .select('doctor_id')
      .eq('patient_id', patientId)
      .eq('status', 'active')
      .limit(1),
  ]);

  // ─── Option-catalog lookup maps (code → bilingual labels) ─────────────────
  const toMap = (rows: OptionRow[] | null | undefined) =>
    new Map((rows ?? []).map((o) => [o.code, o]));
  const conditionMap = toMap(conditionOptsResult.data as OptionRow[] | null);
  const allergyMap = toMap(allergyOptsResult.data as OptionRow[] | null);
  const familyMap = toMap(familyOptsResult.data as OptionRow[] | null);

  const label = (o: OptionRow | undefined, fallback: string) =>
    o ? (lang === 'en' ? o.name_en : o.name_ar) : fallback;

  // ─── Chronic conditions ───────────────────────────────────────────────────
  const chronicConditions: string[] = ((conditionsResult.data as ChronicConditionRow[] | null) ?? []).map(
    (c) => label(conditionMap.get(c.condition_code), c.condition_code)
  );

  // ─── Allergies ────────────────────────────────────────────────────────────
  const allergies: string[] = ((allergiesResult.data as AllergyRow[] | null) ?? []).map((a) =>
    label(allergyMap.get(a.allergy_code), a.allergy_code)
  );

  // ─── Medications (patient_medications — no frequency_en column) ────────────
  const currentMedications: MedicationSummary[] = ((medicationsResult.data as MedicationRow[] | null) ?? []).map(
    (m) => ({
      nameAr: m.drug_name_ar ?? '',
      nameEn: m.drug_name_en ?? undefined,
      dose: m.dose ?? '',
      frequencyAr: m.frequency_ar ?? '',
      forConditionAr: m.for_condition_ar ?? '',
      dispensed: true, // current medications are active by definition
    })
  );

  // ─── Family history ───────────────────────────────────────────────────────
  const familyHistory: FamilyHistorySummary[] = ((familyHistoryResult.data as FamilyHistoryRow[] | null) ?? []).map(
    (fh) => ({
      conditionAr: label(familyMap.get(fh.condition_code), fh.condition_code),
      relation: fh.relation ?? '',
    })
  );

  // ─── Lab results (parse health_records.lab_values JSONB) ───────────────────
  // lab_values items carry a single test_name (no name_ar/name_en split).
  const recentLabResults: LabResultSummary[] = [];
  for (const rec of (labResultsResult.data as LabRecordRow[] | null) ?? []) {
    const items = Array.isArray(rec.lab_values) ? rec.lab_values : [];
    for (const it of items) {
      const name = String(it.test_name ?? '');
      recentLabResults.push({
        testNameAr: name,
        testNameEn: name || undefined,
        value: String(it.value ?? ''),
        unit: it.unit ?? '',
        isAbnormal: it.is_abnormal ?? rec.has_abnormal_values ?? false,
        date: rec.lab_date ?? '',
        referenceRange: it.reference_range ?? undefined,
      });
    }
  }

  // ─── Vitals trend — group by type, compute direction ──────────────────────
  const vitalsMap = new Map<string, { values: number[]; dates: string[] }>();
  for (const v of (vitalsResult.data as VitalRow[] | null) ?? []) {
    const entry = vitalsMap.get(v.vital_type) ?? { values: [], dates: [] };
    entry.values.push(Number(v.value));
    entry.dates.push(v.measured_at);
    vitalsMap.set(v.vital_type, entry);
  }
  const vitalsTrend: VitalTrendSummary[] = [];
  for (const [vitalType, data] of vitalsMap) {
    vitalsTrend.push({
      vitalType,
      values: data.values,
      dates: data.dates,
      trend: computeTrend(data.values),
    });
  }

  // ─── Prescriptions (parse health_records.medications JSONB) ────────────────
  const activePrescriptions: PrescriptionSummary[] = [];
  for (const rec of (prescriptionsResult.data as PrescriptionRecordRow[] | null) ?? []) {
    const drugs = Array.isArray(rec.medications) ? rec.medications : [];
    const date = rec.prescription_date ?? rec.uploaded_at;
    for (const drug of drugs) {
      activePrescriptions.push({
        nameAr: drug.name_ar ?? '',
        nameEn: drug.name_en ?? undefined,
        dose: drug.dose ?? '',
        frequencyAr: drug.frequency ?? '',
        prescribingDoctorAr: drug.prescribing_doctor ?? rec.prescribing_doctor ?? '',
        dispensed: false, // dispensing tracked in prescription_routing, not here
        date,
      });
    }
  }

  // ─── Encounters (session_summaries) ───────────────────────────────────────
  const recentEncounters: EncounterSummary[] = ((encountersResult.data as SessionSummaryRow[] | null) ?? []).map(
    (s) => ({
      date: s.appointment_datetime ?? s.created_at,
      doctorNameAr: s.doctor_name_ar ?? '',
      specialty: s.specialty_name_ar ?? '',
      chiefComplaintAr: s.chief_complaint_ar ?? '',
      planAr: s.patient_notes_ar ?? s.outcome ?? '',
    })
  );

  // ─── Follow-ups (resolve doctor names; doctors has no doctor_name_ar) ──────
  const followUpRows = (followUpsResult.data as FollowUpRow[] | null) ?? [];
  const followUpDoctorIds = [...new Set(followUpRows.map((f) => f.doctor_id).filter(Boolean))];
  const doctorNames = new Map<string, string>();
  if (followUpDoctorIds.length > 0) {
    const { data: docs } = await supabase
      .from('doctors')
      .select('id, name_ar')
      .in('id', followUpDoctorIds);
    for (const d of (docs as { id: string; name_ar: string }[] | null) ?? []) {
      doctorNames.set(d.id, d.name_ar);
    }
  }

  const overdueFollowUps: FollowUpSummary[] = followUpRows
    .filter((f) => f.status === 'overdue' || (f.status === 'scheduled' && f.follow_up_date < now))
    .map((f) => ({
      reasonAr: f.reason_ar ?? '',
      dueDate: f.follow_up_date,
      doctorNameAr: doctorNames.get(f.doctor_id) ?? '',
      isOverdue: true,
    }));

  const upcomingFollowUps: FollowUpSummary[] = followUpRows
    .filter((f) => f.status === 'scheduled' && f.follow_up_date >= now)
    .map((f) => ({
      reasonAr: f.reason_ar ?? '',
      dueDate: f.follow_up_date,
      doctorNameAr: doctorNames.get(f.doctor_id) ?? '',
      isOverdue: false,
    }));

  // ─── Protocol status (patient_protocol_enrollment; no overdue_tests column) ─
  const protocolStatus: ProtocolStatusSummary[] = ((protocolsResult.data as ProtocolEnrollmentRow[] | null) ?? []).map(
    (p) => {
      const proto = firstOf(p.disease_protocols);
      return {
        conditionAr: proto ? (lang === 'en' ? proto.name_en : proto.name_ar) : p.condition_code,
        compliancePct: Number(p.overall_compliance_pct ?? 0),
        overdueTests: [], // not tracked on this table; computed elsewhere
      };
    }
  );

  // ─── GP doctor (resolve name + specialty separately) ──────────────────────
  const gpRow = ((gpResult.data as GpRelationshipRow[] | null) ?? [])[0] ?? null;
  let gpDoctorNameAr: string | undefined;
  let gpDoctorSpecialty: string | undefined;
  if (gpRow?.doctor_id) {
    const { data: gpDoctor } = await supabase
      .from('doctors')
      .select('name_ar, name_en, specialty_id')
      .eq('id', gpRow.doctor_id)
      .single();
    const doc = gpDoctor as { name_ar: string; name_en: string | null; specialty_id: string } | null;
    if (doc) {
      gpDoctorNameAr = lang === 'en' ? (doc.name_en ?? doc.name_ar) : doc.name_ar;
      if (doc.specialty_id) {
        const { data: spec } = await supabase
          .from('specialties')
          .select('name_ar, name_en')
          .eq('id', doc.specialty_id)
          .single();
        const s = spec as { name_ar: string; name_en: string } | null;
        if (s) gpDoctorSpecialty = lang === 'en' ? s.name_en : s.name_ar;
      }
    }
  }

  const context: AssistantContext = {
    patientFirstName: patientName,
    patientAge: Number(profile?.age ?? 0),
    patientSex: profile?.biological_sex ?? 'male',
    patientGovernorate: governorate
      ? (lang === 'en' ? governorate.name_en : governorate.name_ar)
      : '',
    chronicConditions,
    allergies,
    currentMedications,
    familyHistory,
    brsLevel: profile?.risk_level ?? 'low',
    recentLabResults,
    vitalsTrend,
    activePrescriptions,
    recentEncounters,
    overdueFollowUps,
    upcomingFollowUps,
    protocolStatus,
    gpDoctorNameAr,
    gpDoctorSpecialty,
    lang,
  };

  return context;
}
