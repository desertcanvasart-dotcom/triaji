/**
 * TTS Audio Playback Queue
 * Manages sequential playback of TTS audio chunks with barge-in support.
 *
 * When the patient starts speaking during AI playback, interrupt()
 * is called to immediately stop current audio and clear the queue,
 * allowing the AI to listen to the patient's new input.
 */

import { TTSStreamer } from './tts-streamer';
import type { PhoneLanguage } from './language-detector';

// ─── Types ──────────────────────────────────────────────────────────────────

type AudioChunkCallback = (audio: Buffer) => void;

// ─── TTS Queue ──────────────────────────────────────────────────────────────

export class TTSQueue {
  private playing: boolean = false;
  private queue: string[] = [];
  private aborted: boolean = false;
  private ttsStreamer: TTSStreamer;

  constructor(voiceId?: string) {
    this.ttsStreamer = new TTSStreamer(voiceId);
  }

  /**
   * Switch the TTS voice to match the detected language.
   */
  setLanguage(lang: PhoneLanguage): void {
    this.ttsStreamer.setLanguage(lang);
  }

  /**
   * Add text to the playback queue.
   * Text will be converted to speech and played in order.
   */
  enqueue(text: string): void {
    const trimmed = text.trim();
    if (trimmed.length === 0) return;
    this.queue.push(trimmed);
  }

  /**
   * Play the next item in the queue.
   * Streams TTS audio and calls onChunk for each audio buffer.
   * Automatically advances to the next queued item until empty.
   *
   * @param onChunk Called with each audio buffer to send to Twilio
   */
  async playNext(onChunk: AudioChunkCallback): Promise<void> {
    if (this.playing) return;

    const text = this.queue.shift();
    if (!text) return;

    this.playing = true;
    this.aborted = false;

    try {
      for await (const chunk of this.ttsStreamer.streamAudio(text)) {
        // Check for barge-in between each chunk
        if (this.aborted) {
          break;
        }
        onChunk(chunk);
      }
    } catch (err) {
      console.error('[TTSQueue] Playback error:', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      this.playing = false;
    }

    // If not interrupted and there are more items, play next
    if (!this.aborted && this.queue.length > 0) {
      await this.playNext(onChunk);
    }
  }

  /**
   * Interrupt current playback and clear the queue (barge-in).
   * Called when the patient starts speaking during AI playback.
   */
  interrupt(): void {
    this.aborted = true;
    this.queue = [];
    // playing will be set to false in the finally block of playNext
  }

  /**
   * Whether audio is currently being played.
   */
  get isPlaying(): boolean {
    return this.playing;
  }

  /**
   * Number of items waiting in the queue (not including current playback).
   */
  get queueLength(): number {
    return this.queue.length;
  }
}
