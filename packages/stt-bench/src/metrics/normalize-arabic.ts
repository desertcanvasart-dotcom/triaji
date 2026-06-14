/**
 * Arabic-aware text normalization for fair WER/CER comparison.
 *
 * Two providers can transcribe the same audio "correctly" but produce
 * different surface forms (ة vs ه, ي vs ى, with/without hamza, etc.).
 * Without normalization, WER would penalize providers for orthographic
 * choices that have nothing to do with comprehension.
 *
 * This normalizer applies the standard Arabic NLP preprocessing pipeline:
 *   1. Strip tatweel (ـ)
 *   2. Strip diacritics (harakat)
 *   3. Unify alef forms (أ إ آ ا → ا)
 *   4. Unify ya/alef-maksura (ى → ي)
 *   5. Unify ta-marbuta (ة → ه) — optional, controlled by flag
 *   6. Unify hamza forms (ؤ ئ → و ي without hamza)
 *   7. Normalize Arabic-Indic digits to ASCII (٠-٩ → 0-9)
 *   8. Remove punctuation
 *   9. Collapse whitespace
 *
 * The defaults are tuned for ASR comparison — aggressive normalization
 * so we measure phonetic correctness, not orthographic quirks.
 */

export interface NormalizeOptions {
  /** Strip Arabic diacritics (fatha, kasra, damma, shadda, sukun, etc.) */
  stripDiacritics?: boolean;
  /** Unify alef variants (أ إ آ → ا) */
  unifyAlef?: boolean;
  /** Unify alef-maksura → ya (ى → ي) */
  unifyYa?: boolean;
  /** Unify ta-marbuta → ha (ة → ه) — affects ~15% of words */
  unifyTaMarbuta?: boolean;
  /** Unify hamza-on-waw/ya (ؤ ئ → و ي) */
  unifyHamza?: boolean;
  /** Convert Arabic-Indic digits to ASCII */
  asciiDigits?: boolean;
  /** Remove punctuation (Arabic + Latin) */
  stripPunctuation?: boolean;
  /** Lowercase Latin chars (for code-switched English) */
  lowercase?: boolean;
}

const DEFAULT_OPTS: Required<NormalizeOptions> = {
  stripDiacritics: true,
  unifyAlef: true,
  unifyYa: true,
  unifyTaMarbuta: true,
  unifyHamza: true,
  asciiDigits: true,
  stripPunctuation: true,
  lowercase: true,
};

// Arabic diacritics (harakat) — fatha, kasra, damma, shadda, sukun, etc.
const DIACRITICS = /[\u064B-\u065F\u0670\u06D6-\u06ED]/g;
// Tatweel — letter-stretcher, semantically meaningless
const TATWEEL = /\u0640/g;
const ALEF_VARIANTS = /[\u0623\u0625\u0622]/g; // أ إ آ
const ALEF_MAKSURA = /\u0649/g; // ى
const TA_MARBUTA = /\u0629/g; // ة
const HAMZA_ON_WAW = /\u0624/g; // ؤ
const HAMZA_ON_YA = /\u0626/g; // ئ
const ARABIC_INDIC_DIGITS = /[\u0660-\u0669]/g;
const PERSIAN_DIGITS = /[\u06F0-\u06F9]/g;
// Arabic + Latin punctuation
const PUNCT = /[.,،;؛:؟?!"'()[\]{}«»\-—…/\\|]/g;
const MULTISPACE = /\s+/g;

export function normalizeArabic(text: string, opts: NormalizeOptions = {}): string {
  const o = { ...DEFAULT_OPTS, ...opts };
  let s = text;

  // Always strip tatweel — it's never semantic
  s = s.replace(TATWEEL, '');

  if (o.stripDiacritics) s = s.replace(DIACRITICS, '');
  if (o.unifyAlef) s = s.replace(ALEF_VARIANTS, '\u0627'); // → ا
  if (o.unifyYa) s = s.replace(ALEF_MAKSURA, '\u064A'); // → ي
  if (o.unifyTaMarbuta) s = s.replace(TA_MARBUTA, '\u0647'); // → ه
  if (o.unifyHamza) {
    s = s.replace(HAMZA_ON_WAW, '\u0648').replace(HAMZA_ON_YA, '\u064A');
  }
  if (o.asciiDigits) {
    s = s.replace(ARABIC_INDIC_DIGITS, (d) =>
      String.fromCharCode(d.charCodeAt(0) - 0x0660 + 0x30)
    );
    s = s.replace(PERSIAN_DIGITS, (d) =>
      String.fromCharCode(d.charCodeAt(0) - 0x06F0 + 0x30)
    );
  }
  if (o.stripPunctuation) s = s.replace(PUNCT, ' ');
  if (o.lowercase) s = s.toLowerCase();

  return s.replace(MULTISPACE, ' ').trim();
}

/** Tokenize normalized text into words (whitespace-split, post-normalization). */
export function tokenize(text: string): string[] {
  const norm = normalizeArabic(text);
  if (norm.length === 0) return [];
  return norm.split(' ').filter((w) => w.length > 0);
}
