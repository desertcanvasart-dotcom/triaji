/**
 * Phone-Adapted Triage Orchestrator
 * Wraps the standard triage orchestrator with phone-specific
 * post-processing for spoken output in Arabic or English:
 *
 * Arabic post-processing:
 * - Strips markdown formatting (bold, lists, links)
 * - Truncates to 2 sentences max for brevity
 * - Converts Western numerals to Arabic words (300 → ثلاثمائة)
 * - Adds confirmation patterns before booking actions
 *
 * English post-processing:
 * - Strips markdown formatting
 * - Truncates to 2 sentences max
 * - No numeral conversion (English speakers expect digits)
 */

import { handlePatientMessage, type OrchestratorResult } from '@/lib/triage/orchestrator';
import type { PhoneLanguage } from './language-detector';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PhoneOrchestratorResult extends OrchestratorResult {
  // Inherits all fields from OrchestratorResult
  // response is post-processed for phone delivery
}

// ─── Phone System Prompt Additions ──────────────────────────────────────────

/**
 * Additional system prompt instructions appended to the standard
 * triage system prompt when the session channel is 'phone_call' (Arabic).
 */
export const PHONE_SYSTEM_PROMPT_ADDITIONS = `
أنت الآن في محادثة هاتفية.
- ردودك يجب أن تكون قصيرة جداً: جملة أو اثنتين كحد أقصى.
- تكلم بوضوح وببطء مناسب.
- لا تستخدم أي تنسيق نصي أو قوائم.
- دائماً تأكد مما سمعته قبل المتابعة.
- إذا ذكر المريض أي من الأعراض الطارئة، قل له فوراً أن يتصل بالإسعاف.
- عند إتمام الحجز، اقرأ تفاصيل الموعد بوضوح وأخبره أن التفاصيل ستُرسل على واتساب.
`;

/**
 * English phone system prompt additions.
 * Appended to the standard English triage prompt for phone sessions.
 */
export const PHONE_SYSTEM_PROMPT_ADDITIONS_EN = `
You are now in a phone conversation.
- Your responses must be very short: maximum 1-2 sentences.
- Speak clearly and at a calm, measured pace.
- Do not use any text formatting, lists, or markdown.
- Always confirm what you heard before proceeding.
- If the patient mentions any emergency symptoms, immediately tell them to call emergency services at 123.
- When a booking is confirmed, read the appointment details clearly and tell the patient that details will be sent via WhatsApp.
`;

/**
 * Get the phone system prompt additions for the given language.
 */
export function getPhoneSystemPromptAdditions(lang: PhoneLanguage): string {
  return lang === 'en' ? PHONE_SYSTEM_PROMPT_ADDITIONS_EN : PHONE_SYSTEM_PROMPT_ADDITIONS;
}

// ─── Bilingual Messages ─────────────────────────────────────────────────────

/** Emergency response messages by language */
export const EMERGENCY_RESPONSE: Record<PhoneLanguage, string> = {
  ar: 'الأعراض دي محتاجة رعاية طبية فورية. من فضلك اتصل بالإسعاف دلوقتي على رقم 123.',
  en: 'These symptoms require immediate medical attention. Please call emergency services now — dial 123.',
};

/** Booking confirmation messages by language */
export const BOOKING_CONFIRMATION: Record<PhoneLanguage, string> = {
  ar: 'تم تسجيل بياناتك. هنبعتلك التفاصيل على واتساب. شكراً لتواصلك مع ترياچي.',
  en: 'Your information has been recorded. We will send the details to your WhatsApp. Thank you for contacting Triajji.',
};

/** Error messages by language */
export const PHONE_ERROR_MESSAGE: Record<PhoneLanguage, string> = {
  ar: 'عذراً، حصل مشكلة تقنية. ممكن تعيد اللي قلته؟',
  en: 'Sorry, there was a technical issue. Could you please repeat what you said?',
};

/** STT failure retry messages by language */
export const STT_RETRY_MESSAGE: Record<PhoneLanguage, string> = {
  ar: 'ممكن تعيد اللي قلته تاني لو سمحت؟',
  en: 'Could you please repeat that for me?',
};

/** STT failure handoff messages by language */
export const STT_FAILURE_MESSAGE: Record<PhoneLanguage, string> = {
  ar: 'عذراً، مش قادر أفهمك كويس. هحولك لأحد موظفينا.',
  en: 'I apologize, I am having difficulty understanding you. Let me transfer you to one of our team members.',
};

/** Handoff transfer messages by language */
export const HANDOFF_MESSAGE: Record<PhoneLanguage, string> = {
  ar: 'جاري تحويلك لأحد موظفينا. لحظة من فضلك.',
  en: 'I am transferring you to one of our team members. One moment please.',
};

// ─── Arabic Numeral Conversion ──────────────────────────────────────────────

/** Arabic word representations for common numbers */
const ARABIC_ONES: Record<number, string> = {
  0: 'صفر',
  1: 'واحد',
  2: 'اثنين',
  3: 'ثلاثة',
  4: 'أربعة',
  5: 'خمسة',
  6: 'ستة',
  7: 'سبعة',
  8: 'ثمانية',
  9: 'تسعة',
  10: 'عشرة',
  11: 'أحد عشر',
  12: 'اثنا عشر',
};

const ARABIC_TENS: Record<number, string> = {
  20: 'عشرين',
  30: 'ثلاثين',
  40: 'أربعين',
  50: 'خمسين',
  60: 'ستين',
  70: 'سبعين',
  80: 'ثمانين',
  90: 'تسعين',
};

const ARABIC_HUNDREDS: Record<number, string> = {
  100: 'مائة',
  200: 'مئتين',
  300: 'ثلاثمائة',
  400: 'أربعمائة',
  500: 'خمسمائة',
  600: 'ستمائة',
  700: 'سبعمائة',
  800: 'ثمانمائة',
  900: 'تسعمائة',
};

/**
 * Convert a number (0-9999) to Arabic words.
 * For numbers outside this range, returns the numeral as-is.
 */
function numberToArabicWord(num: number): string {
  if (num < 0 || num > 9999 || !Number.isInteger(num)) {
    return String(num);
  }

  if (num === 0) return ARABIC_ONES[0] ?? 'صفر';

  if (num <= 12) return ARABIC_ONES[num] ?? String(num);

  // 13-19
  if (num >= 13 && num <= 19) {
    const onesWord = ARABIC_ONES[num - 10];
    return onesWord ? `${onesWord} عشر` : String(num);
  }

  // 20-99
  if (num >= 20 && num <= 99) {
    const tens = Math.floor(num / 10) * 10;
    const ones = num % 10;
    const tensWord = ARABIC_TENS[tens];
    if (!tensWord) return String(num);
    if (ones === 0) return tensWord;
    const onesWord = ARABIC_ONES[ones];
    return onesWord ? `${onesWord} و${tensWord}` : String(num);
  }

  // 100-999
  if (num >= 100 && num <= 999) {
    const hundreds = Math.floor(num / 100) * 100;
    const remainder = num % 100;
    const hundredsWord = ARABIC_HUNDREDS[hundreds];
    if (!hundredsWord) return String(num);
    if (remainder === 0) return hundredsWord;
    const remainderWord = numberToArabicWord(remainder);
    return `${hundredsWord} و${remainderWord}`;
  }

  // 1000-9999
  if (num >= 1000 && num <= 9999) {
    const thousands = Math.floor(num / 1000);
    const remainder = num % 1000;
    let thousandsWord: string;

    if (thousands === 1) {
      thousandsWord = 'ألف';
    } else if (thousands === 2) {
      thousandsWord = 'ألفين';
    } else {
      const thousandsNum = ARABIC_ONES[thousands];
      thousandsWord = thousandsNum ? `${thousandsNum} آلاف` : `${thousands} آلاف`;
    }

    if (remainder === 0) return thousandsWord;
    const remainderWord = numberToArabicWord(remainder);
    return `${thousandsWord} و${remainderWord}`;
  }

  return String(num);
}

/**
 * Replace Western Arabic numerals in text with Arabic words.
 * Only converts standalone numbers (not part of reference codes or IDs).
 *
 * Examples:
 * - "300 جنيه" → "ثلاثمائة جنيه"
 * - "الساعة 3" → "الساعة ثلاثة"
 * - "TR-A3F7" → "TR-A3F7" (unchanged — part of reference code)
 */
export function numeralsToArabicWords(text: string): string {
  // Match standalone numbers: word boundary + digits + word boundary
  // Negative lookbehind for alphanumeric to avoid matching numbers in codes
  return text.replace(/(?<![A-Za-z\-])\b(\d{1,4})\b(?![A-Za-z\-])/g, (_match, numStr: string) => {
    const num = parseInt(numStr, 10);
    if (isNaN(num)) return numStr;
    return numberToArabicWord(num);
  });
}

// ─── Markdown Stripping ─────────────────────────────────────────────────────

/**
 * Strip markdown formatting from text for spoken output.
 * Removes bold, italic, links, headers, lists, code blocks, etc.
 */
export function stripMarkdown(text: string): string {
  let result = text;

  // Remove headers (# text)
  result = result.replace(/^#{1,6}\s+/gm, '');

  // Remove bold (**text** or __text__)
  result = result.replace(/\*\*(.*?)\*\*/g, '$1');
  result = result.replace(/__(.*?)__/g, '$1');

  // Remove italic (*text* or _text_)
  result = result.replace(/\*(.*?)\*/g, '$1');
  result = result.replace(/(?<!\w)_(.*?)_(?!\w)/g, '$1');

  // Remove inline code (`code`)
  result = result.replace(/`(.*?)`/g, '$1');

  // Remove links [text](url)
  result = result.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // Remove list markers (-, *, numbered)
  result = result.replace(/^[\s]*[-*]\s+/gm, '');
  result = result.replace(/^[\s]*\d+\.\s+/gm, '');

  // Remove horizontal rules
  result = result.replace(/^[-*_]{3,}$/gm, '');

  // Remove code blocks
  result = result.replace(/```[\s\S]*?```/g, '');

  // Collapse multiple newlines to single
  result = result.replace(/\n{2,}/g, '\n');

  // Collapse multiple spaces to single
  result = result.replace(/\s{2,}/g, ' ');

  return result.trim();
}

// ─── Phone Truncation ───────────────────────────────────────────────────────

/**
 * Truncate text to a maximum of 2 sentences for phone delivery.
 * Uses Arabic and English sentence-ending punctuation as delimiters.
 */
export function truncateForPhone(text: string): string {
  // Split on sentence-ending punctuation (keep the delimiter)
  const sentencePattern = /([.؟!?])\s*/;
  const parts = text.split(sentencePattern);

  // Reconstruct sentences (parts alternate: content, delimiter, content, delimiter, ...)
  const sentences: string[] = [];
  for (let i = 0; i < parts.length; i += 2) {
    const content = parts[i]?.trim() ?? '';
    const delimiter = parts[i + 1] ?? '';
    if (content.length > 0) {
      sentences.push(content + delimiter);
    }
  }

  if (sentences.length <= 2) {
    return text.trim();
  }

  // Take first 2 sentences
  return sentences.slice(0, 2).join(' ').trim();
}

// ─── Phone Orchestrator ─────────────────────────────────────────────────────

/**
 * Handle a patient message in a phone triage session.
 * Wraps the standard orchestrator and post-processes the response
 * for spoken delivery in the appropriate language.
 *
 * Arabic post-processing:
 * 1. Strip markdown formatting
 * 2. Truncate to max 2 sentences
 * 3. Convert Western numerals to Arabic words
 *
 * English post-processing:
 * 1. Strip markdown formatting
 * 2. Truncate to max 2 sentences
 * (No numeral conversion — English speakers expect digits)
 */
export async function handlePhoneMessage(
  sessionId: string,
  patientText: string,
  lang: PhoneLanguage = 'ar'
): Promise<PhoneOrchestratorResult> {
  const result = await handlePatientMessage(sessionId, patientText);

  // Post-process the response for phone delivery
  let processedResponse = result.response;

  // 1. Strip markdown
  processedResponse = stripMarkdown(processedResponse);

  // 2. Truncate to 2 sentences max
  processedResponse = truncateForPhone(processedResponse);

  // 3. Convert numerals to Arabic words (Arabic only)
  if (lang === 'ar') {
    processedResponse = numeralsToArabicWords(processedResponse);
  }

  return {
    ...result,
    response: processedResponse,
  };
}
