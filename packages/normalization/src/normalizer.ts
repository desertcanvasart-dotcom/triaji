import type { NormalizedResult } from './types';
import { dialectMap } from './dialect-map';
import { extractBodyParts } from './body-parts';
import { extractSeverity } from './severity';

/**
 * Strips Arabic diacritics (tashkeel) from text.
 * Removes: fathah, dammah, kasrah, sukun, shadda, tanween, etc.
 */
function stripDiacritics(text: string): string {
  return text.replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED]/g, '');
}

/**
 * Normalizes Arabic text for matching: strips diacritics, normalizes
 * alef/taa-marbuta variants, and trims whitespace.
 */
function prepareText(text: string): string {
  let normalized = stripDiacritics(text);

  // Normalize alef variants (أ إ آ ٱ) to bare alef
  normalized = normalized.replace(/[أإآٱ]/g, 'ا');

  // Normalize taa marbuta to haa
  normalized = normalized.replace(/ة/g, 'ه');

  return normalized.trim();
}

/**
 * Looks up symptom codes from the dialect map for the given input text.
 * Tries exact match first, then checks if any dialect phrase is contained in the input.
 * Returns the matched symptom codes and the number of matches found.
 */
function lookupSymptoms(originalText: string, preparedText: string): { symptoms: string[]; matchCount: number } {
  const foundSymptoms = new Set<string>();
  let matchCount = 0;

  // Check if any dialect phrase appears in the input text
  // Try both the original and prepared text for maximum matching
  for (const [phrase, codes] of dialectMap) {
    const preparedPhrase = prepareText(phrase);

    if (
      originalText.includes(phrase) ||
      preparedText.includes(preparedPhrase) ||
      originalText.includes(preparedPhrase) ||
      preparedText.includes(phrase)
    ) {
      matchCount++;
      for (const code of codes) {
        foundSymptoms.add(code);
      }
    }
  }

  return { symptoms: [...foundSymptoms], matchCount };
}

/**
 * Calculates confidence score based on number of matches, body parts detected,
 * and severity presence.
 */
function calculateConfidence(
  matchCount: number,
  bodyPartCount: number,
  hasSeverity: boolean,
): number {
  if (matchCount === 0 && bodyPartCount === 0) {
    return 0.1;
  }

  let confidence = 0.0;

  // Each symptom match contributes to confidence
  if (matchCount >= 3) {
    confidence = 0.95;
  } else if (matchCount === 2) {
    confidence = 0.85;
  } else if (matchCount === 1) {
    confidence = 0.75;
  }

  // Body parts alone provide some confidence
  if (matchCount === 0 && bodyPartCount > 0) {
    confidence = 0.3;
  }

  // Severity words provide a slight boost
  if (hasSeverity && confidence > 0) {
    confidence = Math.min(1.0, confidence + 0.05);
  }

  return Math.round(confidence * 100) / 100;
}

/**
 * Normalizes Egyptian Arabic dialect input into structured symptom codes,
 * body parts, and severity level.
 *
 * @param input - Raw Egyptian Arabic patient text
 * @returns Structured normalization result with confidence score
 */
export function normalize(input: string): NormalizedResult {
  const trimmed = input.trim();

  if (trimmed.length === 0) {
    return {
      symptoms: [],
      bodyParts: [],
      severity: null,
      confidence: 0.0,
      originalText: input,
    };
  }

  const prepared = prepareText(trimmed);

  const { symptoms, matchCount } = lookupSymptoms(trimmed, prepared);
  const bodyParts = extractBodyParts(trimmed);
  const severity = extractSeverity(trimmed);

  // Also try body part extraction on prepared text
  const bodyPartsPrepared = extractBodyParts(prepared);
  const allBodyParts = [...new Set([...bodyParts, ...bodyPartsPrepared])];

  const confidence = calculateConfidence(matchCount, allBodyParts.length, severity !== null);

  return {
    symptoms,
    bodyParts: allBodyParts,
    severity,
    confidence,
    originalText: input,
  };
}
