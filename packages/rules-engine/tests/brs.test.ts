import { describe, it, expect } from 'vitest';
import { calculateBRS } from '../src/brs.js';
import type { RulesInput } from '../src/types.js';

/** Baseline input with all-clear values */
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

describe('BRS Calculator', () => {
  // ─── Individual Factors ───────────────────────────────────────────

  describe('Age Factors', () => {
    it('should add 2 points for age > 60', () => {
      const input = baseInput();
      input.profile.age = 65;
      const result = calculateBRS(input);
      expect(result.score).toBe(2);
      expect(result.factors).toContain('age_over_60');
    });

    it('should add 2 + 3 = 5 points for age > 75 (both factors)', () => {
      const input = baseInput();
      input.profile.age = 80;
      const result = calculateBRS(input);
      expect(result.score).toBe(5);
      expect(result.factors).toContain('age_over_60');
      expect(result.factors).toContain('age_over_75');
    });

    it('should add 0 points for age <= 60', () => {
      const input = baseInput();
      input.profile.age = 60;
      const result = calculateBRS(input);
      expect(result.score).toBe(0);
      expect(result.factors).not.toContain('age_over_60');
    });

    it('should add 0 points for null age', () => {
      const input = baseInput();
      input.profile.age = null;
      const result = calculateBRS(input);
      expect(result.score).toBe(0);
    });

    it('should handle exact boundary age = 61', () => {
      const input = baseInput();
      input.profile.age = 61;
      const result = calculateBRS(input);
      expect(result.factors).toContain('age_over_60');
      expect(result.factors).not.toContain('age_over_75');
    });

    it('should handle exact boundary age = 75 (not > 75)', () => {
      const input = baseInput();
      input.profile.age = 75;
      const result = calculateBRS(input);
      expect(result.factors).toContain('age_over_60');
      expect(result.factors).not.toContain('age_over_75');
    });
  });

  describe('Smoking Factors', () => {
    it('should add 2 points for current smoker', () => {
      const input = baseInput();
      input.profile.smokingStatus = 'current';
      const result = calculateBRS(input);
      expect(result.score).toBe(2);
      expect(result.factors).toContain('smoking_current');
    });

    it('should add 1 point for former smoker', () => {
      const input = baseInput();
      input.profile.smokingStatus = 'former';
      const result = calculateBRS(input);
      expect(result.score).toBe(1);
      expect(result.factors).toContain('smoking_former');
    });

    it('should add 0 points for never smoker', () => {
      const input = baseInput();
      input.profile.smokingStatus = 'never';
      const result = calculateBRS(input);
      expect(result.score).toBe(0);
    });

    it('should not have both smoking_current and smoking_former', () => {
      const input = baseInput();
      input.profile.smokingStatus = 'current';
      const result = calculateBRS(input);
      expect(result.factors).toContain('smoking_current');
      expect(result.factors).not.toContain('smoking_former');
    });
  });

  describe('Blood Pressure Factors', () => {
    it('should add 3 points for uncontrolled blood pressure', () => {
      const input = baseInput();
      input.profile.bloodPressure = 'uncontrolled';
      const result = calculateBRS(input);
      expect(result.score).toBe(3);
      expect(result.factors).toContain('blood_pressure_uncontrolled');
    });

    it('should add 1 point for controlled blood pressure', () => {
      const input = baseInput();
      input.profile.bloodPressure = 'controlled';
      const result = calculateBRS(input);
      expect(result.score).toBe(1);
      expect(result.factors).toContain('blood_pressure_controlled');
    });

    it('should add 0 points for no blood pressure issues', () => {
      const input = baseInput();
      input.profile.bloodPressure = 'none';
      const result = calculateBRS(input);
      expect(result.score).toBe(0);
    });

    it('should add 0 points for unknown blood pressure', () => {
      const input = baseInput();
      input.profile.bloodPressure = 'unknown';
      const result = calculateBRS(input);
      expect(result.score).toBe(0);
    });
  });

  describe('Diabetes Factors', () => {
    it('should add 2 points for type1 diabetes', () => {
      const input = baseInput();
      input.profile.diabetesType = 'type1';
      input.profile.diabetesControl = 'controlled';
      const result = calculateBRS(input);
      expect(result.score).toBe(2);
      expect(result.factors).toContain('diabetes');
    });

    it('should add 2 points for type2 diabetes', () => {
      const input = baseInput();
      input.profile.diabetesType = 'type2';
      input.profile.diabetesControl = 'controlled';
      const result = calculateBRS(input);
      expect(result.score).toBe(2);
      expect(result.factors).toContain('diabetes');
    });

    it('should add 2 + 2 = 4 points for uncontrolled type2 diabetes', () => {
      const input = baseInput();
      input.profile.diabetesType = 'type2';
      input.profile.diabetesControl = 'uncontrolled';
      const result = calculateBRS(input);
      expect(result.score).toBe(4);
      expect(result.factors).toContain('diabetes');
      expect(result.factors).toContain('diabetes_uncontrolled');
    });

    it('should add 2 + 2 = 4 points for uncontrolled type1 diabetes', () => {
      const input = baseInput();
      input.profile.diabetesType = 'type1';
      input.profile.diabetesControl = 'uncontrolled';
      const result = calculateBRS(input);
      expect(result.score).toBe(4);
      expect(result.factors).toContain('diabetes');
      expect(result.factors).toContain('diabetes_uncontrolled');
    });

    it('should add 0 points for no diabetes', () => {
      const input = baseInput();
      input.profile.diabetesType = 'none';
      const result = calculateBRS(input);
      expect(result.factors).not.toContain('diabetes');
    });

    it('should add 0 points for unknown diabetes', () => {
      const input = baseInput();
      input.profile.diabetesType = 'unknown';
      const result = calculateBRS(input);
      expect(result.factors).not.toContain('diabetes');
    });
  });

  describe('Heart Condition Factors', () => {
    it('should add 3 points for known heart condition', () => {
      const input = baseInput();
      input.profile.heartCondition = 'known';
      const result = calculateBRS(input);
      expect(result.score).toBe(3);
      expect(result.factors).toContain('heart_condition_known');
    });

    it('should add 3 points for previous heart attack', () => {
      const input = baseInput();
      input.profile.previousHeartAttack = true;
      const result = calculateBRS(input);
      expect(result.score).toBe(3);
      expect(result.factors).toContain('previous_heart_attack');
    });

    it('should add 6 points for known heart condition + previous heart attack', () => {
      const input = baseInput();
      input.profile.heartCondition = 'known';
      input.profile.previousHeartAttack = true;
      const result = calculateBRS(input);
      expect(result.score).toBe(6);
      expect(result.factors).toContain('heart_condition_known');
      expect(result.factors).toContain('previous_heart_attack');
    });

    it('should add 0 points for no heart condition', () => {
      const input = baseInput();
      input.profile.heartCondition = 'none';
      const result = calculateBRS(input);
      expect(result.factors).not.toContain('heart_condition_known');
    });
  });

  describe('Symptom-Based Factors', () => {
    it('should add 2 points for heart_surgery in symptoms', () => {
      const result = calculateBRS(
        baseInput({ symptoms: ['heart_surgery'] }),
      );
      expect(result.score).toBe(2);
      expect(result.factors).toContain('heart_surgery');
    });

    it('should add 2 points for kidney_disease in symptoms', () => {
      const result = calculateBRS(
        baseInput({ symptoms: ['kidney_disease'] }),
      );
      expect(result.score).toBe(2);
      expect(result.factors).toContain('kidney_disease');
    });

    it('should add 2 points for liver_disease in symptoms', () => {
      const result = calculateBRS(
        baseInput({ symptoms: ['liver_disease'] }),
      );
      expect(result.score).toBe(2);
      expect(result.factors).toContain('liver_disease');
    });

    it('should accumulate multiple symptom-based factors', () => {
      const result = calculateBRS(
        baseInput({
          symptoms: ['heart_surgery', 'kidney_disease', 'liver_disease'],
        }),
      );
      expect(result.score).toBe(6);
      expect(result.factors).toContain('heart_surgery');
      expect(result.factors).toContain('kidney_disease');
      expect(result.factors).toContain('liver_disease');
    });
  });

  // ─── Score Boundaries & Level Classification ──────────────────────

  describe('Level Classification', () => {
    it('should classify score 0 as low', () => {
      const result = calculateBRS(baseInput());
      expect(result.score).toBe(0);
      expect(result.level).toBe('low');
    });

    it('should classify score 4 as low', () => {
      // age>60 (2) + current smoker (2) = 4
      const input = baseInput();
      input.profile.age = 65;
      input.profile.smokingStatus = 'current';
      const result = calculateBRS(input);
      expect(result.score).toBe(4);
      expect(result.level).toBe('low');
    });

    it('should classify score 5 as medium', () => {
      // age>60,>75 (2+3) = 5
      const input = baseInput();
      input.profile.age = 80;
      const result = calculateBRS(input);
      expect(result.score).toBe(5);
      expect(result.level).toBe('medium');
    });

    it('should classify score 9 as medium', () => {
      // age>60 (2) + current smoker (2) + uncontrolled BP (3) + controlled diabetes (2) = 9
      const input = baseInput();
      input.profile.age = 65;
      input.profile.smokingStatus = 'current';
      input.profile.bloodPressure = 'uncontrolled';
      input.profile.diabetesType = 'type2';
      input.profile.diabetesControl = 'controlled';
      const result = calculateBRS(input);
      expect(result.score).toBe(9);
      expect(result.level).toBe('medium');
    });

    it('should classify score 10 as high', () => {
      // age>60 (2) + current smoker (2) + known heart (3) + previous heart attack (3) = 10
      const input = baseInput();
      input.profile.age = 65;
      input.profile.smokingStatus = 'current';
      input.profile.heartCondition = 'known';
      input.profile.previousHeartAttack = true;
      const result = calculateBRS(input);
      expect(result.score).toBe(10); // 2+2+3+3 = 10
      expect(result.level).toBe('high');
    });

    it('should classify very high score as high', () => {
      // Stack many factors
      const input = baseInput({
        symptoms: ['heart_surgery', 'kidney_disease', 'liver_disease'],
      });
      input.profile.age = 80;
      input.profile.smokingStatus = 'current';
      input.profile.bloodPressure = 'uncontrolled';
      input.profile.diabetesType = 'type2';
      input.profile.diabetesControl = 'uncontrolled';
      input.profile.heartCondition = 'known';
      input.profile.previousHeartAttack = true;
      const result = calculateBRS(input);
      // 2+3+2+3+2+2+3+3+2+2+2 = 26
      expect(result.score).toBe(26);
      expect(result.level).toBe('high');
    });
  });

  // ─── Factors Array ────────────────────────────────────────────────

  describe('Factors Array', () => {
    it('should return empty factors for healthy young person', () => {
      const result = calculateBRS(baseInput());
      expect(result.factors).toEqual([]);
    });

    it('should list all matching factors', () => {
      const input = baseInput();
      input.profile.age = 65;
      input.profile.smokingStatus = 'current';
      input.profile.heartCondition = 'known';
      const result = calculateBRS(input);
      expect(result.factors).toHaveLength(3);
      expect(result.factors).toContain('age_over_60');
      expect(result.factors).toContain('smoking_current');
      expect(result.factors).toContain('heart_condition_known');
    });
  });

  // ─── Determinism ──────────────────────────────────────────────────

  describe('Determinism', () => {
    it('should produce identical results for identical inputs', () => {
      const input = baseInput();
      input.profile.age = 70;
      input.profile.smokingStatus = 'current';
      input.profile.heartCondition = 'known';

      const result1 = calculateBRS(input);
      const result2 = calculateBRS(input);
      expect(result1).toEqual(result2);
    });
  });
});
