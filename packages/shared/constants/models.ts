/**
 * Claude model IDs — single source of truth for every AI feature.
 * When Anthropic releases or retires a model, update it here only.
 */

/**
 * Primary model: triage conversations, health assistant, quick intake,
 * telehealth transcript summaries, record analysis, lab-result processing,
 * follow-up extraction.
 */
export const CLAUDE_MODEL = 'claude-sonnet-5';

/**
 * Lightweight model for cheap, high-volume classification tasks
 * (e.g. drug-interaction summaries via OpenFDA).
 */
export const CLAUDE_MODEL_LIGHT = 'claude-haiku-4-5-20251001';
