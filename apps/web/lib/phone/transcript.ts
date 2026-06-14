/**
 * Transcript Formatting and Storage
 * Builds a timestamped transcript of the phone conversation
 * between the AI assistant (نور) and the patient (المريض).
 * Persists the full transcript and recording URL to the triage session.
 */

import { updateSession } from '@/lib/triage/session-manager';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TranscriptEntry {
  /** Timestamp in HH:MM:SS format */
  timestamp: string;
  /** Speaker label in Arabic */
  speaker: 'نور' | 'المريض';
  /** What was said */
  text: string;
}

type SpeakerRole = 'ai' | 'patient';

// ─── Speaker Name Map ───────────────────────────────────────────────────────

const SPEAKER_NAMES: Record<SpeakerRole, TranscriptEntry['speaker']> = {
  ai: 'نور',
  patient: 'المريض',
};

// ─── Transcript Builder ─────────────────────────────────────────────────────

export class TranscriptBuilder {
  private entries: TranscriptEntry[] = [];

  /**
   * Add a new entry to the transcript.
   * Automatically timestamps with the current time (HH:MM:SS).
   *
   * @param speaker 'ai' for the AI assistant, 'patient' for the caller
   * @param text The spoken text
   */
  addEntry(speaker: SpeakerRole, text: string): void {
    const trimmed = text.trim();
    if (trimmed.length === 0) return;

    this.entries.push({
      timestamp: formatTimestamp(new Date()),
      speaker: SPEAKER_NAMES[speaker],
      text: trimmed,
    });
  }

  /**
   * Format the full transcript as a readable string.
   *
   * Output format:
   * ```
   * [09:14:32] نور: أهلاً بك في ترياچي...
   * [09:14:45] المريض: عندي ألم في صدري
   * ```
   */
  format(): string {
    return this.entries
      .map((entry) => `[${entry.timestamp}] ${entry.speaker}: ${entry.text}`)
      .join('\n');
  }

  /**
   * Get all transcript entries.
   */
  getEntries(): TranscriptEntry[] {
    return [...this.entries];
  }

  /**
   * Get the number of entries in the transcript.
   */
  get length(): number {
    return this.entries.length;
  }
}

// ─── Storage Functions ──────────────────────────────────────────────────────

/**
 * Save the full transcript text to the triage session.
 */
export async function saveTranscript(
  sessionId: string,
  transcript: string
): Promise<void> {
  await updateSession(sessionId, {
    transcript_full: transcript,
  });
}

/**
 * Save the Twilio recording URL to the triage session.
 */
export async function saveRecordingUrl(
  sessionId: string,
  recordingUrl: string
): Promise<void> {
  await updateSession(sessionId, {
    recording_url: recordingUrl,
  });
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Format a Date to HH:MM:SS string.
 */
function formatTimestamp(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}
