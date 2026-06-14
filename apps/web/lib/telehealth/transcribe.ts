/**
 * GP Video Call Transcription Pipeline
 *
 * Steps:
 * 1. Download recording from Supabase Storage
 * 2. Transcribe via Deepgram (Arabic, nova-2, diarize + utterances)
 * 3. Format with speaker labels (الطبيب / المريض)
 * 4. Extract structured clinical notes via Claude (with patient context)
 * 5. Store transcription + structured notes
 * 6. Notify doctor
 */

import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { sendPushNotification } from '@/lib/notifications/push';

// ─── Config ─────────────────────────────────────────────────────────────────

const DEEPGRAM_API_KEY = process.env['DEEPGRAM_API_KEY'] ?? '';
const ANTHROPIC_API_KEY = process.env['ANTHROPIC_API_KEY'] ?? '';

function getServiceClient() {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface CallRow {
  id: string;
  patient_id: string;
  doctor_id: string;
  doctor_account_id: string;
  recording_url: string | null;
  livekit_room_name: string;
}

interface DoctorAccountRow {
  id: string;
  name_ar: string;
  expo_push_token: string | null;
}

interface DeepgramUtterance {
  speaker: number;
  transcript: string;
  start: number;
  end: number;
}

interface DeepgramResponse {
  results?: {
    utterances?: DeepgramUtterance[];
    channels?: Array<{
      alternatives?: Array<{
        transcript?: string;
      }>;
    }>;
  };
}

interface ChronicConditionRow {
  condition_code: string;
  notes_ar: string | null;
  chronic_condition_options: {
    name_ar: string;
    name_en: string;
  } | null;
}

interface MedicationRow {
  drug_name_ar: string;
  drug_name_en: string | null;
  dose: string | null;
  frequency_ar: string | null;
  for_condition_ar: string | null;
}

interface PatientProfileRow {
  id: string;
}

interface StructuredNotes {
  chief_complaint_ar: string;
  history_ar: string;
  assessment_ar: string;
  plan_ar: string;
  follow_up_required: boolean;
  medications_mentioned: string[];
  red_flags_noted: string[];
}

// ─── Main Transcription Function ────────────────────────────────────────────

export async function transcribeGpCall(callId: string): Promise<void> {
  const supabase = getServiceClient();

  // ── Step 1: Mark as processing ─────────────────────────────────────────

  await supabase
    .from('gp_video_calls')
    .update({ transcription_status: 'processing', updated_at: new Date().toISOString() })
    .eq('id', callId);

  try {
    // ── Load call record ───────────────────────────────────────────────

    const { data: call } = await supabase
      .from('gp_video_calls')
      .select('id, patient_id, doctor_id, doctor_account_id, recording_url, livekit_room_name')
      .eq('id', callId)
      .single() as { data: CallRow | null };

    if (!call) {
      throw new Error(`Call not found: ${callId}`);
    }

    if (!call.recording_url) {
      throw new Error(`No recording URL for call: ${callId}`);
    }

    // ── Step 2: Download recording from Supabase Storage ────────────────

    const recordingBuffer = await downloadRecording(supabase, call.recording_url);

    // ── Step 3: Deepgram Arabic transcription ───────────────────────────

    const deepgramResult = await transcribeWithDeepgram(recordingBuffer);

    // ── Step 4: Format with speaker labels ──────────────────────────────

    const formattedTranscription = formatTranscription(deepgramResult);

    // ── Step 5: Load patient chronic conditions + medications ────────────

    const patientContext = await loadPatientContext(supabase, call.patient_id);

    // ── Step 6: Claude extraction with patient context ──────────────────

    const structuredNotes = await extractWithClaude(formattedTranscription, patientContext);

    // ── Step 7: Store transcription + structured notes ──────────────────

    await supabase
      .from('gp_video_calls')
      .update({
        transcription_ar: formattedTranscription,
        structured_notes_ar: JSON.stringify(structuredNotes),
        transcription_status: 'complete',
        updated_at: new Date().toISOString(),
      })
      .eq('id', callId);

    // ── Step 8: Notify doctor ───────────────────────────────────────────

    const { data: doctor } = await supabase
      .from('doctor_accounts')
      .select('id, name_ar, expo_push_token')
      .eq('id', call.doctor_account_id)
      .single() as { data: DoctorAccountRow | null };

    if (doctor?.expo_push_token) {
      await sendPushNotification(
        doctor.expo_push_token,
        'تفريغ المكالمة جاهز',
        'تم تفريغ مكالمة الفيديو مع المريض — يمكنك مراجعة الملاحظات الآن',
        { type: 'gp_transcription_ready', callId }
      );
    }

    console.log(`[Transcription] Completed for call ${callId}`);
  } catch (err) {
    console.error(`[Transcription] Failed for call ${callId}:`, err);

    await supabase
      .from('gp_video_calls')
      .update({
        transcription_status: 'failed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', callId);

    throw err;
  }
}

// ─── Download Recording ─────────────────────────────────────────────────────

async function downloadRecording(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  recordingUrl: string
): Promise<Buffer> {
  // Try Supabase Storage download first
  const bucketPath = recordingUrl.replace(/^.*\/storage\/v1\/object\//, '');
  const parts = bucketPath.split('/');
  const bucket = parts[0] ?? 'gp-recordings';
  const filePath = parts.slice(1).join('/');

  if (filePath) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .download(filePath);

    if (!error && data) {
      const arrayBuffer = await data.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }
  }

  // Fallback: fetch from URL directly
  const response = await fetch(recordingUrl);
  if (!response.ok) {
    throw new Error(`Failed to download recording: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// ─── Deepgram Transcription ─────────────────────────────────────────────────

async function transcribeWithDeepgram(audioBuffer: Buffer): Promise<DeepgramResponse> {
  if (!DEEPGRAM_API_KEY) {
    console.log('[Transcription DEV_MODE] Would transcribe audio');
    return {
      results: {
        utterances: [
          { speaker: 0, transcript: 'السلام عليكم دكتور', start: 0, end: 2 },
          { speaker: 1, transcript: 'وعليكم السلام، كيف حالك؟', start: 2, end: 4 },
        ],
      },
    };
  }

  const response = await fetch('https://api.deepgram.com/v1/listen?model=nova-2&language=ar&diarize=true&utterances=true&punctuate=true', {
    method: 'POST',
    headers: {
      Authorization: `Token ${DEEPGRAM_API_KEY}`,
      'Content-Type': 'audio/mp4',
    },
    body: audioBuffer as unknown as BodyInit,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Deepgram API error ${response.status}: ${errorText}`);
  }

  return (await response.json()) as DeepgramResponse;
}

// ─── Format Transcription with Speaker Labels ──────────────────────────────

function formatTranscription(deepgramResult: DeepgramResponse): string {
  const utterances = deepgramResult.results?.utterances;

  if (!utterances || utterances.length === 0) {
    // Fallback to full transcript
    const fullTranscript = deepgramResult.results?.channels?.[0]?.alternatives?.[0]?.transcript;
    return fullTranscript ?? '';
  }

  // Assume speaker 0 = doctor, speaker 1 = patient (first speaker is typically the doctor)
  const lines: string[] = [];

  for (const utterance of utterances) {
    const speaker = utterance.speaker === 0 ? 'الطبيب' : 'المريض';
    const timestamp = formatTimestamp(utterance.start);
    lines.push(`[${timestamp}] ${speaker}: ${utterance.transcript}`);
  }

  return lines.join('\n');
}

function formatTimestamp(seconds: number): string {
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

// ─── Load Patient Context (Chronic Conditions + Medications) ────────────────

async function loadPatientContext(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  patientId: string
): Promise<string> {
  // Get patient profile ID
  const { data: profile } = await supabase
    .from('patient_profiles')
    .select('id')
    .eq('patient_id', patientId)
    .single() as { data: PatientProfileRow | null };

  if (!profile) {
    return 'لا يوجد ملف طبي للمريض.';
  }

  const sections: string[] = [];

  // ── Chronic conditions ─────────────────────────────────────────────────

  const { data: conditions } = await supabase
    .from('patient_chronic_conditions')
    .select(`
      condition_code,
      notes_ar,
      chronic_condition_options (
        name_ar,
        name_en
      )
    `)
    .eq('patient_profile_id', profile.id) as { data: ChronicConditionRow[] | null };

  if (conditions && conditions.length > 0) {
    const conditionLines = conditions.map((c) => {
      const name = c.chronic_condition_options?.name_ar ?? c.condition_code;
      const nameEn = c.chronic_condition_options?.name_en ?? '';
      const notes = c.notes_ar ? ` — ${c.notes_ar}` : '';
      return `  - ${name} (${nameEn})${notes}`;
    });
    sections.push(`الأمراض المزمنة:\n${conditionLines.join('\n')}`);
  } else {
    sections.push('الأمراض المزمنة: لا يوجد');
  }

  // ── Current medications ────────────────────────────────────────────────

  const { data: medications } = await supabase
    .from('patient_medications')
    .select('drug_name_ar, drug_name_en, dose, frequency_ar, for_condition_ar')
    .eq('patient_profile_id', profile.id)
    .order('sort_order', { ascending: true }) as { data: MedicationRow[] | null };

  if (medications && medications.length > 0) {
    const medLines = medications.map((m) => {
      const parts = [m.drug_name_ar];
      if (m.drug_name_en) parts[0] += ` (${m.drug_name_en})`;
      if (m.dose) parts.push(`الجرعة: ${m.dose}`);
      if (m.frequency_ar) parts.push(`${m.frequency_ar}`);
      if (m.for_condition_ar) parts.push(`لعلاج: ${m.for_condition_ar}`);
      return `  - ${parts.join('، ')}`;
    });
    sections.push(`الأدوية الحالية:\n${medLines.join('\n')}`);
  } else {
    sections.push('الأدوية الحالية: لا يوجد');
  }

  return sections.join('\n\n');
}

// ─── Claude Structured Note Extraction ──────────────────────────────────────

async function extractWithClaude(
  transcription: string,
  patientContext: string
): Promise<StructuredNotes> {
  if (!ANTHROPIC_API_KEY) {
    console.log('[Transcription DEV_MODE] Would extract structured notes via Claude');
    return {
      chief_complaint_ar: 'شكوى رئيسية (تجريبي)',
      history_ar: 'تاريخ مرضي (تجريبي)',
      assessment_ar: 'تقييم (تجريبي)',
      plan_ar: 'خطة علاجية (تجريبي)',
      follow_up_required: true,
      medications_mentioned: [],
      red_flags_noted: [],
    };
  }

  const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

  const systemPrompt = `أنت مساعد طبي ذكي. مهمتك تحليل تفريغ مكالمة فيديو بين طبيب عام ومريض واستخراج ملاحظات سريرية منظمة.

── سياق المريض الطبي ──
${patientContext}

── التعليمات ──
حلل المحادثة التالية واستخرج البيانات التالية بالعربية.
يجب أن يكون الرد بصيغة JSON فقط بدون أي نص إضافي.

الحقول المطلوبة:
1. chief_complaint_ar: الشكوى الرئيسية التي ذكرها المريض
2. history_ar: ملخص التاريخ المرضي المذكور في المحادثة (مع الإشارة للأمراض المزمنة المعروفة إن كانت ذات صلة)
3. assessment_ar: تقييم الطبيب أو التشخيص المبدئي
4. plan_ar: الخطة العلاجية أو التوصيات
5. follow_up_required: هل يحتاج متابعة (true/false)
6. medications_mentioned: قائمة الأدوية المذكورة في المحادثة (مع ملاحظة أي تعارض محتمل مع الأدوية الحالية)
7. red_flags_noted: أي أعراض خطيرة أو علامات تحذيرية ذكرت

إذا لم يذكر أي حقل في المحادثة، استخدم نص فارغ أو قائمة فارغة.
ضع في اعتبارك الأمراض المزمنة والأدوية الحالية للمريض عند تحليل المحادثة.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: `تفريغ المكالمة:\n\n${transcription}`,
      },
    ],
    system: systemPrompt,
  });

  // Extract text content
  const textBlock = response.content.find((b) => b.type === 'text');
  const rawText = textBlock?.type === 'text' ? textBlock.text : '{}';

  // Parse JSON from response (handle markdown code blocks)
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error('[Transcription] Claude did not return valid JSON:', rawText);
    return {
      chief_complaint_ar: '',
      history_ar: '',
      assessment_ar: '',
      plan_ar: '',
      follow_up_required: false,
      medications_mentioned: [],
      red_flags_noted: [],
    };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as StructuredNotes;
    return {
      chief_complaint_ar: parsed.chief_complaint_ar ?? '',
      history_ar: parsed.history_ar ?? '',
      assessment_ar: parsed.assessment_ar ?? '',
      plan_ar: parsed.plan_ar ?? '',
      follow_up_required: parsed.follow_up_required ?? false,
      medications_mentioned: parsed.medications_mentioned ?? [],
      red_flags_noted: parsed.red_flags_noted ?? [],
    };
  } catch {
    console.error('[Transcription] Failed to parse Claude response:', rawText);
    return {
      chief_complaint_ar: '',
      history_ar: '',
      assessment_ar: '',
      plan_ar: '',
      follow_up_required: false,
      medications_mentioned: [],
      red_flags_noted: [],
    };
  }
}
