/**
 * Deepgram Nova-2 (Arabic) — Triaji's current production STT.
 *
 * Used as the baseline. We want to know exactly how much worse (or better)
 * it is than the alternatives on Egyptian-dialect medical speech.
 *
 * Pricing reference (as of 2025): $0.0043 / min for streaming, $0.0043 / min
 * for batch (pre-recorded). Updated via env override if you have an enterprise
 * deal.
 *
 * Batch:    POST /v1/listen with audio body
 * Streaming: WSS /v1/listen with mulaw/8000 frames
 */

import { readFile } from 'fs/promises';
import type {
  AudioInput,
  BatchResult,
  ProviderId,
  SttProvider,
  StreamingResult,
  StreamingPartial,
} from './types.js';
import { readWav, pcm16ToMulaw } from '../audio.js';
import { WebSocket } from 'ws';

const PRICE_PER_MIN_USD = parseFloat(process.env.DEEPGRAM_PRICE_PER_MIN ?? '0.0043');

interface DeepgramBatchResponse {
  results?: {
    channels?: Array<{
      alternatives?: Array<{
        transcript?: string;
        confidence?: number;
      }>;
      detected_language?: string;
    }>;
  };
}

export class DeepgramNova2Provider implements SttProvider {
  readonly id: ProviderId;
  readonly displayName: string;
  readonly supports = {
    batch: true,
    streaming: true,
    streamingEncoding: 'mulaw_8000' as const,
  };

  constructor(
    private readonly apiKey: string,
    private readonly model: 'nova-2' | 'nova-3' = 'nova-2'
  ) {
    this.id = model === 'nova-3' ? 'deepgram-nova3' : 'deepgram-nova2';
    this.displayName = model === 'nova-3' ? 'Deepgram Nova-3 (ar)' : 'Deepgram Nova-2 (ar)';
  }

  async transcribeBatch(input: AudioInput): Promise<BatchResult> {
    const buf = input.buffer ?? (await readFile(input.path));
    const url = new URL('https://api.deepgram.com/v1/listen');
    url.searchParams.set('model', this.model);
    url.searchParams.set('language', 'ar');
    url.searchParams.set('punctuate', 'true');
    url.searchParams.set('smart_format', 'true');

    const t0 = performance.now();
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Token ${this.apiKey}`,
        'Content-Type': input.mimeType,
      },
      body: buf,
    });
    const latencyMs = performance.now() - t0;

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Deepgram ${res.status}: ${body.slice(0, 200)}`);
    }

    const json = (await res.json()) as DeepgramBatchResponse;
    const alt = json.results?.channels?.[0]?.alternatives?.[0];
    return {
      text: alt?.transcript?.trim() ?? '',
      latencyMs,
      audioDurationSec: input.durationSec,
      estimatedCostUsd: (input.durationSec / 60) * PRICE_PER_MIN_USD,
      confidence: alt?.confidence,
      detectedLanguage: json.results?.channels?.[0]?.detected_language,
      raw: json,
    };
  }

  async transcribeStreaming(input: AudioInput): Promise<StreamingResult> {
    // Convert WAV (any rate) → PCM16 8kHz mono → μ-law (Twilio format)
    const wav = await readWav(input.path);
    const mulaw = downsampleAndMulaw(wav);

    const url = new URL('wss://api.deepgram.com/v1/listen');
    url.searchParams.set('model', this.model);
    url.searchParams.set('language', 'ar');
    url.searchParams.set('encoding', 'mulaw');
    url.searchParams.set('sample_rate', '8000');
    url.searchParams.set('channels', '1');
    url.searchParams.set('punctuate', 'true');
    url.searchParams.set('interim_results', 'true');
    url.searchParams.set('endpointing', '500');
    url.searchParams.set('utterance_end_ms', '1500');

    return streamMulawToWebsocket({
      url: url.toString(),
      headers: { Authorization: `Token ${this.apiKey}` },
      mulaw,
      audioDurationSec: input.durationSec,
      parseMessage: (msg) => {
        const m = msg as {
          type?: string;
          channel?: { alternatives?: Array<{ transcript?: string }> };
          is_final?: boolean;
          speech_final?: boolean;
        };
        if (m.type !== 'Results') return null;
        const text = m.channel?.alternatives?.[0]?.transcript ?? '';
        if (!text) return null;
        return { text, isFinal: m.is_final === true || m.speech_final === true };
      },
      estimatedCostUsd: (input.durationSec / 60) * PRICE_PER_MIN_USD,
    });
  }
}

/** Downsample 16-bit PCM to 8kHz mono, then μ-law encode. */
function downsampleAndMulaw(wav: { sampleRate: number; channels: number; bitsPerSample: number; pcm: Buffer }): Buffer {
  if (wav.bitsPerSample !== 16) {
    throw new Error(`Only 16-bit PCM WAV is supported, got ${wav.bitsPerSample}-bit`);
  }
  // First, convert to mono
  const samplesIn = wav.pcm.length / 2 / wav.channels;
  const mono = Buffer.alloc(samplesIn * 2);
  for (let i = 0; i < samplesIn; i++) {
    let sum = 0;
    for (let c = 0; c < wav.channels; c++) {
      sum += wav.pcm.readInt16LE((i * wav.channels + c) * 2);
    }
    mono.writeInt16LE(Math.round(sum / wav.channels), i * 2);
  }

  // Then downsample to 8kHz (simple decimation; fine for benchmark fidelity)
  const ratio = wav.sampleRate / 8000;
  if (ratio < 1) {
    throw new Error(`Sample rate ${wav.sampleRate} < 8000, cannot downsample`);
  }
  const outSamples = Math.floor(samplesIn / ratio);
  const out = Buffer.alloc(outSamples * 2);
  for (let i = 0; i < outSamples; i++) {
    out.writeInt16LE(mono.readInt16LE(Math.floor(i * ratio) * 2), i * 2);
  }
  return pcm16ToMulaw(out);
}

/** Shared helper for WebSocket streaming providers (mulaw 8kHz, 20ms frames). */
export async function streamMulawToWebsocket(args: {
  url: string;
  headers: Record<string, string>;
  mulaw: Buffer;
  audioDurationSec: number;
  estimatedCostUsd: number;
  parseMessage: (msg: unknown) => { text: string; isFinal: boolean } | null;
  closeMessage?: string;
}): Promise<StreamingResult> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(args.url, { headers: args.headers });
    const partials: StreamingPartial[] = [];
    let firstPartialMs: number | null = null;
    let firstFinalMs: number | null = null;
    let endOfInputAt: number | null = null;
    let lastFinalMs: number | null = null;
    const startTime = performance.now();
    let timer: NodeJS.Timeout | null = null;

    const cleanup = () => {
      if (timer) clearInterval(timer);
      if (ws.readyState === WebSocket.OPEN) ws.close();
    };

    ws.on('open', () => {
      // Send 20ms frames @ 8kHz mulaw = 160 bytes each
      const FRAME_BYTES = 160;
      const FRAME_MS = 20;
      let cursor = 0;
      timer = setInterval(() => {
        if (cursor >= args.mulaw.length) {
          if (timer) clearInterval(timer);
          endOfInputAt = performance.now() - startTime;
          // Send close message if provider needs one (Deepgram = CloseStream)
          if (args.closeMessage && ws.readyState === WebSocket.OPEN) {
            ws.send(args.closeMessage);
          }
          return;
        }
        const slice = args.mulaw.subarray(cursor, cursor + FRAME_BYTES);
        if (ws.readyState === WebSocket.OPEN) ws.send(slice);
        cursor += FRAME_BYTES;
      }, FRAME_MS);
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        const parsed = args.parseMessage(msg);
        if (!parsed) return;
        const t = performance.now() - startTime;
        partials.push({ text: parsed.text, isFinal: parsed.isFinal, tSinceStartMs: t });
        if (firstPartialMs === null) firstPartialMs = t;
        if (parsed.isFinal) {
          if (firstFinalMs === null) firstFinalMs = t;
          lastFinalMs = t;
        }
      } catch {
        /* ignore non-JSON */
      }
    });

    ws.on('error', (err) => {
      cleanup();
      reject(err);
    });

    ws.on('close', () => {
      cleanup();
      const finalText = partials
        .filter((p) => p.isFinal)
        .map((p) => p.text)
        .join(' ')
        .trim();
      resolve({
        finalText,
        partials,
        firstPartialMs,
        firstFinalMs,
        endOfInputToFinalMs:
          endOfInputAt !== null && lastFinalMs !== null ? lastFinalMs - endOfInputAt : null,
        audioDurationSec: args.audioDurationSec,
        totalMs: performance.now() - startTime,
        estimatedCostUsd: args.estimatedCostUsd,
      });
    });

    // Safety timeout: 3× audio duration + 30s
    setTimeout(() => {
      if (ws.readyState !== WebSocket.CLOSED) {
        cleanup();
      }
    }, args.audioDurationSec * 3000 + 30000);
  });
}
