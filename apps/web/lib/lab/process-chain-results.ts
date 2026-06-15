/**
 * Process Chain Lab Results
 *
 * Handles incoming results from chain APIs (via webhook or polling).
 * AMENDMENT: Supports partial results — only marks 'results_ready'
 * when isComplete=true; otherwise stores partial data and continues polling.
 */

import Anthropic from '@anthropic-ai/sdk';
import { createServerClient } from '@triaji/shared/supabase';
import type { LabChainResult, LabChainCode, LabChainTestResult } from '@triaji/lab-chain-adapters';
import { notifyPatientChainResults, notifyDoctorChainResults } from './chain-notifications';
import { extractVitalsFromLabValues, insertVitalsFromLabResult } from '@/lib/vitals/extract-from-lab';
import type { Lang } from '@triaji/shared/i18n/strings';

const MODEL = 'claude-sonnet-4-20250514';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface RoutingContext {
  routingId: string;
  healthRecordId: string;
  patientId: string;
  patientPhone: string;
  patientLang: Lang;
  patientName: string;
  chainCode: LabChainCode;
  doctorPhone?: string;
  doctorLang?: Lang;
}

// ─── Main Processor ─────────────────────────────────────────────────────────────

/**
 * Process results received from a lab chain.
 *
 * AMENDMENT: If chainResult status is 'partial' or results are not complete,
 * stores partial data and keeps polling. Only finalizes when isComplete=true.
 */
export async function processChainResults(
  routingId: string,
  chainResult: LabChainResult,
): Promise<void> {
  const supabase = createServerClient();

  // ─── Check completeness ───────────────────────────────────────────────────
  const isComplete = chainResult.status === 'completed';

  if (!isComplete) {
    // Store partial results, keep status as 'processing'
    await supabase
      .from('lab_order_routing')
      .update({
        status: 'processing',
        partial_results: chainResult.results as unknown as Record<string, unknown>[],
        partial_results_count: chainResult.results.length,
        last_polled_at: new Date().toISOString(),
      })
      .eq('id', routingId);

    console.log(
      `[process-chain-results] Partial results for routing ${routingId}: ` +
      `${chainResult.results.length} tests received, continuing polling.`
    );
    return;
  }

  // ─── Full results — proceed with processing ───────────────────────────────
  const ctx = await loadRoutingContext(supabase, routingId);
  if (!ctx) {
    console.error(`[process-chain-results] Could not load context for routing ${routingId}`);
    return;
  }

  // Map chain test codes back to Triajji codes
  const mappedResults = await mapResultCodes(supabase, ctx.chainCode, chainResult.results);

  // Build lab_values array (same format as Phase 17 manual upload)
  const labValues = mappedResults.map((r) => ({
    test_code: r.triajiCode ?? r.testCode,
    test_name: r.testName,
    test_name_ar: r.testNameAr,
    value: r.value,
    unit: r.unit ?? '',
    reference_range: r.referenceRange,
    abnormal: r.abnormal ?? false,
    notes: r.notes,
  }));

  // Generate Arabic summary via Claude
  const summaries = await generateResultSummary(labValues);

  // Create health_records row (same format as Phase 17)
  const { data: newRecord, error: insertError } = await supabase
    .from('health_records')
    .insert({
      patient_id: ctx.patientId,
      record_type: 'lab_result',
      source: 'chain_api',
      source_chain_code: ctx.chainCode,
      lab_values: labValues,
      test_codes: mappedResults.map((r) => r.triajiCode ?? r.testCode),
      summary_ar: summaries.summaryAr,
      summary_en: summaries.summaryEn,
      pdf_url: chainResult.pdfUrl,
      result_date: chainResult.completedAt ?? new Date().toISOString(),
      chain_order_id: chainResult.orderId,
      created_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (insertError) {
    console.error(`[process-chain-results] Failed to insert health_record:`, insertError);
    return;
  }

  const newHealthRecordId = newRecord.id as string;

  // Update routing status to 'results_ready'
  await supabase
    .from('lab_order_routing')
    .update({
      status: 'results_ready',
      results_health_record_id: newHealthRecordId,
      results_received_at: new Date().toISOString(),
      partial_results: null, // Clear partial results
    })
    .eq('id', routingId);

  // Extract vitals from results (Phase 19 pattern)
  const vitalsResult = await insertVitalsFromLabResult(
    supabase,
    ctx.patientId,
    newHealthRecordId,
    labValues.map((lv) => ({
      test_code: lv.test_code,
      test_name: lv.test_name,
      value: lv.value,
      unit: lv.unit,
      reference_range: lv.reference_range,
    })),
    chainResult.completedAt,
  );

  if (vitalsResult.errors.length > 0) {
    console.warn(`[process-chain-results] Vitals extraction errors:`, vitalsResult.errors);
  }

  // Count abnormal results
  const abnormalCount = labValues.filter((lv) => lv.abnormal).length;

  // Build results view URL
  const appUrl = process.env['NEXT_PUBLIC_APP_URL'] ?? 'https://triajji.com';
  const viewUrl = `${appUrl}/ar/lab/results/${routingId}`;

  // ─── Notify patient ────────────────────────────────────────────────────────
  await notifyPatientChainResults(ctx.patientPhone, ctx.patientLang, {
    chainCode: ctx.chainCode,
    testCount: labValues.length,
    abnormalCount,
    summaryAr: summaries.summaryAr,
    summaryEn: summaries.summaryEn,
    viewUrl,
  }).catch((err) => {
    console.error(`[process-chain-results] Failed to notify patient:`, err);
  });

  // ─── Notify doctor ─────────────────────────────────────────────────────────
  if (ctx.doctorPhone) {
    await notifyDoctorChainResults(ctx.doctorPhone, ctx.doctorLang ?? 'ar', {
      patientName: ctx.patientName,
      chainCode: ctx.chainCode,
      testCount: labValues.length,
      abnormalCount,
      routingId,
    }).catch((err) => {
      console.error(`[process-chain-results] Failed to notify doctor:`, err);
    });
  }

  console.log(
    `[process-chain-results] Completed processing for routing ${routingId}: ` +
    `${labValues.length} tests, ${abnormalCount} abnormal, ${vitalsResult.inserted} vitals extracted.`
  );
}

// ─── Context Loader ─────────────────────────────────────────────────────────────

async function loadRoutingContext(
  supabase: ReturnType<typeof createServerClient>,
  routingId: string,
): Promise<RoutingContext | null> {
  const { data: routing } = await supabase
    .from('lab_order_routing')
    .select(`
      id,
      health_record_id,
      chain_code,
      health_record:health_records!lab_order_routing_health_record_id_fkey (
        patient_id,
        booking_id
      )
    `)
    .eq('id', routingId)
    .single();

  if (!routing) return null;

  const hr = routing.health_record as unknown as Record<string, string> | null;
  if (!hr?.patient_id) return null;

  // Load patient
  const { data: patient } = await supabase
    .from('patients')
    .select('id, name_ar, phone_number, patient_profiles(preferred_language)')
    .eq('id', hr.patient_id)
    .single();

  if (!patient) return null;

  const patientLang =
    ((patient.patient_profiles as { preferred_language: string | null }[] | null)?.[0]
      ?.preferred_language ?? 'ar') as Lang;

  // Load doctor if booking exists
  let doctorPhone: string | undefined;
  let doctorLang: Lang | undefined;

  if (hr.booking_id) {
    const { data: booking } = await supabase
      .from('bookings')
      .select(`
        doctor:doctors!bookings_doctor_id_fkey (
          phone_number,
          preferred_language
        )
      `)
      .eq('id', hr.booking_id)
      .single();

    const doctor = booking?.doctor as unknown as Record<string, string> | null;
    doctorPhone = doctor?.phone_number;
    doctorLang = (doctor?.preferred_language ?? 'ar') as Lang;
  }

  return {
    routingId,
    healthRecordId: routing.health_record_id as string,
    patientId: patient.id as string,
    patientPhone: patient.phone_number as string,
    patientLang,
    patientName: patient.name_ar as string,
    chainCode: routing.chain_code as LabChainCode,
    doctorPhone,
    doctorLang,
  };
}

// ─── Code Mapping (Chain → Triajji) ──────────────────────────────────────────────

interface MappedResult extends LabChainTestResult {
  triajiCode?: string;
}

async function mapResultCodes(
  supabase: ReturnType<typeof createServerClient>,
  chainCode: LabChainCode,
  results: LabChainTestResult[],
): Promise<MappedResult[]> {
  const chainCodes = results.map((r) => r.testCode);

  const { data: mappings } = await supabase
    .from('lab_chain_test_mapping')
    .select('triaji_code, chain_test_code')
    .eq('chain_code', chainCode)
    .in('chain_test_code', chainCodes);

  const codeMap = new Map(
    (mappings ?? []).map((m) => [m.chain_test_code, m.triaji_code]),
  );

  return results.map((r) => ({
    ...r,
    triajiCode: codeMap.get(r.testCode),
  }));
}

// ─── Arabic Summary Generation ──────────────────────────────────────────────────

async function generateResultSummary(
  labValues: Array<{
    test_code: string;
    test_name: string;
    test_name_ar?: string;
    value: string;
    unit: string;
    reference_range?: string;
    abnormal: boolean;
  }>,
): Promise<{ summaryAr: string; summaryEn: string }> {
  const apiKey = process.env['ANTHROPIC_API_KEY'];
  if (!apiKey) {
    // Fallback: generate a simple summary without AI
    const abnormalCount = labValues.filter((v) => v.abnormal).length;
    return {
      summaryAr: abnormalCount > 0
        ? `تحاليل ${labValues.length} — ${abnormalCount} نتيجة خارج المعدل الطبيعي.`
        : `تحاليل ${labValues.length} — جميع النتائج طبيعية.`,
      summaryEn: abnormalCount > 0
        ? `${labValues.length} tests — ${abnormalCount} abnormal result(s).`
        : `${labValues.length} tests — all within normal range.`,
    };
  }

  try {
    const anthropic = new Anthropic({ apiKey });

    const labSummaryInput = labValues.map((v) => ({
      test: v.test_name_ar ?? v.test_name,
      value: `${v.value} ${v.unit}`,
      range: v.reference_range ?? 'N/A',
      abnormal: v.abnormal,
    }));

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: `You are a medical lab assistant. Given these lab results, provide:
1. A 2-3 sentence Arabic summary (Egyptian dialect, patient-friendly)
2. A 2-3 sentence English summary

Respond ONLY with valid JSON: {"summaryAr": "...", "summaryEn": "..."}

Lab Results:
${JSON.stringify(labSummaryInput, null, 2)}`,
        },
      ],
    });

    const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
    const parsed = JSON.parse(text);
    return {
      summaryAr: parsed.summaryAr ?? '',
      summaryEn: parsed.summaryEn ?? '',
    };
  } catch (err) {
    console.error('[process-chain-results] Failed to generate AI summary:', err);
    const abnormalCount = labValues.filter((v) => v.abnormal).length;
    return {
      summaryAr: abnormalCount > 0
        ? `تحاليل ${labValues.length} — ${abnormalCount} نتيجة خارج المعدل الطبيعي.`
        : `تحاليل ${labValues.length} — جميع النتائج طبيعية.`,
      summaryEn: abnormalCount > 0
        ? `${labValues.length} tests — ${abnormalCount} abnormal result(s).`
        : `${labValues.length} tests — all within normal range.`,
    };
  }
}
