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

/**
 * Load all 11 data sources in parallel from Supabase.
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

  // All 11 queries in parallel
  const [
    profileResult,
    conditionsResult,
    allergiesResult,
    medicationsResult,
    labResultsResult,
    vitalsResult,
    prescriptionsResult,
    encountersResult,
    followUpsResult,
    protocolsResult,
    gpResult,
  ] = await Promise.all([
    // 1. Patient profile
    supabase
      .from('patient_profiles')
      .select('first_name_ar, first_name_en, age, biological_sex, governorate_id, work_type, risk_level, governorates(name_ar, name_en)')
      .eq('patient_id', patientId)
      .single(),

    // 2. Chronic conditions with names
    supabase
      .from('patient_chronic_conditions')
      .select('condition_code, notes_ar, chronic_condition_options(name_ar, name_en)')
      .eq('patient_id', patientId),

    // 3. Allergies with names
    supabase
      .from('patient_allergies')
      .select('allergy_code, notes_ar, allergy_options(name_ar, name_en)')
      .eq('patient_id', patientId),

    // 4. Current medications
    supabase
      .from('patient_medications')
      .select('drug_name_ar, drug_name_en, dose, frequency_ar, frequency_en, for_condition_ar')
      .eq('patient_id', patientId)
      .order('sort_order'),

    // 5. Lab results (last 6 months)
    supabase
      .from('health_records')
      .select('content, created_at')
      .eq('patient_id', patientId)
      .eq('document_type', 'lab_result')
      .gte('created_at', labCutoff)
      .order('created_at', { ascending: false })
      .limit(20),

    // 6. Vitals history (last 12 months)
    supabase
      .from('vitals_history')
      .select('vital_type, value, recorded_at')
      .eq('patient_id', patientId)
      .gte('recorded_at', vitalsCutoff)
      .order('recorded_at', { ascending: true }),

    // 7. Prescriptions (last 90 days)
    supabase
      .from('health_records')
      .select('content, created_at')
      .eq('patient_id', patientId)
      .eq('document_type', 'prescription')
      .gte('created_at', prescriptionCutoff)
      .order('created_at', { ascending: false })
      .limit(10),

    // 8. Recent encounters / doctor notes (last 6 months)
    supabase
      .from('health_records')
      .select('content, created_at')
      .eq('patient_id', patientId)
      .in('document_type', ['doctor_note', 'session_summary'])
      .gte('created_at', encounterCutoff)
      .order('created_at', { ascending: false })
      .limit(10),

    // 9. Follow-up schedule (overdue + upcoming)
    supabase
      .from('follow_up_schedule')
      .select('reason_ar, due_date, doctor_name_ar, status')
      .eq('patient_id', patientId)
      .in('status', ['pending', 'overdue'])
      .order('due_date', { ascending: true }),

    // 10. Disease protocol enrollment + compliance
    supabase
      .from('disease_protocol_enrollment')
      .select('condition_ar, compliance_pct, overdue_tests')
      .eq('patient_id', patientId)
      .eq('status', 'active'),

    // 11. GP relationship (active)
    supabase
      .from('gp_relationships')
      .select('doctors(name_ar, name_en, specialties(name_ar, name_en))')
      .eq('patient_id', patientId)
      .eq('status', 'active')
      .limit(1)
      .single(),
  ]);

  // ─── Transform Results ──────────────────────────────────────────────────

  const profile = profileResult.data;
  const governorate = profile?.governorates as unknown as { name_ar: string; name_en: string } | null;

  // Chronic conditions
  const chronicConditions: string[] = (conditionsResult.data ?? []).map((c) => {
    const opts = c.chronic_condition_options as unknown as { name_ar: string; name_en: string } | null;
    return lang === 'en' ? (opts?.name_en ?? c.condition_code) : (opts?.name_ar ?? c.condition_code);
  });

  // Allergies
  const allergies: string[] = (allergiesResult.data ?? []).map((a) => {
    const opts = a.allergy_options as unknown as { name_ar: string; name_en: string } | null;
    return lang === 'en' ? (opts?.name_en ?? a.allergy_code) : (opts?.name_ar ?? a.allergy_code);
  });

  // Medications
  const currentMedications: MedicationSummary[] = (medicationsResult.data ?? []).map((m) => ({
    nameAr: m.drug_name_ar ?? '',
    nameEn: m.drug_name_en ?? undefined,
    dose: m.dose ?? '',
    frequencyAr: m.frequency_ar ?? '',
    frequencyEn: m.frequency_en ?? undefined,
    forConditionAr: m.for_condition_ar ?? '',
    dispensed: true, // current medications are active
  }));

  // Lab results — parse from health_records content JSONB
  const recentLabResults: LabResultSummary[] = [];
  for (const record of labResultsResult.data ?? []) {
    const content = record.content as Record<string, unknown> | null;
    if (!content) continue;
    const tests = (content.tests ?? content.results ?? []) as Array<{
      name_ar?: string;
      name_en?: string;
      value?: string;
      unit?: string;
      is_abnormal?: boolean;
      reference_range?: string;
    }>;
    for (const test of tests) {
      recentLabResults.push({
        testNameAr: test.name_ar ?? '',
        testNameEn: test.name_en ?? undefined,
        value: String(test.value ?? ''),
        unit: test.unit ?? '',
        isAbnormal: test.is_abnormal ?? false,
        date: record.created_at,
        referenceRange: test.reference_range ?? undefined,
      });
    }
  }

  // Vitals trend — group by type, compute trend direction
  const vitalsMap = new Map<string, { values: number[]; dates: string[] }>();
  for (const v of vitalsResult.data ?? []) {
    const key = v.vital_type as string;
    if (!vitalsMap.has(key)) {
      vitalsMap.set(key, { values: [], dates: [] });
    }
    const entry = vitalsMap.get(key)!;
    entry.values.push(Number(v.value));
    entry.dates.push(v.recorded_at as string);
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

  // Prescriptions — parse from health_records content JSONB
  const activePrescriptions: PrescriptionSummary[] = [];
  for (const record of prescriptionsResult.data ?? []) {
    const content = record.content as Record<string, unknown> | null;
    if (!content) continue;
    const drugs = (content.drugs ?? content.medications ?? [content]) as Array<{
      name_ar?: string;
      name_en?: string;
      dose?: string;
      frequency_ar?: string;
      prescribing_doctor_ar?: string;
      dispensed?: boolean;
    }>;
    for (const drug of drugs) {
      activePrescriptions.push({
        nameAr: drug.name_ar ?? (content.drug_name_ar as string) ?? '',
        nameEn: drug.name_en ?? undefined,
        dose: drug.dose ?? (content.dose as string) ?? '',
        frequencyAr: drug.frequency_ar ?? (content.frequency_ar as string) ?? '',
        prescribingDoctorAr: drug.prescribing_doctor_ar ?? (content.doctor_name_ar as string) ?? '',
        dispensed: drug.dispensed ?? (content.dispensed as boolean) ?? false,
        date: record.created_at,
      });
    }
  }

  // Encounters — parse from health_records content JSONB
  const recentEncounters: EncounterSummary[] = [];
  for (const record of encountersResult.data ?? []) {
    const content = record.content as Record<string, unknown> | null;
    if (!content) continue;
    recentEncounters.push({
      date: record.created_at,
      doctorNameAr: (content.doctor_name_ar as string) ?? '',
      specialty: (content.specialty as string) ?? '',
      chiefComplaintAr: (content.chief_complaint_ar as string) ?? (content.complaint_ar as string) ?? '',
      planAr: (content.plan_ar as string) ?? (content.recommendation_ar as string) ?? '',
    });
  }

  // Follow-ups
  const allFollowUps = followUpsResult.data ?? [];
  const overdueFollowUps: FollowUpSummary[] = allFollowUps
    .filter((f) => f.status === 'overdue' || (f.status === 'pending' && f.due_date < now))
    .map((f) => ({
      reasonAr: f.reason_ar ?? '',
      dueDate: f.due_date ?? '',
      doctorNameAr: f.doctor_name_ar ?? '',
      isOverdue: true,
    }));

  const upcomingFollowUps: FollowUpSummary[] = allFollowUps
    .filter((f) => f.status === 'pending' && f.due_date >= now)
    .map((f) => ({
      reasonAr: f.reason_ar ?? '',
      dueDate: f.due_date ?? '',
      doctorNameAr: f.doctor_name_ar ?? '',
      isOverdue: false,
    }));

  // Protocol status
  const protocolStatus: ProtocolStatusSummary[] = (protocolsResult.data ?? []).map((p) => ({
    conditionAr: p.condition_ar ?? '',
    compliancePct: Number(p.compliance_pct ?? 0),
    overdueTests: (p.overdue_tests as string[]) ?? [],
  }));

  // GP doctor
  const gpDoctor = gpResult.data?.doctors as unknown as { name_ar: string; name_en: string; specialties: { name_ar: string; name_en: string } | null } | null;

  // Family history — load separately (not in initial parallel since we need patient_id join)
  const { data: familyHistoryData } = await supabase
    .from('patient_family_history')
    .select('condition_code, relation, family_history_options(name_ar, name_en)')
    .eq('patient_id', patientId);

  const familyHistory: FamilyHistorySummary[] = (familyHistoryData ?? []).map((fh) => {
    const opts = fh.family_history_options as unknown as { name_ar: string; name_en: string } | null;
    return {
      conditionAr: lang === 'en' ? (opts?.name_en ?? fh.condition_code) : (opts?.name_ar ?? fh.condition_code),
      relation: fh.relation ?? '',
    };
  });

  const context: AssistantContext = {
    patientFirstName: lang === 'en'
      ? (profile?.first_name_en as string ?? profile?.first_name_ar ?? '')
      : (profile?.first_name_ar ?? ''),
    patientAge: Number(profile?.age ?? 0),
    patientSex: (profile?.biological_sex as 'male' | 'female') ?? 'male',
    patientGovernorate: lang === 'en'
      ? (governorate?.name_en ?? '')
      : (governorate?.name_ar ?? ''),
    chronicConditions,
    allergies,
    currentMedications,
    familyHistory,
    brsLevel: (profile?.risk_level as 'low' | 'medium' | 'high') ?? 'low',
    recentLabResults,
    vitalsTrend,
    activePrescriptions,
    recentEncounters,
    overdueFollowUps,
    upcomingFollowUps,
    protocolStatus,
    gpDoctorNameAr: lang === 'en' ? (gpDoctor?.name_en ?? gpDoctor?.name_ar) : gpDoctor?.name_ar,
    gpDoctorSpecialty: lang === 'en'
      ? (gpDoctor?.specialties?.name_en ?? gpDoctor?.specialties?.name_ar)
      : gpDoctor?.specialties?.name_ar,
    lang,
  };

  return context;
}
