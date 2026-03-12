import type { BRSResult, EmergencyResult } from './types';

/**
 * Determine the urgency level based on emergency result and BRS.
 *
 * Logic:
 *   - If emergency is triggered: 'emergency'
 *   - If BRS level is 'high': modulate routine -> urgent
 *   - If BRS level is 'medium': keep as-is (routine stays routine, but flagged)
 *   - If BRS level is 'low': no change (routine)
 *
 * Pure, synchronous, deterministic.
 */
export function determineUrgency(
  emergency: EmergencyResult,
  brs: BRSResult,
): 'routine' | 'urgent' | 'emergency' {
  // Emergency always takes precedence
  if (emergency.triggered) {
    return 'emergency';
  }

  // High BRS modulates routine to urgent
  if (brs.level === 'high') {
    return 'urgent';
  }

  // Medium and low BRS remain routine
  return 'routine';
}
