/**
 * Health Record Analyser
 * Uses Claude vision/document analysis to extract structured data
 * from prescription photos and lab result PDFs.
 */

import Anthropic from '@anthropic-ai/sdk';
import { CLAUDE_MODEL } from '@triaji/shared/constants';
import { createServerClient } from '@triaji/shared/supabase';
import type {
  HealthRecord,
  PrescriptionAnalysis,
  LabResultAnalysis,
  Medication,
  LabValue,
} from './types';

const MODEL = CLAUDE_MODEL;

// ─── Analysis Prompts ───────────────────────────────────────────────────────

const PRESCRIPTION_ANALYSIS_PROMPT = `You are analysing a medical prescription from Egypt.
Extract the following information and respond ONLY with valid JSON, no other text:

{
  "medications": [
    {
      "name_ar": "string — Arabic medication name as written",
      "name_en": "string — English/generic medication name if identifiable",
      "dose": "string — dosage amount and unit",
      "frequency": "string — how often (e.g. twice daily)",
      "duration": "string — for how long if specified",
      "prescribing_doctor": "string — doctor name if visible"
    }
  ],
  "prescription_date": "YYYY-MM-DD or null",
  "prescribing_doctor": "string — doctor name from header if visible",
  "summary_ar": "string — 2 sentence Arabic summary of what was prescribed",
  "summary_en": "string — 2 sentence English summary"
}

If you cannot read part of the prescription clearly, use null for that field.
Do not guess medication names — use null if uncertain.`;

const LAB_RESULT_ANALYSIS_PROMPT = `You are analysing a medical laboratory result from Egypt.
Extract the following information and respond ONLY with valid JSON, no other text:

{
  "lab_values": [
    {
      "test_name": "string — test name",
      "value": "string — result value",
      "unit": "string — unit of measurement",
      "reference_range": "string — normal range if shown",
      "is_abnormal": boolean — true if marked as abnormal or outside reference range
    }
  ],
  "lab_date": "YYYY-MM-DD or null",
  "lab_name": "string — laboratory name if visible",
  "has_abnormal_values": boolean,
  "summary_ar": "string — 2 sentence Arabic summary of key findings",
  "summary_en": "string — 2 sentence English summary",
  "requires_attention": boolean — true if any values are significantly abnormal
}

If a value is flagged with H (high) or L (low) or marked in red, set is_abnormal to true.`;

const GENERIC_ANALYSIS_PROMPT = `You are analysing a medical document from Egypt.
Provide a brief summary. Respond ONLY with valid JSON:

{
  "summary_ar": "string — 2 sentence Arabic summary",
  "summary_en": "string — 2 sentence English summary",
  "requires_attention": boolean — true if anything needs medical attention
}`;

// ─── Analyser ───────────────────────────────────────────────────────────────

let anthropicClient: Anthropic | null = null;

function getAnthropic(): Anthropic {
  if (!anthropicClient) {
    const apiKey = process.env['ANTHROPIC_API_KEY'];
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
    anthropicClient = new Anthropic({ apiKey });
  }
  return anthropicClient;
}

/**
 * Get a signed URL for a health record file from Supabase Storage.
 */
async function getSignedUrl(fileUrl: string): Promise<string> {
  const supabase = createServerClient();
  const { data, error } = await supabase.storage
    .from('health-records')
    .createSignedUrl(fileUrl, 3600); // 1 hour

  if (error || !data?.signedUrl) {
    throw new Error(`Failed to create signed URL: ${error?.message ?? 'unknown'}`);
  }
  return data.signedUrl;
}

/**
 * Fetch a file as base64 for sending to Claude.
 */
async function fetchAsBase64(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch file: ${response.statusText}`);
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return buffer.toString('base64');
}

/**
 * Analyse a health record using Claude vision/document analysis.
 */
export async function analyseHealthRecord(recordId: string): Promise<void> {
  const supabase = createServerClient();

  // 1. Load record from DB
  const { data: record, error: fetchError } = await supabase
    .from('health_records')
    .select('*')
    .eq('id', recordId)
    .is('deleted_at', null)
    .single();

  if (fetchError || !record) {
    throw new Error(`Record not found: ${recordId}`);
  }

  const healthRecord = record as HealthRecord;

  // 2. Get signed URL
  const signedUrl = await getSignedUrl(healthRecord.file_url);

  // 3. Determine prompt based on record type
  let prompt: string;
  switch (healthRecord.record_type) {
    case 'prescription':
      prompt = PRESCRIPTION_ANALYSIS_PROMPT;
      break;
    case 'lab_result':
      prompt = LAB_RESULT_ANALYSIS_PROMPT;
      break;
    default:
      prompt = GENERIC_ANALYSIS_PROMPT;
      break;
  }

  // 4. Send to Claude API
  const anthropic = getAnthropic();
  const isImage = healthRecord.mime_type.startsWith('image/');
  const isPdf = healthRecord.mime_type === 'application/pdf';

  let contentBlocks: Anthropic.Messages.ContentBlockParam[];

  if (isImage) {
    const base64 = await fetchAsBase64(signedUrl);
    const mediaType = healthRecord.mime_type as 'image/jpeg' | 'image/png' | 'image/webp';
    contentBlocks = [
      {
        type: 'image',
        source: { type: 'base64', media_type: mediaType, data: base64 },
      },
      { type: 'text', text: prompt },
    ];
  } else if (isPdf) {
    const base64 = await fetchAsBase64(signedUrl);
    contentBlocks = [
      {
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: base64 },
      } as unknown as Anthropic.Messages.ContentBlockParam,
      { type: 'text', text: prompt },
    ];
  } else {
    throw new Error(`Unsupported MIME type: ${healthRecord.mime_type}`);
  }

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2000,
    messages: [{ role: 'user', content: contentBlocks }],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Claude returned no text response');
  }

  // 5. Parse JSON response
  const jsonText = textBlock.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonText) as Record<string, unknown>;
  } catch {
    console.error('[Analyser] Failed to parse Claude response:', textBlock.text);
    throw new Error('Failed to parse analysis response');
  }

  // 6. Update record based on type
  const updates: Record<string, unknown> = {
    analysed: true,
    analysed_at: new Date().toISOString(),
    summary_ar: (parsed['summary_ar'] as string) ?? null,
    summary_en: (parsed['summary_en'] as string) ?? null,
    requires_attention: (parsed['requires_attention'] as boolean) ?? false,
  };

  if (healthRecord.record_type === 'prescription') {
    const analysis = parsed as unknown as PrescriptionAnalysis;
    updates.medications = analysis.medications ?? [];
    updates.prescription_date = analysis.prescription_date ?? null;
    updates.prescribing_doctor = analysis.prescribing_doctor ?? null;
  } else if (healthRecord.record_type === 'lab_result') {
    const analysis = parsed as unknown as LabResultAnalysis;
    updates.lab_values = analysis.lab_values ?? [];
    updates.lab_date = analysis.lab_date ?? null;
    updates.lab_name = analysis.lab_name ?? null;
    updates.has_abnormal_values = analysis.has_abnormal_values ?? false;
  }

  const { error: updateError } = await supabase
    .from('health_records')
    .update(updates)
    .eq('id', recordId);

  if (updateError) {
    throw new Error(`Failed to update record: ${updateError.message}`);
  }
}

/**
 * Get recent health records for a patient (for triage context injection).
 */
export async function getRecentHealthRecords(
  patientId: string,
  daysBack: number = 90
): Promise<Pick<HealthRecord, 'record_type' | 'summary_ar' | 'summary_en'>[]> {
  const supabase = createServerClient();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysBack);

  // Only the fields the triage prompt uses — health_records rows carry large
  // JSONB (medications, lab_values) that would otherwise be fetched per chat turn.
  const { data, error } = await supabase
    .from('health_records')
    .select('record_type, summary_ar, summary_en')
    .eq('patient_id', patientId)
    .eq('analysed', true)
    .is('deleted_at', null)
    .gte('uploaded_at', cutoff.toISOString())
    .order('uploaded_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('[Records] Failed to fetch recent records:', error.message);
    return [];
  }

  return (data ?? []) as Pick<HealthRecord, 'record_type' | 'summary_ar' | 'summary_en'>[];
}
