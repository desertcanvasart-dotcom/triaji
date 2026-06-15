/**
 * Protocol Compliance Checker
 *
 * Checks a patient's compliance with their enrolled disease protocols, driven by
 * the protocol_definition jsonb on disease_protocols:
 * - labs[].frequencyMonths        → last lab date vs required lab cadence
 * - vitals[].frequencyWeeks       → last measurement per vital vs expected interval
 * - followUpFrequency.months      → last completed follow-up vs required cadence
 * - warnings[] {metric,condition,threshold,severity,message} → latest vital / lab
 *   value vs the protocol's clinical thresholds
 *
 * Returns overall compliance percentage and an array of alerts.
 */

import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ComplianceAlert {
  type: 'overdue_lab' | 'overdue_followup' | 'overdue_vital' | 'threshold_exceeded';
  severity: 'critical' | 'warning' | 'info';
  messageAr: string;
  messageEn: string;
  enrollmentId?: string;
  thresholdValue?: string;
  actualValue?: string;
  unit?: string;
}

export interface ComplianceResult {
  compliancePct: number;
  alerts: ComplianceAlert[];
  checksPerformed: number;
  checksPassed: number;
}

interface ProtocolVital {
  type: string;
  frequencyWeeks: number;
}

interface ProtocolWarning {
  metric: string;
  condition: 'above' | 'below';
  threshold: number;
  severity: 'critical' | 'warning';
  messageAr: string;
  messageEn: string;
}

interface ProtocolRecord {
  id: string;
  enrollment_id: string;
  condition_code: string;
  name_ar: string;
  name_en: string;
  labFrequencyDays: number | null;
  followupFrequencyDays: number | null;
  vitals: ProtocolVital[];
  warnings: ProtocolWarning[];
}

// Arabic labels for the vital types used in protocol_definition.vitals[].type.
const VITAL_LABELS_AR: Record<string, string> = {
  weight_kg: 'الوزن',
  blood_pressure_systolic: 'الضغط الانقباضي',
  blood_pressure_diastolic: 'الضغط الانبساطي',
  blood_glucose_fasting: 'سكر صايم',
  heart_rate: 'النبض',
  oxygen_saturation: 'نسبة الأكسجين',
};
const vitalLabelAr = (t: string) => VITAL_LABELS_AR[t] ?? t;

/**
 * Check a patient's compliance with all their enrolled protocols.
 */
export async function checkPatientCompliance(patientId: string): Promise<ComplianceResult> {
  const supabase = getServiceClient();
  const now = Date.now();
  const alerts: ComplianceAlert[] = [];
  let checksPerformed = 0;
  let checksPassed = 0;

  // 1. Fetch active enrollments with protocol details
  const { data: enrollments } = await supabase
    .from('patient_protocol_enrollment')
    .select(`
      id, protocol_id, enrolled_at,
      disease_protocols!inner(id, condition_code, name_ar, name_en, protocol_definition)
    `)
    .eq('patient_id', patientId)
    .eq('is_active', true);

  if (!enrollments || enrollments.length === 0) {
    return { compliancePct: 100, alerts: [], checksPerformed: 0, checksPassed: 0 };
  }

  // Build protocol list from the protocol_definition jsonb (labs / vitals / warnings /
  // followUpFrequency live there, not as flat columns).
  const protocols: ProtocolRecord[] = enrollments.map((e: Record<string, unknown>) => {
    const proto = Array.isArray(e.disease_protocols) ? e.disease_protocols[0] : e.disease_protocols;
    const def = (proto.protocol_definition ?? {}) as {
      labs?: Array<{ frequencyMonths?: number }>;
      vitals?: Array<{ type?: string; frequencyWeeks?: number }>;
      warnings?: Array<{
        metric?: string; condition?: string; threshold?: number;
        severity?: string; messageAr?: string; messageEn?: string;
      }>;
      followUpFrequency?: { months?: number };
    };

    const labMonths = (def.labs ?? [])
      .map((l) => l.frequencyMonths)
      .filter((m): m is number => typeof m === 'number' && m > 0);
    const labFrequencyDays = labMonths.length ? Math.min(...labMonths) * 30 : null;

    const followUpMonths = def.followUpFrequency?.months;
    const followupFrequencyDays =
      typeof followUpMonths === 'number' && followUpMonths > 0 ? followUpMonths * 30 : null;

    const vitals: ProtocolVital[] = (def.vitals ?? [])
      .filter((v): v is { type: string; frequencyWeeks: number } =>
        typeof v.type === 'string' && typeof v.frequencyWeeks === 'number' && v.frequencyWeeks > 0)
      .map((v) => ({ type: v.type, frequencyWeeks: v.frequencyWeeks }));

    const warnings: ProtocolWarning[] = (def.warnings ?? [])
      .filter((w) =>
        typeof w.metric === 'string' && typeof w.threshold === 'number' &&
        (w.condition === 'above' || w.condition === 'below'))
      .map((w) => ({
        metric: w.metric as string,
        condition: w.condition as 'above' | 'below',
        threshold: w.threshold as number,
        severity: w.severity === 'critical' ? 'critical' : 'warning',
        messageAr: (w.messageAr as string) ?? '',
        messageEn: (w.messageEn as string) ?? '',
      }));

    return {
      id: proto.id,
      enrollment_id: e.id as string,
      condition_code: proto.condition_code,
      name_ar: proto.name_ar,
      name_en: proto.name_en,
      labFrequencyDays,
      followupFrequencyDays,
      vitals,
      warnings,
    };
  });

  // 2. Fetch latest data in parallel
  const [labsResult, followUpsResult, vitalsResult] = await Promise.all([
    supabase
      .from('health_records')
      .select('id, lab_date, lab_values, has_abnormal_values')
      .eq('patient_id', patientId)
      .eq('record_type', 'lab_result')
      .is('deleted_at', null)
      .order('lab_date', { ascending: false })
      .limit(10),

    supabase
      .from('follow_up_schedule')
      .select('id, follow_up_date, status')
      .eq('patient_id', patientId)
      .order('follow_up_date', { ascending: false })
      .limit(10),

    supabase
      .from('vitals_history')
      .select('vital_type, value, unit, measured_at')
      .eq('patient_id', patientId)
      .order('measured_at', { ascending: false })
      .limit(50),
  ]);

  const latestLabDate = labsResult.data?.[0]?.lab_date
    ? new Date(labsResult.data[0].lab_date).getTime()
    : 0;

  const latestCompletedFollowUp = (followUpsResult.data ?? []).find(
    (f: Record<string, unknown>) => f.status === 'completed'
  );
  const latestFollowUpDate = latestCompletedFollowUp?.follow_up_date
    ? new Date(latestCompletedFollowUp.follow_up_date).getTime()
    : 0;

  // Latest vital by type (vitals_history rows, newest first).
  const latestVitals = new Map<string, { value: number; measuredAt: number; unit: string }>();
  for (const v of vitalsResult.data ?? []) {
    const rec = v as Record<string, unknown>;
    const vitalType = rec.vital_type as string;
    if (!latestVitals.has(vitalType)) {
      latestVitals.set(vitalType, {
        value: Number(rec.value),
        measuredAt: new Date(rec.measured_at as string).getTime(),
        unit: rec.unit as string,
      });
    }
  }

  // Latest lab value by test code, pulled from the lab_values jsonb of recent
  // lab_result records (newest first → first seen wins). Keyed lowercase so
  // warning metrics (HBA1C, FBG, TSH, creatinine…) match regardless of casing.
  const latestLabValues = new Map<string, { value: number; unit: string }>();
  for (const rec of labsResult.data ?? []) {
    const vals = (rec as Record<string, unknown>).lab_values;
    if (!Array.isArray(vals)) continue;
    for (const lv of vals as Array<Record<string, unknown>>) {
      const code = (lv.test_code ?? lv.testCode) as string | undefined;
      if (!code) continue;
      const key = code.toLowerCase();
      if (latestLabValues.has(key)) continue;
      const num = Number(lv.value);
      if (Number.isNaN(num)) continue;
      latestLabValues.set(key, { value: num, unit: (lv.unit as string) ?? '' });
    }
  }

  // 3. Check each protocol
  for (const protocol of protocols) {
    // 3a. Lab frequency
    if (protocol.labFrequencyDays && protocol.labFrequencyDays > 0) {
      checksPerformed++;
      const dueDate = latestLabDate + protocol.labFrequencyDays * 86400000;
      if (latestLabDate === 0 || now > dueDate) {
        const overdueDays = latestLabDate === 0
          ? protocol.labFrequencyDays
          : Math.floor((now - dueDate) / 86400000);

        alerts.push({
          type: 'overdue_lab',
          severity: overdueDays > protocol.labFrequencyDays ? 'critical' : 'warning',
          messageAr: `تحاليل ${protocol.name_ar} متأخرة بـ ${overdueDays} يوم`,
          messageEn: `${protocol.name_en} labs are ${overdueDays} days overdue`,
          enrollmentId: protocol.enrollment_id,
        });
      } else {
        checksPassed++;
      }
    }

    // 3b. Follow-up frequency
    if (protocol.followupFrequencyDays && protocol.followupFrequencyDays > 0) {
      checksPerformed++;
      const dueDate = latestFollowUpDate + protocol.followupFrequencyDays * 86400000;
      if (latestFollowUpDate === 0 || now > dueDate) {
        const overdueDays = latestFollowUpDate === 0
          ? protocol.followupFrequencyDays
          : Math.floor((now - dueDate) / 86400000);

        alerts.push({
          type: 'overdue_followup',
          severity: overdueDays > protocol.followupFrequencyDays ? 'critical' : 'warning',
          messageAr: `متابعة ${protocol.name_ar} متأخرة بـ ${overdueDays} يوم`,
          messageEn: `${protocol.name_en} follow-up is ${overdueDays} days overdue`,
          enrollmentId: protocol.enrollment_id,
        });
      } else {
        checksPassed++;
      }
    }

    // 3c. Per-vital measurement frequency
    for (const v of protocol.vitals) {
      checksPerformed++;
      const latest = latestVitals.get(v.type);
      const freqDays = v.frequencyWeeks * 7;

      if (!latest) {
        alerts.push({
          type: 'overdue_vital',
          severity: 'warning',
          messageAr: `لا توجد قياسات ${vitalLabelAr(v.type)} مسجلة لبروتوكول ${protocol.name_ar}`,
          messageEn: `No ${v.type} measurements recorded for ${protocol.name_en} protocol`,
          enrollmentId: protocol.enrollment_id,
        });
        continue;
      }

      const dueDate = latest.measuredAt + freqDays * 86400000;
      if (now > dueDate) {
        const overdueDays = Math.floor((now - dueDate) / 86400000);
        alerts.push({
          type: 'overdue_vital',
          severity: overdueDays > freqDays ? 'critical' : 'warning',
          messageAr: `قياس ${vitalLabelAr(v.type)} لبروتوكول ${protocol.name_ar} متأخر بـ ${overdueDays} يوم`,
          messageEn: `${v.type} measurement for ${protocol.name_en} is ${overdueDays} days overdue`,
          enrollmentId: protocol.enrollment_id,
        });
      } else {
        checksPassed++;
      }
    }

    // 3d. Clinical threshold warnings (one check per metric; emit the most severe
    //     breach when several thresholds for the same metric are crossed).
    const warningsByMetric = new Map<string, ProtocolWarning[]>();
    for (const w of protocol.warnings) {
      const arr = warningsByMetric.get(w.metric) ?? [];
      arr.push(w);
      warningsByMetric.set(w.metric, arr);
    }

    for (const [metric, ws] of warningsByMetric) {
      const vital = latestVitals.get(metric);
      const lab = latestLabValues.get(metric.toLowerCase());
      const reading = vital ? vital.value : lab?.value;
      const unit = vital ? vital.unit : (lab?.unit ?? '');

      // No measurement for this metric → nothing to evaluate (the missing-vital
      // case is already covered by 3c for protocol vitals).
      if (reading === undefined) continue;

      checksPerformed++;
      const breached = ws.filter((w) =>
        w.condition === 'above' ? reading > w.threshold : reading < w.threshold);

      if (breached.length === 0) {
        checksPassed++;
        continue;
      }

      const chosen = breached.find((w) => w.severity === 'critical') ?? breached[0]!;
      alerts.push({
        type: 'threshold_exceeded',
        severity: chosen.severity,
        messageAr: chosen.messageAr
          || `قياس ${vitalLabelAr(metric)} (${reading} ${unit}) تجاوز الحد (${chosen.threshold})`,
        messageEn: chosen.messageEn
          || `${metric} reading (${reading} ${unit}) breached threshold (${chosen.threshold})`,
        enrollmentId: protocol.enrollment_id,
        thresholdValue: String(chosen.threshold),
        actualValue: String(reading),
        unit,
      });
    }
  }

  const compliancePct = checksPerformed > 0
    ? Math.round((checksPassed / checksPerformed) * 100)
    : 100;

  return {
    compliancePct,
    alerts,
    checksPerformed,
    checksPassed,
  };
}
