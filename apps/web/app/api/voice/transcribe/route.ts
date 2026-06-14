import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_TYPES = new Set([
  'audio/webm',
  'audio/mp4',
  'audio/wav',
  'audio/m4a',
  'audio/mpeg',
  'audio/ogg',
  'audio/webm;codecs=opus',
]);

const MAX_SIZE = 25 * 1024 * 1024; // 25MB

// Subtitle/caption markers that indicate the transcription picked up media audio
// rather than the patient's actual speech
const SUBTITLE_MARKERS = [
  'ترجمة',       // "translation"
  'توقيت',       // "timing"
  'تنسيق',       // "formatting"
  'subtitle',
  'translated by',
  'timing by',
  'www.',
  'http',
  '.com',
  '.net',
  'subscri',     // "subscribe"
];

function looksLikeSubtitle(text: string): boolean {
  const lower = text.toLowerCase();
  return SUBTITLE_MARKERS.some((marker) => lower.includes(marker));
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio');

    if (!audioFile || typeof audioFile === 'string') {
      return NextResponse.json(
        { error: 'audio file is required' },
        { status: 400 }
      );
    }

    // Validate file type
    const fileType = audioFile.type.split(';')[0] ?? audioFile.type;
    if (!ALLOWED_TYPES.has(audioFile.type) && !ALLOWED_TYPES.has(fileType)) {
      return NextResponse.json(
        { error: 'نوع الملف غير مدعوم. يرجى إرسال ملف صوتي.' },
        { status: 400 }
      );
    }

    // Validate file size
    if (audioFile.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'الملف أكبر من 25 ميجابايت' },
        { status: 400 }
      );
    }

    // Validate minimum size (likely too short)
    if (audioFile.size < 1000) {
      return NextResponse.json(
        { error: 'التسجيل قصير جداً، حاول مرة أخرى' },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;

    // DEV_MODE — return error so user knows transcription is not configured
    if (!apiKey) {
      console.warn('[Voice] OPENAI_API_KEY not set — voice transcription unavailable');
      return NextResponse.json(
        { error: 'خاصية الصوت مش متفعّلة دلوقتي. اكتب أعراضك في الشات.' },
        { status: 503 }
      );
    }

    // Build FormData for Whisper API
    const whisperForm = new FormData();
    whisperForm.append('file', audioFile, audioFile.name || 'recording.webm');
    whisperForm.append('model', 'whisper-1');
    whisperForm.append('language', 'ar');
    whisperForm.append(
      'prompt',
      'المريض بيوصف أعراضه بالعامية المصرية. ' +
        'أجزاء الجسم: راس، رقبة، كتف، ضهر، صدر، بطن، دراع، إيد، رجل، ركبة، عين، ودن، أنف، زور، سنان. ' +
        'أعراض شائعة: وجع، ألم، سخونية، صداع، كحة، ترجيع، إسهال، دوخة، حرقان، تنميل، ورم، حساسية، ضيق نفس، رعشة.'
    );

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: whisperForm,
    });

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
      console.error('[Voice] Whisper API error:', response.status, errorData);
      return NextResponse.json(
        { error: 'لم نتمكن من تفريغ الصوت، حاول مرة أخرى أو اكتب رسالتك' },
        { status: 500 }
      );
    }

    const result = (await response.json()) as { text: string; language?: string };

    // Filter out subtitle/caption text that leaked from other audio sources
    if (!result.text || result.text.trim().length < 2 || looksLikeSubtitle(result.text)) {
      console.warn('[Voice] Filtered likely non-speech transcription:', result.text);
      return NextResponse.json(
        { error: 'مسمعناش كلام واضح — حاول تاني أو اكتب رسالتك' },
        { status: 422 }
      );
    }

    return NextResponse.json({
      text: result.text,
      language: result.language ?? 'ar',
    });
  } catch (err) {
    console.error('[Voice] Transcription error:', err);
    return NextResponse.json(
      { error: 'لم نتمكن من تفريغ الصوت، حاول مرة أخرى أو اكتب رسالتك' },
      { status: 500 }
    );
  }
}
