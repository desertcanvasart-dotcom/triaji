import type { RulesInput, BRSResult } from './types';

interface BRSFactor {
  name: string;
  points: number;
  check: (input: RulesInput) => boolean;
}

/**
 * Background Risk Score factors.
 * Each factor adds points to the cumulative BRS.
 */
const BRS_FACTORS: BRSFactor[] = [
  {
    name: 'age_over_60',
    points: 2,
    check: (input) => input.profile.age !== null && input.profile.age > 60,
  },
  {
    name: 'age_over_75',
    points: 3,
    check: (input) => input.profile.age !== null && input.profile.age > 75,
  },
  {
    name: 'smoking_current',
    points: 2,
    check: (input) => input.profile.smokingStatus === 'current',
  },
  {
    name: 'smoking_former',
    points: 1,
    check: (input) => input.profile.smokingStatus === 'former',
  },
  {
    name: 'blood_pressure_uncontrolled',
    points: 3,
    check: (input) => input.profile.bloodPressure === 'uncontrolled',
  },
  {
    name: 'blood_pressure_controlled',
    points: 1,
    check: (input) => input.profile.bloodPressure === 'controlled',
  },
  {
    name: 'diabetes',
    points: 2,
    check: (input) =>
      input.profile.diabetesType === 'type1' ||
      input.profile.diabetesType === 'type2',
  },
  {
    name: 'diabetes_uncontrolled',
    points: 2,
    check: (input) =>
      (input.profile.diabetesType === 'type1' ||
        input.profile.diabetesType === 'type2') &&
      input.profile.diabetesControl === 'uncontrolled',
  },
  {
    name: 'heart_condition_known',
    points: 3,
    check: (input) => input.profile.heartCondition === 'known',
  },
  {
    name: 'previous_heart_attack',
    points: 3,
    check: (input) => input.profile.previousHeartAttack === true,
  },
  {
    name: 'heart_surgery',
    points: 2,
    check: (input) => input.symptoms.includes('heart_surgery'),
  },
  {
    name: 'kidney_disease',
    points: 2,
    check: (input) => input.symptoms.includes('kidney_disease'),
  },
  {
    name: 'liver_disease',
    points: 2,
    check: (input) => input.symptoms.includes('liver_disease'),
  },
];

/**
 * Classify a raw BRS score into a risk level.
 * 0-4 = low, 5-9 = medium, 10+ = high
 */
function classifyLevel(score: number): 'low' | 'medium' | 'high' {
  if (score >= 10) return 'high';
  if (score >= 5) return 'medium';
  return 'low';
}

/**
 * Calculate the Background Risk Score.
 * Pure, synchronous, deterministic.
 */
export function calculateBRS(input: RulesInput): BRSResult {
  let score = 0;
  const factors: string[] = [];

  for (const factor of BRS_FACTORS) {
    if (factor.check(input)) {
      score += factor.points;
      factors.push(factor.name);
    }
  }

  return {
    score,
    level: classifyLevel(score),
    factors,
  };
}
