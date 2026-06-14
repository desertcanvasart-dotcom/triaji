/**
 * Deepgram Real-Time STT Streaming
 * Creates a live transcription stream using Deepgram's Nova-2 model
 * optimized for Arabic speech over Twilio's mulaw audio format.
 *
 * Supports two modes:
 *   - Arabic-only (default): language='ar' — faster, lower latency
 *   - Multi-language: language='multi' — detects Arabic or English per utterance
 *
 * Uses native WebSocket connection to Deepgram's streaming API.
 *
 * DEV_MODE: When DEEPGRAM_API_KEY is not set, returns a mock
 * connection that logs audio chunks.
 */

import { WebSocket as WS } from 'ws';
import { EventEmitter } from 'events';

// ─── Types ──────────────────────────────────────────────────────────────────

type TranscriptCallback = (
  text: string,
  isFinal: boolean,
  detectedLanguage?: string,
  languageConfidence?: number
) => void;
type UtteranceEndCallback = () => void;
type ErrorCallback = (err: Error) => void;

type DeepgramEventMap = {
  transcript: TranscriptCallback;
  utterance_end: UtteranceEndCallback;
  error: ErrorCallback;
};

export interface DeepgramConnection {
  /** Send raw audio data (mulaw 8kHz) to Deepgram for transcription */
  send(audio: Buffer): void;
  /** Close the connection and release resources */
  close(): void;
  /** Listen for transcript events */
  on<K extends keyof DeepgramEventMap>(event: K, cb: DeepgramEventMap[K]): void;
}

export interface DeepgramStreamOptions {
  /**
   * Enable multi-language detection mode.
   * When true, uses language='multi' which detects Arabic or English per utterance.
   * When false (default), uses language='ar' for Arabic-only.
   */
  multiLanguage?: boolean;
}

// ─── Deepgram Stream Configuration ─────────────────────────────────────────

/** Base parameters shared between Arabic-only and multi-language modes */
const BASE_PARAMS: Record<string, string> = {
  model: 'nova-2',
  encoding: 'mulaw',
  sample_rate: '8000',
  channels: '1',
  punctuate: 'true',
  interim_results: 'true',
  endpointing: '500',
  utterance_end_ms: '1500',
};

function buildDeepgramParams(options?: DeepgramStreamOptions): URLSearchParams {
  const language = options?.multiLanguage ? 'multi' : 'ar';
  return new URLSearchParams({
    ...BASE_PARAMS,
    language,
  });
}

// ─── Deepgram Response Types ────────────────────────────────────────────────

interface DeepgramTranscriptResponse {
  type: 'Results';
  channel?: {
    alternatives?: Array<{
      transcript?: string;
      languages?: string[];
      confidence?: number;
    }>;
  };
  /** Detected language code from Deepgram multi-language mode */
  channel_index?: number[];
  is_final?: boolean;
  speech_final?: boolean;
}

interface DeepgramUtteranceEndResponse {
  type: 'UtteranceEnd';
}

interface DeepgramErrorResponse {
  type: 'Error';
  message?: string;
  description?: string;
}

type DeepgramMessage =
  | DeepgramTranscriptResponse
  | DeepgramUtteranceEndResponse
  | DeepgramErrorResponse
  | { type: string };

// ─── Mock Connection (DEV_MODE) ─────────────────────────────────────────────

function createMockDeepgramConnection(): DeepgramConnection {
  const emitter = new EventEmitter();
  let chunkCount = 0;
  let isClosed = false;

  return {
    send(audio: Buffer): void {
      if (isClosed) return;
      chunkCount++;
      if (chunkCount % 100 === 0) {
        console.log(`[Deepgram DEV_MODE] Received ${chunkCount} audio chunks (${audio.length} bytes latest)`);
      }
    },

    close(): void {
      if (isClosed) return;
      isClosed = true;
      console.log(`[Deepgram DEV_MODE] Connection closed after ${chunkCount} chunks`);
    },

    on<K extends keyof DeepgramEventMap>(event: K, cb: DeepgramEventMap[K]): void {
      emitter.on(event, cb);
    },
  };
}

// ─── Real Deepgram Connection ───────────────────────────────────────────────

function createRealDeepgramConnection(
  apiKey: string,
  options?: DeepgramStreamOptions
): DeepgramConnection {
  const emitter = new EventEmitter();
  let isClosed = false;

  const params = buildDeepgramParams(options);
  const isMultiLang = options?.multiLanguage === true;
  const url = `wss://api.deepgram.com/v1/listen?${params.toString()}`;
  const ws = new WS(url, {
    headers: {
      Authorization: `Token ${apiKey}`,
    },
  });

  ws.on('open', () => {
    console.log(`[Deepgram] WebSocket connection opened (language=${isMultiLang ? 'multi' : 'ar'})`);
  });

  ws.on('message', (data: Buffer) => {
    try {
      const msg = JSON.parse(data.toString()) as DeepgramMessage;

      if (msg.type === 'Results') {
        const result = msg as DeepgramTranscriptResponse;
        const alternative = result.channel?.alternatives?.[0];
        const transcript = alternative?.transcript ?? '';
        if (transcript.length === 0) return;

        const isFinal = result.is_final === true || result.speech_final === true;

        // Extract detected language from multi-language mode
        let detectedLanguage: string | undefined;
        let languageConfidence: number | undefined;

        if (isMultiLang && alternative?.languages && alternative.languages.length > 0) {
          detectedLanguage = alternative.languages[0];
          languageConfidence = alternative.confidence;
        }

        emitter.emit('transcript', transcript, isFinal, detectedLanguage, languageConfidence);
      } else if (msg.type === 'UtteranceEnd') {
        emitter.emit('utterance_end');
      } else if (msg.type === 'Error') {
        const errMsg = msg as DeepgramErrorResponse;
        console.error('[Deepgram] Stream error:', errMsg.message ?? errMsg.description);
        emitter.emit('error', new Error(errMsg.message ?? errMsg.description ?? 'Unknown Deepgram error'));
      }
    } catch {
      console.error('[Deepgram] Failed to parse message');
    }
  });

  ws.on('close', () => {
    console.log('[Deepgram] WebSocket connection closed');
    isClosed = true;
  });

  ws.on('error', (err: Error) => {
    console.error('[Deepgram] WebSocket error:', err.message);
    emitter.emit('error', err);
  });

  return {
    send(audio: Buffer): void {
      if (isClosed || ws.readyState !== WS.OPEN) return;
      ws.send(audio);
    },

    close(): void {
      if (isClosed) return;
      isClosed = true;
      if (ws.readyState === WS.OPEN) {
        ws.close();
      }
    },

    on<K extends keyof DeepgramEventMap>(event: K, cb: DeepgramEventMap[K]): void {
      emitter.on(event, cb);
    },
  };
}

// ─── Factory ────────────────────────────────────────────────────────────────

/**
 * Create a Deepgram live transcription stream.
 * Configured for Twilio mulaw 8kHz audio with Nova-2 model.
 *
 * @param options.multiLanguage When true, uses Deepgram's multi-language
 *   detection mode (for tenants with english_enabled=true). When false (default),
 *   uses Arabic-only mode for lower latency.
 *
 * In DEV_MODE (no DEEPGRAM_API_KEY), returns a mock that logs received chunks.
 */
export function createDeepgramStream(options?: DeepgramStreamOptions): DeepgramConnection {
  const apiKey = process.env['DEEPGRAM_API_KEY'];

  if (!apiKey) {
    console.log('[Deepgram DEV_MODE] Using mock connection — no DEEPGRAM_API_KEY set');
    return createMockDeepgramConnection();
  }

  return createRealDeepgramConnection(apiKey, options);
}
