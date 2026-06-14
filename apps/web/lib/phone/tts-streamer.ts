/**
 * ElevenLabs Streaming TTS
 * Converts text to speech using ElevenLabs' multilingual model.
 * Outputs mulaw 8kHz audio chunks compatible with Twilio's media streams.
 *
 * Supports bilingual operation:
 *   - Arabic voice (default): uses ELEVENLABS_VOICE_ID
 *   - English voice: uses ELEVENLABS_VOICE_ID_EN
 *   - Voice switching via setLanguage() during a call session
 *
 * DEV_MODE: When ELEVENLABS_API_KEY is not set, yields empty buffers
 * with console logging.
 */

import type { PhoneLanguage } from './language-detector';

// ─── Configuration ──────────────────────────────────────────────────────────

const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1/text-to-speech';

/** ElevenLabs model optimized for multilingual speech including Arabic */
const MODEL_ID = 'eleven_multilingual_v2';

/** Twilio-compatible output format: 8kHz mulaw (G.711) */
const OUTPUT_FORMAT = 'ulaw_8000';

/** Voice settings tuned for clear, warm medical assistance */
const VOICE_SETTINGS = {
  stability: 0.75,
  similarity_boost: 0.85,
  style: 0.20,
  use_speaker_boost: true,
};

/**
 * Chunk size for streaming (bytes).
 * Twilio expects media payloads in manageable chunks.
 */
const STREAM_CHUNK_SIZE = 640;

// ─── Types ──────────────────────────────────────────────────────────────────

interface ElevenLabsRequestBody {
  text: string;
  model_id: string;
  voice_settings: typeof VOICE_SETTINGS;
}

// ─── TTS Streamer ───────────────────────────────────────────────────────────

export class TTSStreamer {
  private voiceId: string;
  private voiceIdAr: string;
  private voiceIdEn: string;
  private currentLang: PhoneLanguage = 'ar';

  constructor(voiceId?: string) {
    // Arabic voice (default)
    this.voiceIdAr = voiceId ?? process.env['ELEVENLABS_VOICE_ID'] ?? 'pNInz6obpgDQGcFmaJgB';
    // English voice
    this.voiceIdEn = process.env['ELEVENLABS_VOICE_ID_EN'] ?? this.voiceIdAr;
    // Start with Arabic
    this.voiceId = this.voiceIdAr;
  }

  /**
   * Switch the TTS voice to match the detected language.
   * Arabic uses the Arabic voice ID, English uses the English voice ID.
   */
  setLanguage(lang: PhoneLanguage): void {
    this.currentLang = lang;
    this.voiceId = lang === 'en' ? this.voiceIdEn : this.voiceIdAr;
    console.log(`[TTS] Voice switched to ${lang} (voiceId=${this.voiceId.slice(0, 8)}...)`);
  }

  /**
   * Get the current language setting.
   */
  get language(): PhoneLanguage {
    return this.currentLang;
  }

  /**
   * Stream TTS audio as mulaw 8kHz chunks suitable for Twilio.
   * Yields Buffer chunks as they arrive from ElevenLabs.
   *
   * In DEV_MODE (no ELEVENLABS_API_KEY), yields a single empty buffer
   * and logs the text that would have been spoken.
   */
  async *streamAudio(text: string): AsyncGenerator<Buffer> {
    const apiKey = process.env['ELEVENLABS_API_KEY'];

    if (!apiKey) {
      console.log(`[TTS DEV_MODE] Would speak (${this.currentLang}): "${text.slice(0, 100)}${text.length > 100 ? '...' : ''}"`);
      yield Buffer.alloc(0);
      return;
    }

    const url = `${ELEVENLABS_API_URL}/${this.voiceId}/stream?output_format=${OUTPUT_FORMAT}`;

    const body: ElevenLabsRequestBody = {
      text,
      model_id: MODEL_ID,
      voice_settings: VOICE_SETTINGS,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/basic', // mulaw format
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[TTS] ElevenLabs API error (${response.status}):`, errorText);
      throw new Error(`ElevenLabs TTS failed: ${response.status} ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('[TTS] ElevenLabs returned no body');
    }

    // Stream the response body as chunks
    const reader = response.body.getReader();
    let buffer = Buffer.alloc(0);

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Append received data to buffer
        buffer = Buffer.concat([buffer, Buffer.from(value)]);

        // Yield complete chunks of the target size
        while (buffer.length >= STREAM_CHUNK_SIZE) {
          yield buffer.subarray(0, STREAM_CHUNK_SIZE);
          buffer = buffer.subarray(STREAM_CHUNK_SIZE);
        }
      }

      // Yield any remaining data
      if (buffer.length > 0) {
        yield buffer;
      }
    } finally {
      reader.releaseLock();
    }
  }
}
