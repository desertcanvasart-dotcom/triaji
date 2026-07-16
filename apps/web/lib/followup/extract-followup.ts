/**
 * Follow-Up Extraction from Doctor Notes
 *
 * Uses Claude API to extract follow-up dates from free-text clinical notes.
 * Non-blocking: fires async and does not block the consultation flow.
 */

import { createServerClient } from '@triaji/shared/supabase';
import Anthropic from '@anthropic-ai/sdk';

export interface FollowUpExtraction {
  hasFollowUp: boolean;
  followUpDate: string | null; // YYYY-MM-DD
  reason: string | null;       // Arabic
  confidence: number;          // 0.0 – 1.0
}

const EXTRACTION_PROMPT = `You are a medical assistant. Given clinical notes (in Arabic or English), extract follow-up information.

Return JSON only:
{
  "hasFollowUp": boolean,
  "followUpDate": "YYYY-MM-DD" or null,
  "reason": "Arabic brief reason" or null,
  "confidence": 0.0-1.0
}

Rules:
- If notes mention a follow-up, return date and reason.
- Interpret relative dates (e.g. "بعد أسبوعين" = 2 weeks from today, "بعد شهر" = 1 month from today).
- Today's date is provided in the user message.
- If no follow-up is mentioned, return hasFollowUp=false.
- Confidence reflects how certain you are about the extracted date.`;

/**
 * Extract follow-up information from doctor's notes using Claude.
 */
export async function extractFollowUp(
  notes: string,
  todayDate?: string
): Promise<FollowUpExtraction> {
  const noResult: FollowUpExtraction = {
    hasFollowUp: false,
    followUpDate: null,
    reason: null,
    confidence: 0,
  };

  if (!notes || notes.trim().length < 5) {
    return noResult;
  }

  const apiKey = process.env['ANTHROPIC_API_KEY'];
  if (!apiKey) {
    console.warn('[extract-followup] ANTHROPIC_API_KEY not set, skipping extraction');
    return noResult;
  }

  const today = todayDate ?? new Date().toISOString().slice(0, 10);

  try {
    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 256,
      system: EXTRACTION_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Today's date: ${today}\n\nClinical notes:\n${notes}`,
        },
      ],
    });

    const text = response.content[0]?.type === 'text' ? response.content[0].text : '';

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return noResult;

    const parsed = JSON.parse(jsonMatch[0]) as FollowUpExtraction;

    // Validate
    if (typeof parsed.hasFollowUp !== 'boolean') return noResult;
    if (parsed.hasFollowUp && !parsed.followUpDate) return noResult;
    if (parsed.confidence == null || parsed.confidence < 0 || parsed.confidence > 1) {
      parsed.confidence = 0.5;
    }

    return parsed;
  } catch (err) {
    console.error('[extract-followup] Extraction failed:', err);
    return noResult;
  }
}

/**
 * Process doctor notes and create a follow-up schedule if extraction is confident.
 * Non-blocking: call with fire-and-forget pattern.
 *
 * Only creates follow_up_schedule if:
 * - confidence > 0.75
 * - No existing doctor_picker follow-up for same patient/doctor on that date
 */
export async function processNotesForFollowUp(params: {
  notes: string;
  patientId: string;
  doctorId: string;
  doctorAccountId: string;
  bookingId?: string;
  healthRecordId?: string;
}): Promise<void> {
  try {
    const extraction = await extractFollowUp(params.notes);

    if (!extraction.hasFollowUp || !extraction.followUpDate || extraction.confidence <= 0.75) {
      return;
    }

    const supabase = createServerClient();

    // Check for existing doctor_picker follow-up on same date
    const { data: existing } = await supabase
      .from('follow_up_schedule')
      .select('id')
      .eq('patient_id', params.patientId)
      .eq('doctor_account_id', params.doctorAccountId)
      .eq('follow_up_date', extraction.followUpDate)
      .eq('source', 'doctor_picker')
      .neq('status', 'cancelled')
      .maybeSingle();

    if (existing) {
      // Doctor already manually created a follow-up for this date
      return;
    }

    // Create AI-extracted follow-up
    const { error } = await supabase
      .from('follow_up_schedule')
      .insert({
        patient_id: params.patientId,
        doctor_id: params.doctorId,
        doctor_account_id: params.doctorAccountId,
        booking_id: params.bookingId ?? null,
        health_record_id: params.healthRecordId ?? null,
        follow_up_date: extraction.followUpDate,
        reason_ar: extraction.reason,
        source: 'ai_extraction',
        ai_confidence: extraction.confidence,
        status: 'scheduled',
      });

    if (error) {
      console.error('[extract-followup] Insert failed:', error.message);
    } else {
      console.log(
        `[extract-followup] Created AI follow-up for patient ${params.patientId} on ${extraction.followUpDate} (confidence: ${extraction.confidence})`
      );
    }
  } catch (err) {
    console.error('[extract-followup] processNotesForFollowUp error:', err);
  }
}
