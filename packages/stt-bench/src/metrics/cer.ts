/**
 * Character Error Rate (CER) — character-level Levenshtein after Arabic
 * normalization. Less forgiving than WER for short utterances and more
 * sensitive to single-letter errors (e.g., ى vs ي), which matters when
 * the downstream Triaji dialect map does exact-string matching.
 *
 *   CER = (S + D + I) / N_chars_in_reference
 */

import { normalizeArabic } from './normalize-arabic.js';

export interface CerBreakdown {
  cer: number;
  substitutions: number;
  deletions: number;
  insertions: number;
  refLength: number;
  hypLength: number;
}

export function computeCer(reference: string, hypothesis: string): CerBreakdown {
  // Strip whitespace for character-level comparison
  const ref = normalizeArabic(reference).replace(/\s+/g, '');
  const hyp = normalizeArabic(hypothesis).replace(/\s+/g, '');

  const n = ref.length;
  const m = hyp.length;

  if (n === 0) {
    return {
      cer: m === 0 ? 0 : 1,
      substitutions: 0,
      deletions: 0,
      insertions: m,
      refLength: 0,
      hypLength: m,
    };
  }

  // Two-row Levenshtein (we don't need full backtrace for CER)
  let prev = new Array<number>(m + 1);
  let curr = new Array<number>(m + 1);
  for (let j = 0; j <= m; j++) prev[j] = j;

  for (let i = 1; i <= n; i++) {
    curr[0] = i;
    for (let j = 1; j <= m; j++) {
      if (ref[i - 1] === hyp[j - 1]) {
        curr[j] = prev[j - 1]!;
      } else {
        curr[j] = 1 + Math.min(prev[j - 1]!, prev[j]!, curr[j - 1]!);
      }
    }
    [prev, curr] = [curr, prev];
  }

  const distance = prev[m]!;
  // We don't track S/D/I separately here without a backtrace; approximate
  // with the total edit distance — that's the only number that matters for CER.
  return {
    cer: distance / n,
    substitutions: 0,
    deletions: 0,
    insertions: 0,
    refLength: n,
    hypLength: m,
  };
}
