/**
 * Groq Whisper-Large-v3 — same Whisper model, Groq LPU inference.
 *
 * Why this matters:
 *   - Quality ≈ OpenAI whisper-1 (same weights, hosted differently)
 *   - Latency: typically 5-10× faster than OpenAI batch ($0.00185 audio-min)
 *   - Cost: ~30× cheaper than OpenAI
 *
 * For Triaji this is potentially huge: if WER is acceptable, you get
 * sub-second batch transcription for $0.11/hour of audio. That makes
 * it viable for telehealth recordings and for the post-call transcription
 * pipeline already in `apps/web/lib/telehealth/transcribe.ts`.
 *
 * Batch-only. Streaming isn't yet GA on Groq (as of mid-2025).
 */

import { createReadStream } from 'fs';
import OpenAI from 'openai';
import type { AudioInput, BatchResult, SttProvider } from './types.js';

const PRICE_PER_HOUR_USD = parseFloat(process.env.GROQ_PRICE_PER_HOUR ?? '0.111');

export class GroqWhisperProvider implements SttProvider {
  readonly id = 'groq-whisper-large-v3' as const;
  readonly displayName = 'Groq whisper-large-v3';
  readonly supports = { batch: true, streaming: false };

  private client: OpenAI;

  constructor(apiKey: string) {
    // Groq is OpenAI-API-compatible
    this.client = new OpenAI({
      apiKey,
      baseURL: 'https://api.groq.com/openai/v1',
    });
  }

  async transcribeBatch(input: AudioInput): Promise<BatchResult> {
    const t0 = performance.now();
    const res = await this.client.audio.transcriptions.create({
      file: createReadStream(input.path),
      model: 'whisper-large-v3',
      language: 'ar',
      response_format: 'json',
    });
    const latencyMs = performance.now() - t0;

    const text =
      typeof (res as { text?: string }).text === 'string'
        ? (res as { text: string }).text
        : '';

    return {
      text: text.trim(),
      latencyMs,
      audioDurationSec: input.durationSec,
      estimatedCostUsd: (input.durationSec / 3600) * PRICE_PER_HOUR_USD,
      raw: res,
    };
  }
}
