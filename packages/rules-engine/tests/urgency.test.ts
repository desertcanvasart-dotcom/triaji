import { describe, it, expect } from 'vitest';
import { determineUrgency } from '../src/urgency.js';
import { evaluate } from '../src/evaluator.js';
import type { EmergencyResult, BRSResult, RulesInput } from '../src/types.js';

/** Helper to create a non-triggered emergency result */
function noEmergency(): EmergencyResult {
  return {
    triggered: false,
    ruleName: null,
    escalationType: null,
    responseAr: null,
    priority: null,
  };
}

/** Helper to create a triggered emergency result */
function triggeredEmergency(): EmergencyResult {
  return {
    triggered: true,
    ruleName: 'test_rule',
    escalationType: 'call_ambulance',
    responseAr: 'اتصل بالإسعاف فوراً',
    priority: 1,
  };
}

/** Helper to create BRS results */
function makeBRS(level: 'low' | 'medium' | 'high', score: number): BRSResult {
  return {
    score,
    level,
    factors: [],
  };
}

/** Baseline input for full evaluator tests */
function baseInput(overrides?: Partial<RulesInput>): RulesInput {
  return {
    symptoms: [],
    rawText: '',
    profile: {
      age: 35,
      biologicalSex: 'male',
      smokingStatus: 'never',
      bloodPressure: 'none',
      diabetesType: 'none',
      diabetesControl: 'na',
      heartCondition: 'none',
      previousHeartAttack: false,
      brs: 0,
      riskLevel: 'low',
    },
    ...overrides,
  };
}

describe('Urgency Modulation', () => {
  describe('determineUrgency function', () => {
    it('should return emergency when emergency is triggered', () => {
      const result = determineUrgency(
        triggeredEmergency(),
        makeBRS('low', 0),
      );
      expect(result).toBe('emergency');
    });

    it('should return emergency regardless of BRS when emergency is triggered', () => {
      expect(
        determineUrgency(triggeredEmergency(), makeBRS('high', 15)),
      ).toBe('emergency');
      expect(
        determineUrgency(triggeredEmergency(), makeBRS('medium', 7)),
      ).toBe('emergency');
      expect(
        determineUrgency(triggeredEmergency(), makeBRS('low', 2)),
      ).toBe('emergency');
    });

    it('should return urgent when BRS is high and no emergency', () => {
      const result = determineUrgency(noEmergency(), makeBRS('high', 12));
      expect(result).toBe('urgent');
    });

    it('should return routine when BRS is medium and no emergency', () => {
      const result = determineUrgency(
        noEmergency(),
        makeBRS('medium', 7),
      );
      expect(result).toBe('routine');
    });

    it('should return routine when BRS is low and no emergency', () => {
      const result = determineUrgency(noEmergency(), makeBRS('low', 2));
      expect(result).toBe('routine');
    });

    it('should return routine when BRS is zero and no emergency', () => {
      const result = determineUrgency(noEmergency(), makeBRS('low', 0));
      expect(result).toBe('routine');
    });
  });

  describe('Full Evaluator Integration', () => {
    it('should return emergency urgency for chest_pain + SOB', () => {
      const result = evaluate(
        baseInput({
          symptoms: ['chest_pain', 'shortness_of_breath'],
        }),
      );
      expect(result.urgencyLevel).toBe('emergency');
      expect(result.emergency.triggered).toBe(true);
    });

    it('should return urgent for healthy person symptoms + high BRS', () => {
      const input = baseInput({
        symptoms: ['headache'],
      });
      input.profile.age = 80;
      input.profile.smokingStatus = 'current';
      input.profile.heartCondition = 'known';
      input.profile.previousHeartAttack = true;
      // BRS: 2+3+2+3+3 = 13 (high)
      const result = evaluate(input);
      expect(result.urgencyLevel).toBe('urgent');
      expect(result.emergency.triggered).toBe(false);
      expect(result.brs.level).toBe('high');
    });

    it('should return routine for healthy young person with non-emergency symptoms', () => {
      const result = evaluate(
        baseInput({
          symptoms: ['headache', 'cough'],
        }),
      );
      expect(result.urgencyLevel).toBe('routine');
      expect(result.emergency.triggered).toBe(false);
      expect(result.brs.level).toBe('low');
    });

    it('should return routine for medium BRS with non-emergency symptoms', () => {
      const input = baseInput({
        symptoms: ['headache'],
      });
      input.profile.age = 80; // 2+3=5 (medium)
      const result = evaluate(input);
      expect(result.urgencyLevel).toBe('routine');
      expect(result.brs.level).toBe('medium');
    });

    it('should return emergency even with high BRS (emergency overrides)', () => {
      const input = baseInput({
        symptoms: ['chest_pain', 'shortness_of_breath'],
      });
      input.profile.age = 80;
      input.profile.heartCondition = 'known';
      input.profile.previousHeartAttack = true;
      const result = evaluate(input);
      expect(result.urgencyLevel).toBe('emergency');
      expect(result.emergency.triggered).toBe(true);
      expect(result.brs.level).toBe('high');
    });

    it('should contain all three result components', () => {
      const result = evaluate(baseInput());
      expect(result).toHaveProperty('emergency');
      expect(result).toHaveProperty('brs');
      expect(result).toHaveProperty('urgencyLevel');
    });
  });

  describe('Determinism', () => {
    it('should produce identical results for identical inputs', () => {
      const input = baseInput({
        symptoms: ['headache'],
      });
      input.profile.age = 70;
      input.profile.smokingStatus = 'current';

      const result1 = evaluate(input);
      const result2 = evaluate(input);
      expect(result1).toEqual(result2);
    });
  });
});
