import type { RulesInput, RulesResult } from './types';
import { checkEmergency } from './emergency';
import { calculateBRS } from './brs';
import { determineUrgency } from './urgency';

/**
 * Main rules evaluator.
 *
 * Executes three deterministic steps in order:
 *   1. Emergency check (runs first, always)
 *   2. BRS calculation
 *   3. Urgency modulation
 *
 * CRITICAL: This function is synchronous, pure, and has zero external
 * dependencies. It must execute in under 5ms.
 *
 * Same input always produces the same output (deterministic).
 */
export function evaluate(input: RulesInput): RulesResult {
  // Step 1: Emergency check
  const emergency = checkEmergency(input);

  // Step 2: BRS calculation
  const brs = calculateBRS(input);

  // Step 3: Urgency modulation
  const urgencyLevel = determineUrgency(emergency, brs);

  return {
    emergency,
    brs,
    urgencyLevel,
  };
}
