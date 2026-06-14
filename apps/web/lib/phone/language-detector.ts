/**
 * Phone Language Detector
 * Determines the patient's preferred language (Arabic or English)
 * from their first utterance during a phone call.
 *
 * Uses two signals:
 *   1. Deepgram's detected_language field (when using multi-language mode)
 *   2. Script-based heuristic (Arabic Unicode range vs Latin characters)
 *
 * After detection, the language is locked for the entire call session.
 * If language cannot be determined after the detection window,
 * a bilingual prompt asks the patient to state their preference.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export type PhoneLanguage = 'ar' | 'en';

interface DetectionResult {
  lang: PhoneLanguage | 'unknown';
  confidence: number;
}

// ─── Constants ──────────────────────────────────────────────────────────────

/** Minimum confidence threshold to accept a language detection */
const CONFIDENCE_THRESHOLD = 0.6;

/** Minimum transcript length (chars) before attempting heuristic detection */
const MIN_TRANSCRIPT_LENGTH = 3;

/**
 * Arabic Unicode character range pattern.
 * Matches Arabic letters, diacritics, and common Arabic punctuation.
 */
const ARABIC_CHAR_PATTERN = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/;

/**
 * Latin character range pattern.
 * Matches basic English alphabet characters.
 */
const LATIN_CHAR_PATTERN = /[A-Za-z]/;

// ─── Language Detector ──────────────────────────────────────────────────────

export class PhoneLanguageDetector {
  private detectedLang: PhoneLanguage | null = null;
  private locked: boolean = false;

  /**
   * Whether a language has been detected and locked for this session.
   */
  get isDetected(): boolean {
    return this.locked && this.detectedLang !== null;
  }

  /**
   * Get the detected language, or null if not yet determined.
   */
  get language(): PhoneLanguage | null {
    return this.detectedLang;
  }

  /**
   * Lock a specific language for this session.
   * Called externally when the patient explicitly states their preference.
   */
  setLanguage(lang: PhoneLanguage): void {
    this.detectedLang = lang;
    this.locked = true;
  }

  /**
   * Detect language from a Deepgram transcript.
   *
   * @param transcript The transcribed text from Deepgram
   * @param deepgramLang Optional language code reported by Deepgram (e.g., 'ar', 'en')
   * @param deepgramConfidence Optional confidence score from Deepgram (0-1)
   * @returns The detected language or 'unknown' if insufficient data
   */
  detect(
    transcript: string,
    deepgramLang?: string,
    deepgramConfidence?: number
  ): PhoneLanguage | 'unknown' {
    // If already locked, return the locked language
    if (this.locked && this.detectedLang) {
      return this.detectedLang;
    }

    // Strategy 1: Use Deepgram's detected language if available and confident
    if (deepgramLang && deepgramConfidence !== undefined) {
      const result = this.detectFromDeepgram(deepgramLang, deepgramConfidence);
      if (result.lang !== 'unknown') {
        this.detectedLang = result.lang;
        this.locked = true;
        return result.lang;
      }
    }

    // Strategy 2: Script-based heuristic from transcript text
    const heuristicResult = this.detectFromScript(transcript);
    if (heuristicResult.lang !== 'unknown' && heuristicResult.confidence >= CONFIDENCE_THRESHOLD) {
      this.detectedLang = heuristicResult.lang;
      this.locked = true;
      return heuristicResult.lang;
    }

    return 'unknown';
  }

  /**
   * Detect language from Deepgram's metadata.
   */
  private detectFromDeepgram(lang: string, confidence: number): DetectionResult {
    if (confidence < CONFIDENCE_THRESHOLD) {
      return { lang: 'unknown', confidence };
    }

    const normalizedLang = lang.toLowerCase().trim();

    // Deepgram reports language codes like 'ar', 'en', 'en-US', 'ar-EG', etc.
    if (normalizedLang === 'en' || normalizedLang.startsWith('en-')) {
      return { lang: 'en', confidence };
    }

    if (normalizedLang === 'ar' || normalizedLang.startsWith('ar-')) {
      return { lang: 'ar', confidence };
    }

    return { lang: 'unknown', confidence };
  }

  /**
   * Detect language from the script used in the transcript.
   * Counts Arabic vs Latin characters and returns the dominant script.
   */
  private detectFromScript(transcript: string): DetectionResult {
    const trimmed = transcript.trim();

    if (trimmed.length < MIN_TRANSCRIPT_LENGTH) {
      return { lang: 'unknown', confidence: 0 };
    }

    let arabicCount = 0;
    let latinCount = 0;

    for (const char of trimmed) {
      if (ARABIC_CHAR_PATTERN.test(char)) {
        arabicCount++;
      } else if (LATIN_CHAR_PATTERN.test(char)) {
        latinCount++;
      }
    }

    const total = arabicCount + latinCount;
    if (total === 0) {
      return { lang: 'unknown', confidence: 0 };
    }

    const arabicRatio = arabicCount / total;
    const latinRatio = latinCount / total;

    if (arabicRatio >= 0.7) {
      return { lang: 'ar', confidence: arabicRatio };
    }

    if (latinRatio >= 0.7) {
      return { lang: 'en', confidence: latinRatio };
    }

    return { lang: 'unknown', confidence: Math.max(arabicRatio, latinRatio) };
  }
}
