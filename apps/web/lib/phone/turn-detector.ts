/**
 * End-of-Turn Detection
 * Combines multiple signals to determine when the patient has finished
 * speaking and the AI should respond:
 *
 * 1. Deepgram's "is_final" transcript flag
 * 2. Deepgram's "utterance_end" event
 * 3. Semantic completeness check (Arabic sentence analysis)
 * 4. Silence duration tracking
 *
 * This prevents the AI from interrupting mid-sentence while still
 * responding promptly when the patient pauses.
 */

// ─── Configuration ──────────────────────────────────────────────────────────

/** Minimum silence (ms) after last speech before considering turn complete */
const MIN_SILENCE_MS = 800;

/** Maximum wait (ms) after last speech regardless of completeness */
const MAX_SILENCE_MS = 2000;

/** Minimum transcript length (chars) before considering turn complete */
const MIN_TRANSCRIPT_LENGTH = 3;

// ─── Incomplete Sentence Markers ────────────────────────────────────────────

/**
 * Arabic words/particles that typically indicate the speaker is mid-sentence.
 * If the transcript ends with one of these, the turn is likely incomplete.
 */
const INCOMPLETE_ENDINGS: readonly string[] = [
  'في',       // in
  'من',       // from
  'عن',       // about
  'على',      // on
  'و',        // and
  'اللي',     // which/that (Egyptian dialect)
  'إن',       // that (conjunction)
  'لو',       // if
  'عشان',     // because (Egyptian dialect)
  'يعني',     // meaning/like
  'بس',       // but (Egyptian dialect)
  'أو',       // or
  'لأن',      // because
  'كان',      // was
  'هو',       // he/it
  'هي',       // she/it
  'أنا',      // I (often followed by verb)
  'مع',       // with
  'بعد',      // after
  'قبل',      // before
  'لما',      // when (Egyptian dialect)
  'كل',       // every/all
  'زي',       // like (Egyptian dialect)
  'فيه',      // there is (when used as connector)
];

// ─── Semantic Completeness Check ────────────────────────────────────────────

/**
 * Check if Arabic text appears semantically complete.
 * Returns false if the text ends with a word that typically
 * indicates the speaker is mid-sentence.
 */
function isSemanticallComplete(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length === 0) return false;

  // Check for sentence-ending punctuation
  const lastChar = trimmed[trimmed.length - 1];
  if (lastChar === '.' || lastChar === '؟' || lastChar === '!' || lastChar === '،') {
    return true;
  }

  // Get the last word
  const words = trimmed.split(/\s+/);
  const lastWord = words[words.length - 1];
  if (!lastWord) return false;

  // Check if last word is an incomplete ending marker
  return !INCOMPLETE_ENDINGS.includes(lastWord);
}

// ─── Turn Detector ──────────────────────────────────────────────────────────

export class TurnDetector {
  private lastSpeechTime: number = 0;
  private accumulatedTranscript: string = '';
  private hasFinalTranscript: boolean = false;
  private utteranceEnded: boolean = false;

  /**
   * Called on each transcript chunk from Deepgram.
   * Accumulates final transcripts and tracks timing.
   */
  onTranscript(text: string, isFinal: boolean): void {
    this.lastSpeechTime = Date.now();

    if (isFinal) {
      // Append final transcripts (Deepgram's finalized text)
      const separator = this.accumulatedTranscript.length > 0 ? ' ' : '';
      this.accumulatedTranscript += separator + text.trim();
      this.hasFinalTranscript = true;
    }
    // Interim results are ignored for accumulation but update timing
  }

  /**
   * Called when Deepgram signals the end of an utterance.
   * This is a strong signal that the speaker has paused.
   */
  onUtteranceEnd(): void {
    this.utteranceEnded = true;
  }

  /**
   * Determine if the patient's turn is complete and the AI should respond.
   *
   * The turn is complete when ALL of:
   * 1. We have accumulated transcript text
   * 2. At least one of:
   *    a. Utterance ended + semantically complete
   *    b. Utterance ended + minimum silence passed
   *    c. Maximum silence passed (regardless of completeness)
   */
  isComplete(): boolean {
    // No transcript yet — not complete
    if (this.accumulatedTranscript.trim().length < MIN_TRANSCRIPT_LENGTH) {
      return false;
    }

    // Must have at least one final transcript
    if (!this.hasFinalTranscript) {
      return false;
    }

    const now = Date.now();
    const silenceMs = now - this.lastSpeechTime;

    // Maximum silence reached — always complete
    if (silenceMs >= MAX_SILENCE_MS) {
      return true;
    }

    // Utterance ended by Deepgram
    if (this.utteranceEnded) {
      // If semantically complete, respond immediately
      if (isSemanticallComplete(this.accumulatedTranscript)) {
        return true;
      }

      // If not semantically complete, wait for minimum silence
      if (silenceMs >= MIN_SILENCE_MS) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get the accumulated transcript and reset it.
   * Call this when isComplete() returns true to consume the text.
   */
  consumeTranscript(): string {
    const transcript = this.accumulatedTranscript.trim();
    this.reset();
    return transcript;
  }

  /**
   * Reset all state for the next turn.
   */
  reset(): void {
    this.lastSpeechTime = 0;
    this.accumulatedTranscript = '';
    this.hasFinalTranscript = false;
    this.utteranceEnded = false;
  }
}
