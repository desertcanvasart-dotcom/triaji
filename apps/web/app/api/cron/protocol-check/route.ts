/**
 * Protocol Compliance Check Cron Route
 *
 * GET /api/cron/protocol-check
 * Called daily by Railway cron.
 * Protected by x-cron-secret header.
 *
 * For each enrolled patient:
 * 1. Check overdue labs (last lab date vs protocol frequency)
 * 2. Check overdue follow-ups
 * 3. Check threshold warnings from recent vitals/lab results
 * 4. Send critical alerts immediately, queue warnings for weekly digest
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkPatientCompliance } from '@/lib/protocols/check-compliance';
import { sendCriticalThresholdAlert, sendWeeklyProtocolDigest } from '@/lib/protocols/notifications';

export const dynamic = 'force-dynamic';

function getServiceClient() {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

interface CronResult {
  patientsChecked: number;
  criticalAlertsSent: number;
  warningsQueued: number;
  digestsSent: number;
  errors: string[];
}

export async function GET(request: NextRequest) {
  // Verify cron secret
  const secret = request.headers.get('x-cron-secret');
  const cronSecret = process.env['CRON_SECRET'];

  if (!cronSecret || secret !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServiceClient();
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday

  const result: CronResult = {
    patientsChecked: 0,
    criticalAlertsSent: 0,
    warningsQueued: 0,
    digestsSent: 0,
    errors: [],
  };

  try {
    // Fetch all active protocol enrollments with patient info
    const { data: enrollments, error: enrollError } = await supabase
      .from('patient_protocol_enrollment')
      .select(`
        id, patient_id, protocol_id, enrolled_at,
        patients!inner(phone_number, name_ar, patient_profiles(preferred_language)),
        disease_protocols!inner(name_ar, name_en, condition_code, lab_frequency_days, followup_frequency_days, vital_thresholds)
      `)
      .eq('is_active', true);

    if (enrollError) {
      return NextResponse.json({
        success: false,
        error: `Failed to fetch enrollments: ${enrollError.message}`,
      }, { status: 500 });
    }

    // Group enrollments by patient to avoid duplicate checks
    const patientMap = new Map<string, {
      phone: string;
      lang: string;
      nameAr: string;
      enrollmentIds: string[];
    }>();

    for (const e of enrollments ?? []) {
      const rec = e as Record<string, unknown>;
      const pid = rec.patient_id as string;
      const patient = Array.isArray(rec.patients) ? rec.patients[0] : rec.patients;

      if (!patientMap.has(pid)) {
        patientMap.set(pid, {
          phone: patient?.phone_number ?? '',
          lang: patient?.patient_profiles?.[0]?.preferred_language ?? 'ar',
          nameAr: patient?.name_ar ?? '',
          enrollmentIds: [],
        });
      }
      patientMap.get(pid)!.enrollmentIds.push(rec.id as string);
    }

    // Check each patient's compliance
    for (const [patientId, patientInfo] of patientMap) {
      try {
        const compliance = await checkPatientCompliance(patientId);
        result.patientsChecked++;

        // Process critical alerts — send immediately
        const criticalAlerts = compliance.alerts.filter(a => a.severity === 'critical');
        for (const alert of criticalAlerts) {
          // Insert alert record
          await supabase.from('protocol_alerts').insert({
            patient_id: patientId,
            enrollment_id: alert.enrollmentId ?? null,
            alert_type: alert.type,
            severity: alert.severity,
            message_ar: alert.messageAr,
            message_en: alert.messageEn,
            threshold_value: alert.thresholdValue ?? null,
            actual_value: alert.actualValue ?? null,
            unit: alert.unit ?? null,
            created_at: now.toISOString(),
          });

          // Send immediate notification
          if (patientInfo.phone) {
            const sendResult = await sendCriticalThresholdAlert(
              patientInfo.phone,
              patientInfo.lang,
              {
                patientName: patientInfo.nameAr,
                alertMessage: patientInfo.lang === 'en' ? alert.messageEn : alert.messageAr,
                value: alert.actualValue ?? '',
                unit: alert.unit ?? '',
              }
            );
            if (sendResult.success) {
              result.criticalAlertsSent++;
            } else {
              result.errors.push(`Critical alert send failed for ${patientId}: ${sendResult.error}`);
            }
          }
        }

        // Queue non-critical warnings
        const warnings = compliance.alerts.filter(a => a.severity === 'warning' || a.severity === 'info');
        for (const alert of warnings) {
          await supabase.from('protocol_alerts').insert({
            patient_id: patientId,
            enrollment_id: alert.enrollmentId ?? null,
            alert_type: alert.type,
            severity: alert.severity,
            message_ar: alert.messageAr,
            message_en: alert.messageEn,
            threshold_value: alert.thresholdValue ?? null,
            actual_value: alert.actualValue ?? null,
            unit: alert.unit ?? null,
            created_at: now.toISOString(),
          });
          result.warningsQueued++;
        }

        // Send weekly digest on Sundays
        if (dayOfWeek === 0 && patientInfo.phone) {
          // Get all unresolved warnings for this patient
          const { data: weekAlerts } = await supabase
            .from('protocol_alerts')
            .select('alert_type, severity, message_ar, message_en, created_at')
            .eq('patient_id', patientId)
            .is('resolved_at', null)
            .in('severity', ['warning', 'info'])
            .gte('created_at', new Date(now.getTime() - 7 * 86400000).toISOString())
            .order('created_at', { ascending: false });

          if (weekAlerts && weekAlerts.length > 0) {
            const digestResult = await sendWeeklyProtocolDigest(
              patientInfo.phone,
              patientInfo.lang,
              weekAlerts.map((a: Record<string, unknown>) => ({
                type: a.alert_type as string,
                messageAr: a.message_ar as string,
                messageEn: a.message_en as string,
              }))
            );
            if (digestResult.success) {
              result.digestsSent++;
            }
          }
        }

        // Update compliance percentage on enrollment
        for (const enrollmentId of patientInfo.enrollmentIds) {
          await supabase
            .from('patient_protocol_enrollment')
            .update({ overall_compliance_pct: compliance.compliancePct })
            .eq('id', enrollmentId);
        }
      } catch (err) {
        result.errors.push(`Patient ${patientId}: ${err instanceof Error ? err.message : 'Unknown'}`);
      }
    }

    console.log('[cron/protocol-check] Result:', JSON.stringify(result));

    return NextResponse.json({
      success: true,
      ...result,
      timestamp: now.toISOString(),
    });
  } catch (err) {
    console.error('[cron/protocol-check] Fatal error:', err);
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    }, { status: 500 });
  }
}
