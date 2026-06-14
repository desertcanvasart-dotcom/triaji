/**
 * STT Provider abstraction.
 *
 * Two modes:
 *   - batch:     give it a full audio buffer, get back text + timing.
 *   - streaming: feed audio in chunks, get partial + final transcripts.
 *
 * Not every provider supports both. Providers declare their capabilities
 * via the `supports` field. The runner skips providers that don't
 * support the requested mode.
 */

export type ProviderId =
  | 'deepgram-nova2'
  | 'deepgram-nova3'
  | 'elevenlabs-scribe'
  | 'openai-gpt4o'
  | 'openai-gpt4o-mini'
  | 'openai-whisper-1'
  | 'groq-whisper-large-v3';

export interface BatchResult {
  /** Final transcript text */
  text: string;
  /** Total wall-clock latency in ms (request sent → text returned) */
  latencyMs: number;
  /** Audio duration in seconds (for cost estimation) */
  audioDurationSec: number;
  /** Estimated cost in USD for this transcription */
  estimatedCostUsd: number;
  /** Optional confidence score (0..1) if provider reports one */
  confidence?: number;
  /** Optional detected language code */
  detectedLanguage?: string;
  /** Raw provider response, useful for debugging */
  raw?: unknown;
}

export interface StreamingPartial {
  text: string;
  isFinal: boolean;
  /** ms since stream start */
  tSinceStartMs: number;
}

export interface StreamingResult {
  /** Concatenation of all final transcripts */
  finalText: string;
  /** All partials received (for replay / latency analysis) */
  partials: StreamingPartial[];
  /** Time from audio start → first partial (any text) */
  firstPartialMs: number | null;
  /** Time from audio start → first final transcript */
  firstFinalMs: number | null;
  /** Time from audio end-of-input → last final transcript */
  endOfInputToFinalMs: number | null;
  /** Audio duration in seconds */
  audioDurationSec: number;
  /** Total stream wall-clock duration in ms */
  totalMs: number;
  estimatedCostUsd: number;
  raw?: unknown;
}

export interface ProviderCapabilities {
  batch: boolean;
  streaming: boolean;
  /** Native input encoding for streaming (e.g., 'mulaw_8000', 'pcm_16000') */
  streamingEncoding?: 'mulaw_8000' | 'pcm_16000' | 'pcm_8000';
}

export interface AudioInput {
  /** Path to the audio file on disk */
  path: string;
  /** Cached buffer (lazy-loaded) */
  buffer?: Buffer;
  /** MIME type (e.g., 'audio/wav', 'audio/mpeg', 'audio/mp4') */
  mimeType: string;
  /** Duration in seconds (best-effort, may be approximate) */
  durationSec: number;
}

export interface SttProvider {
  readonly id: ProviderId;
  readonly displayName: string;
  readonly supports: ProviderCapabilities;

  /** Transcribe a complete audio buffer. */
  transcribeBatch?(input: AudioInput): Promise<BatchResult>;

  /**
   * Transcribe a streaming audio source.
   * The runner replays the audio file in real-time chunks (20ms frames)
   * to simulate Twilio Media Stream behavior.
   */
  transcribeStreaming?(input: AudioInput): Promise<StreamingResult>;
}

export interface ProviderInitError {
  providerId: ProviderId;
  reason: string;
}
