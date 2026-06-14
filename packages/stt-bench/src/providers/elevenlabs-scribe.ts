/**
 * ElevenLabs Scribe — released early 2025, marketed as state-of-the-art
 * on dialects. Internal benchmarks (ElevenLabs's own) claim it beats
 * Whisper-large-v3 and Deepgram Nova-2 on Arabic dialects.
 *
 * Pricing: included in ElevenLabs subscription tiers. For estimation we
 * use a per-minute equivalent based on the Creator tier ($22/mo for ~46h
 * of audio = ~$0.008/min). Override via ELEVENLABS_SCRIBE_PRICE_PER_MIN.
 *
 * Batch endpoint: POST /v1/speech-to-text
 * Streaming: WSS available in 2025 — added if/when stable.
 */

import { readFile } from 'fs/promises';
import { basename } from 'path';
import type { AudioInput, BatchResult, SttProvider } from './types.js';

const PRICE_PER_MIN_USD = parseFloat(
  process.env.ELEVENLABS_SCRIBE_PRICE_PER_MIN ?? '0.008'
);

interface ScribeResponse {
  text?: string;
  language_code?: string;
  language_probability?: number;
  words?: Array<{ text: string; start: number; end: number }>;
}

export class ElevenLabsScribeProvider implements SttProvider {
  readonly id = 'elevenlabs-scribe' as const;
  readonly displayName = 'ElevenLabs Scribe v1';
  readonly supports = { batch: true, streaming: false };

  constructor(private readonly apiKey: string) {}

  async transcribeBatch(input: AudioInput): Promise<BatchResult> {
    const buf = input.buffer ?? (await readFile(input.path));
    const form = new FormData();
    const blob = new Blob([buf], { type: input.mimeType });
    form.append('file', blob, basename(input.path));
    form.append('model_id', 'scribe_v1');
    form.append('language_code', 'ara');
    // tag_audio_events=false to keep transcript clean for WER
    form.append('tag_audio_events', 'false');

    const t0 = performance.now();
    const res = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: { 'xi-api-key': this.apiKey },
      body: form,
    });
    const latencyMs = performance.now() - t0;

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`ElevenLabs Scribe ${res.status}: ${body.slice(0, 200)}`);
    }

    const json = (await res.json()) as ScribeResponse;
    return {
      text: (json.text ?? '').trim(),
      latencyMs,
      audioDurationSec: input.durationSec,
      estimatedCostUsd: (input.durationSec / 60) * PRICE_PER_MIN_USD,
      confidence: json.language_probability,
      detectedLanguage: json.language_code,
      raw: json,
    };
  }
}
