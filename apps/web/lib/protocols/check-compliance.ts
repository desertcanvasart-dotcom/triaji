/**
 * Protocol Compliance Checker
 *
 * Checks a patient's compliance with their enrolled disease protocols:
 * - Last lab dates vs protocol-required lab frequency
 * - Last vital dates vs expected measurement intervals
 * - Last follow-up dates vs protocol follow-up frequency
 * - Threshold warnings from recent vitals/lab results
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

interface VitalThreshold {
  vital_type: string;
  min?: number;
  max?: number;
  unit: string;
  severity: 'critical' | 'warning';
}

interface ProtocolRecord {
  id: string;
  enrollment_id: string;
  condition_code: string;
  name_ar: string;
  name_en: string;
  lab_frequency_days: number | null;
  followup_frequency_days: number | null;
  vital_thresholds: VitalThreshold[] | null;
}

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
      disease_protocols!inner(id, condition_code, name_ar, name_en, lab_frequency_days, followup_frequency_days, vital_thresholds)
    `)
    .eq('patient_id', patientId)
    .eq('is_active', true);

  if (!enrollments || enrollments.length === 0) {
    return { compliancePct: 100, alerts: [], checksPerformed: 0, checksPassed: 0 };
  }

  // Build protocol list
  const protocols: ProtocolRecord[] = enrollments.map((e: Record<string, unknown>) => {
    const proto = Array.isArray(e.disease_protocols) ? e.disease_protocols[0] : e.disease_protocols;
    return {
      id: proto.id,
      enrollment_id: e.id as string,
      condition_code: proto.condition_code,
      name_ar: proto.name_ar,
      name_en: proto.name_en,
      lab_frequency_days: proto.lab_frequency_days,
      followup_frequency_days: proto.followup_frequency_days,
      vital_thresholds: proto.vital_thresholds,
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

  // Build latest vital by type
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

  // 3. Check each protocol
  for (const protocol of protocols) {
    // Check lab frequency
    if (protocol.lab_frequency_days && protocol.lab_frequency_days > 0) {
      checksPerformed++;
      const dueDate = latestLabDate + protocol.lab_frequency_days * 86400000;
      if (latestLabDate === 0 || now > dueDate) {
        const overdueDays = latestLabDate === 0
          ? protocol.lab_frequency_days
          : Math.floor((now - dueDate) / 86400000);

        alerts.push({
          type: 'overdue_lab',
          severity: overdueDays > protocol.lab_frequency_days ? 'critical' : 'warning',
          messageAr: `تحاليل ${protocol.name_ar} متأخرة بـ ${overdueDays} يوم`,
          messageEn: `${protocol.name_en} labs are ${overdueDays} days overdue`,
          enrollmentId: protocol.enrollment_id,
        });
      } else {
        checksPassed++;
      }
    }

    // Check follow-up frequency
    if (protocol.followup_frequency_days && protocol.followup_frequency_days > 0) {
      checksPerformed++;
      const dueDate = latestFollowUpDate + protocol.followup_frequency_days * 86400000;
      if (latestFollowUpDate === 0 || now > dueDate) {
        const overdueDays = latestFollowUpDate === 0
          ? protocol.followup_frequency_days
          : Math.floor((now - dueDate) / 86400000);

        alerts.push({
          type: 'overdue_followup',
          severity: overdueDays > protocol.followup_frequency_days ? 'critical' : 'warning',
          messageAr: `متابعة ${protocol.name_ar} متأخرة بـ ${overdueDays} يوم`,
          messageEn: `${protocol.name_en} follow-up is ${overdueDays} days overdue`,
          enrollmentId: protocol.enrollment_id,
        });
      } else {
        checksPassed++;
      }
    }

    // Check vital thresholds
    if (protocol.vital_thresholds && Array.isArray(protocol.vital_thresholds)) {
      for (const threshold of protocol.vital_thresholds) {
        checksPerformed++;
        const vital = latestVitals.get(threshold.vital_type);

        if (!vital) {
          // No measurement on record
          alerts.push({
            type: 'overdue_vital',
            severity: 'warning',
            messageAr: `لا توجد قياسات ${threshold.vital_type} مسجلة لبروتوكول ${protocol.name_ar}`,
            messageEn: `No ${threshold.vital_type} measurements recorded for ${protocol.name_en} protocol`,
            enrollmentId: protocol.enrollment_id,
          });
          continue;
        }

        let exceeded = false;
        if (threshold.max !== undefined && vital.value > threshold.max) {
          exceeded = true;
        }
        if (threshold.min !== undefined && vital.value < threshold.min) {
          exceeded = true;
        }

        if (exceeded) {
          const rangeAr = threshold.min !== undefined && threshold.max !== undefined
            ? `${threshold.min}-${threshold.max}`
            : threshold.max !== undefined ? `< ${threshold.max}` : `> ${threshold.min}`;

          alerts.push({
            type: 'threshold_exceeded',
            severity: threshold.severity,
            messageAr: `قياس ${threshold.vital_type} (${vital.value} ${threshold.unit}) خارج النطاق الطبيعي (${rangeAr})`,
            messageEn: `${threshold.vital_type} reading (${vital.value} ${threshold.unit}) is outside normal range (${rangeAr})`,
            enrollmentId: protocol.enrollment_id,
            thresholdValue: rangeAr,
            actualValue: String(vital.value),
            unit: threshold.unit,
          });
        } else {
          checksPassed++;
        }
      }
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
