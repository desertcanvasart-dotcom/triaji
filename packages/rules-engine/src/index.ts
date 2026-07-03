export { evaluate } from './evaluator';
export { checkEmergency, EMERGENCY_RULES } from './emergency';
export { checkEmergencyWithICU } from './emergency-icu';
export { calculateBRS } from './brs';
export { determineUrgency } from './urgency';

export type {
  RulesInput,
  EmergencyResult,
  EmergencyWithICUResult,
  IcuBedInfo,
  BRSResult,
  RulesResult,
} from './types';
