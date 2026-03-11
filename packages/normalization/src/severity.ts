import type { SeverityLevel } from './types.js';

interface SeverityMatch {
  level: SeverityLevel;
  keywords: string[];
}

const severityLevels: SeverityMatch[] = [
  {
    level: 'worst_ever',
    keywords: ['اسوأ وجع', 'أسوأ وجع', 'هتموت', 'هموت'],
  },
  {
    level: 'severe',
    keywords: ['شديد', 'شديدة', 'جامد', 'جامدة', 'قوي', 'قوية'],
  },
  {
    level: 'moderate',
    keywords: ['متوسط', 'متوسطة'],
  },
  {
    level: 'mild',
    keywords: ['خفيف', 'خفيفة', 'بسيط', 'بسيطة'],
  },
];

/**
 * Extracts the highest severity level found in the given Arabic text.
 * Returns null if no severity indicator is detected.
 *
 * Priority: worst_ever > severe > moderate > mild.
 * The first match in priority order wins.
 */
export function extractSeverity(text: string): SeverityLevel | null {
  for (const { level, keywords } of severityLevels) {
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        return level;
      }
    }
  }

  return null;
}
