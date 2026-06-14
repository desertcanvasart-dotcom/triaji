/**
 * Word Error Rate (WER) — the standard STT quality metric.
 *
 *   WER = (S + D + I) / N
 *
 * where:
 *   S = substitutions
 *   D = deletions
 *   I = insertions
 *   N = words in the reference (ground truth)
 *
 * Computed via Levenshtein distance at the word level after Arabic normalization.
 *
 * Notes:
 *   - WER can exceed 1.0 when the hypothesis has many spurious insertions.
 *   - We also return the alignment so the report can highlight mistakes.
 */

import { tokenize } from './normalize-arabic.js';

export interface WerBreakdown {
  wer: number;
  substitutions: number;
  deletions: number;
  insertions: number;
  hits: number;
  refLength: number;
  hypLength: number;
}

export function computeWer(reference: string, hypothesis: string): WerBreakdown {
  const ref = tokenize(reference);
  const hyp = tokenize(hypothesis);

  const n = ref.length;
  const m = hyp.length;

  if (n === 0) {
    return {
      wer: m === 0 ? 0 : 1,
      substitutions: 0,
      deletions: 0,
      insertions: m,
      hits: 0,
      refLength: 0,
      hypLength: m,
    };
  }

  // dp[i][j] = min edits to transform ref[0..i) into hyp[0..j)
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  // op[i][j] = 'M' match, 'S' sub, 'D' deletion, 'I' insertion
  const op: string[][] = Array.from({ length: n + 1 }, () => new Array<string>(m + 1).fill(''));

  for (let i = 0; i <= n; i++) {
    dp[i]![0] = i;
    op[i]![0] = 'D';
  }
  for (let j = 0; j <= m; j++) {
    dp[0]![j] = j;
    op[0]![j] = 'I';
  }
  op[0]![0] = '';

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (ref[i - 1] === hyp[j - 1]) {
        dp[i]![j] = dp[i - 1]![j - 1]!;
        op[i]![j] = 'M';
      } else {
        const sub = dp[i - 1]![j - 1]! + 1;
        const del = dp[i - 1]![j]! + 1;
        const ins = dp[i]![j - 1]! + 1;
        const best = Math.min(sub, del, ins);
        dp[i]![j] = best;
        op[i]![j] = best === sub ? 'S' : best === del ? 'D' : 'I';
      }
    }
  }

  // Backtrace
  let i = n;
  let j = m;
  let subs = 0;
  let dels = 0;
  let ins = 0;
  let hits = 0;
  while (i > 0 || j > 0) {
    const o = op[i]![j];
    if (o === 'M') {
      hits++;
      i--;
      j--;
    } else if (o === 'S') {
      subs++;
      i--;
      j--;
    } else if (o === 'D') {
      dels++;
      i--;
    } else {
      ins++;
      j--;
    }
  }

  const wer = (subs + dels + ins) / n;
  return {
    wer,
    substitutions: subs,
    deletions: dels,
    insertions: ins,
    hits,
    refLength: n,
    hypLength: m,
  };
}
