/**
 * OpenAI Whisper-family STT.
 *
 * Three model options:
 *   - whisper-1                 ($0.006/min, original Whisper-large-v2)
 *   - gpt-4o-mini-transcribe    ($0.003/min, faster + cheaper, 2025)
 *   - gpt-4o-transcribe         ($0.006/min, highest quality, 2025)
 *
 * All three are batch-only — no streaming in the OpenAI API today.
 * (gpt-4o-realtime exists but uses a different paradigm; we'd add it
 *  as a separate streaming provider later.)
 *
 * For Arabic specifically: gpt-4o-transcribe is currently the strongest
 * general-purpose Arabic STT on the public market. Egyptian dialect
 * handling is solid because Whisper saw a lot of dialect on YouTube.
 */

import { createReadStream } from 'fs';
import OpenAI from 'openai';
import type { AudioInput, BatchResult, ProviderId, SttProvider } from './types.js';

const PRICE_PER_MIN_USD: Record<string, number> = {
  'whisper-1': 0.006,
  'gpt-4o-mini-transcribe': 0.003,
  'gpt-4o-transcribe': 0.006,
};

export class OpenAiWhisperProvider implements SttProvider {
  readonly id: ProviderId;
  readonly displayName: string;
  readonly supports = { batch: true, streaming: false };

  private client: OpenAI;

  constructor(
    apiKey: string,
    private readonly model: 'whisper-1' | 'gpt-4o-transcribe' | 'gpt-4o-mini-transcribe'
  ) {
    this.client = new OpenAI({ apiKey });
    this.id =
      model === 'whisper-1'
        ? 'openai-whisper-1'
        : model === 'gpt-4o-mini-transcribe'
        ? 'openai-gpt4o-mini'
        : 'openai-gpt4o';
    this.displayName = `OpenAI ${model}`;
  }

  async transcribeBatch(input: AudioInput): Promise<BatchResult> {
    const t0 = performance.now();
    const res = await this.client.audio.transcriptions.create({
      file: createReadStream(input.path),
      model: this.model,
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
      estimatedCostUsd: (input.durationSec / 60) * (PRICE_PER_MIN_USD[this.model] ?? 0.006),
      raw: res,
    };
  }
}
