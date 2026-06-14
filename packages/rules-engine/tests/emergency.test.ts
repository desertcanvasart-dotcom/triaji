import { describe, it, expect } from 'vitest';
import { checkEmergency } from '../src/emergency.js';
import { checkEmergencyWithICU } from '../src/emergency-icu.js';
import type { RulesInput, IcuBedInfo } from '../src/types.js';

/** Baseline profile with all-clear values for isolation testing */
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

describe('Emergency Rules', () => {
  // ─── Individual Rule Tests ────────────────────────────────────────

  describe('Cardiac Arrest Signs', () => {
    it('should trigger on cardiac_arrest symptom', () => {
      const result = checkEmergency(
        baseInput({ symptoms: ['cardiac_arrest'] }),
      );
      expect(result.triggered).toBe(true);
      expect(result.ruleName).toBe('cardiac_arrest');
      expect(result.escalationType).toBe('call_ambulance');
      expect(result.priority).toBe(1);
      expect(result.responseAr).toContain('توقف قلب');
    });

    it('should trigger on no_pulse', () => {
      const result = checkEmergency(baseInput({ symptoms: ['no_pulse'] }));
      expect(result.triggered).toBe(true);
      expect(result.ruleName).toBe('cardiac_arrest');
    });

    it('should trigger on not_breathing', () => {
      const result = checkEmergency(
        baseInput({ symptoms: ['not_breathing'] }),
      );
      expect(result.triggered).toBe(true);
      expect(result.ruleName).toBe('cardiac_arrest');
    });

    it('should trigger on unresponsive', () => {
      const result = checkEmergency(
        baseInput({ symptoms: ['unresponsive'] }),
      );
      expect(result.triggered).toBe(true);
      expect(result.ruleName).toBe('cardiac_arrest');
    });
  });

  describe('Stroke Signs', () => {
    it('should trigger on two stroke symptoms (facial_droop + unilateral_weakness)', () => {
      const result = checkEmergency(
        baseInput({
          symptoms: ['facial_droop', 'unilateral_weakness'],
        }),
      );
      expect(result.triggered).toBe(true);
      expect(result.ruleName).toBe('stroke_signs');
      expect(result.escalationType).toBe('call_ambulance');
      expect(result.priority).toBe(2);
      expect(result.responseAr).toContain('جلطة');
    });

    it('should trigger on facial_droop + sudden_onset', () => {
      const result = checkEmergency(
        baseInput({ symptoms: ['facial_droop', 'sudden_onset'] }),
      );
      expect(result.triggered).toBe(true);
      expect(result.ruleName).toBe('stroke_signs');
    });

    it('should trigger on speech_difficulty + sudden_onset', () => {
      const result = checkEmergency(
        baseInput({ symptoms: ['speech_difficulty', 'sudden_onset'] }),
      );
      expect(result.triggered).toBe(true);
      expect(result.ruleName).toBe('stroke_signs');
    });

    it('should trigger on all three stroke signs', () => {
      const result = checkEmergency(
        baseInput({
          symptoms: [
            'facial_droop',
            'unilateral_weakness',
            'speech_difficulty',
          ],
        }),
      );
      expect(result.triggered).toBe(true);
      expect(result.ruleName).toBe('stroke_signs');
    });

    it('should NOT trigger on single stroke symptom without sudden_onset', () => {
      const result = checkEmergency(
        baseInput({ symptoms: ['facial_droop'] }),
      );
      expect(result.triggered).toBe(false);
    });
  });

  describe('Chest Pain with SOB', () => {
    it('should trigger on chest_pain + shortness_of_breath', () => {
      const result = checkEmergency(
        baseInput({
          symptoms: ['chest_pain', 'shortness_of_breath'],
        }),
      );
      expect(result.triggered).toBe(true);
      expect(result.ruleName).toBe('chest_pain_with_sob');
      expect(result.escalationType).toBe('call_ambulance');
      expect(result.priority).toBe(3);
      expect(result.responseAr).toContain('أزمة قلبية');
    });

    it('should NOT trigger on chest_pain alone', () => {
      const result = checkEmergency(
        baseInput({ symptoms: ['chest_pain'] }),
      );
      expect(result.triggered).toBe(false);
    });

    it('should NOT trigger on shortness_of_breath alone', () => {
      const result = checkEmergency(
        baseInput({ symptoms: ['shortness_of_breath'] }),
      );
      expect(result.triggered).toBe(false);
    });
  });

  describe('Severe Allergic Reaction', () => {
    it('should trigger on throat_swelling alone', () => {
      const result = checkEmergency(
        baseInput({ symptoms: ['throat_swelling'] }),
      );
      expect(result.triggered).toBe(true);
      expect(result.ruleName).toBe('severe_allergic_reaction');
      expect(result.escalationType).toBe('call_ambulance');
      expect(result.priority).toBe(4);
      expect(result.responseAr).toContain('حساسية شديدة');
    });

    it('should trigger on rash + shortness_of_breath', () => {
      const result = checkEmergency(
        baseInput({
          symptoms: ['rash', 'shortness_of_breath'],
        }),
      );
      expect(result.triggered).toBe(true);
      expect(result.ruleName).toBe('severe_allergic_reaction');
    });

    it('should NOT trigger on rash alone', () => {
      const result = checkEmergency(baseInput({ symptoms: ['rash'] }));
      expect(result.triggered).toBe(false);
    });
  });

  describe('SOB Preventing Speech', () => {
    it('should trigger on sob_preventing_speech', () => {
      const result = checkEmergency(
        baseInput({ symptoms: ['sob_preventing_speech'] }),
      );
      expect(result.triggered).toBe(true);
      expect(result.ruleName).toBe('sob_preventing_speech');
      expect(result.escalationType).toBe('call_ambulance');
      expect(result.priority).toBe(5);
    });

    it('should trigger on shortness_of_breath + cannot_speak', () => {
      const result = checkEmergency(
        baseInput({
          symptoms: ['shortness_of_breath', 'cannot_speak'],
        }),
      );
      expect(result.triggered).toBe(true);
      expect(result.ruleName).toBe('sob_preventing_speech');
    });
  });

  describe('Febrile Seizure', () => {
    it('should trigger for child with fever + seizure', () => {
      const input = baseInput({
        symptoms: ['fever', 'seizure'],
      });
      input.profile.age = 5;
      const result = checkEmergency(input);
      expect(result.triggered).toBe(true);
      expect(result.ruleName).toBe('febrile_seizure');
      expect(result.escalationType).toBe('call_ambulance');
      expect(result.priority).toBe(6);
      expect(result.responseAr).toContain('تشنج حراري');
    });

    it('should trigger for child with high_fever + convulsion', () => {
      const input = baseInput({
        symptoms: ['high_fever', 'convulsion'],
      });
      input.profile.age = 3;
      const result = checkEmergency(input);
      expect(result.triggered).toBe(true);
      expect(result.ruleName).toBe('febrile_seizure');
    });

    it('should NOT trigger for adult with fever + seizure', () => {
      const input = baseInput({
        symptoms: ['fever', 'seizure'],
      });
      input.profile.age = 30;
      const result = checkEmergency(input);
      expect(result.triggered).toBe(false);
    });

    it('should NOT trigger for child with fever but no seizure', () => {
      const input = baseInput({ symptoms: ['fever'] });
      input.profile.age = 5;
      const result = checkEmergency(input);
      expect(result.triggered).toBe(false);
    });
  });

  describe('Infant High Fever', () => {
    it('should trigger for infant < 3 months with fever', () => {
      const input = baseInput({ symptoms: ['fever'] });
      input.profile.age = 0.1; // ~1 month
      const result = checkEmergency(input);
      expect(result.triggered).toBe(true);
      expect(result.ruleName).toBe('infant_high_fever');
      expect(result.escalationType).toBe('emergency_room');
      expect(result.priority).toBe(7);
      expect(result.responseAr).toContain('رضيع');
    });

    it('should trigger for infant < 3 months with high_fever', () => {
      const input = baseInput({ symptoms: ['high_fever'] });
      input.profile.age = 0.2; // ~2.4 months
      const result = checkEmergency(input);
      expect(result.triggered).toBe(true);
      expect(result.ruleName).toBe('infant_high_fever');
    });

    it('should NOT trigger for 6-month-old with fever', () => {
      const input = baseInput({ symptoms: ['fever'] });
      input.profile.age = 0.5;
      const result = checkEmergency(input);
      expect(result.triggered).toBe(false);
    });

    it('should NOT trigger for infant without fever', () => {
      const input = baseInput({ symptoms: ['cough'] });
      input.profile.age = 0.1;
      const result = checkEmergency(input);
      expect(result.triggered).toBe(false);
    });
  });

  describe('Loss of Consciousness', () => {
    it('should trigger on loss_of_consciousness', () => {
      const result = checkEmergency(
        baseInput({ symptoms: ['loss_of_consciousness'] }),
      );
      expect(result.triggered).toBe(true);
      expect(result.ruleName).toBe('loss_of_consciousness');
      expect(result.escalationType).toBe('emergency_room');
      expect(result.priority).toBe(8);
      expect(result.responseAr).toContain('فقدان وعي');
    });

    it('should trigger on syncope', () => {
      const result = checkEmergency(baseInput({ symptoms: ['syncope'] }));
      expect(result.triggered).toBe(true);
      expect(result.ruleName).toBe('loss_of_consciousness');
    });

    it('should trigger on fainting', () => {
      const result = checkEmergency(
        baseInput({ symptoms: ['fainting'] }),
      );
      expect(result.triggered).toBe(true);
      expect(result.ruleName).toBe('loss_of_consciousness');
    });

    it('should trigger on passed_out', () => {
      const result = checkEmergency(
        baseInput({ symptoms: ['passed_out'] }),
      );
      expect(result.triggered).toBe(true);
      expect(result.ruleName).toBe('loss_of_consciousness');
    });
  });

  describe('Meningism Signs', () => {
    it('should trigger on fever + neck_stiffness + photophobia', () => {
      const result = checkEmergency(
        baseInput({
          symptoms: ['fever', 'neck_stiffness', 'photophobia'],
        }),
      );
      expect(result.triggered).toBe(true);
      expect(result.ruleName).toBe('meningism_signs');
      expect(result.escalationType).toBe('emergency_room');
      expect(result.priority).toBe(9);
      expect(result.responseAr).toContain('التهاب سحائي');
    });

    it('should trigger on high_fever + neck_stiffness + photophobia', () => {
      const result = checkEmergency(
        baseInput({
          symptoms: ['high_fever', 'neck_stiffness', 'photophobia'],
        }),
      );
      expect(result.triggered).toBe(true);
      expect(result.ruleName).toBe('meningism_signs');
    });

    it('should NOT trigger with only two of three meningism symptoms', () => {
      const result = checkEmergency(
        baseInput({
          symptoms: ['fever', 'neck_stiffness'],
        }),
      );
      expect(result.triggered).toBe(false);
    });

    it('should NOT trigger without fever', () => {
      const result = checkEmergency(
        baseInput({
          symptoms: ['neck_stiffness', 'photophobia'],
        }),
      );
      expect(result.triggered).toBe(false);
    });
  });

  describe('Severe Bleeding', () => {
    it('should trigger on severe_bleeding', () => {
      const result = checkEmergency(
        baseInput({ symptoms: ['severe_bleeding'] }),
      );
      expect(result.triggered).toBe(true);
      expect(result.ruleName).toBe('severe_bleeding');
      expect(result.escalationType).toBe('emergency_room');
      expect(result.priority).toBe(10);
      expect(result.responseAr).toContain('نزيف');
    });

    it('should trigger on hemorrhage', () => {
      const result = checkEmergency(
        baseInput({ symptoms: ['hemorrhage'] }),
      );
      expect(result.triggered).toBe(true);
      expect(result.ruleName).toBe('severe_bleeding');
    });

    it('should trigger on uncontrolled_bleeding', () => {
      const result = checkEmergency(
        baseInput({ symptoms: ['uncontrolled_bleeding'] }),
      );
      expect(result.triggered).toBe(true);
      expect(result.ruleName).toBe('severe_bleeding');
    });
  });

  describe('Thunderclap Headache', () => {
    it('should trigger on thunderclap_headache', () => {
      const result = checkEmergency(
        baseInput({ symptoms: ['thunderclap_headache'] }),
      );
      expect(result.triggered).toBe(true);
      expect(result.ruleName).toBe('thunderclap_headache');
      expect(result.escalationType).toBe('emergency_room');
      expect(result.priority).toBe(11);
      expect(result.responseAr).toContain('صداع');
    });

    it('should trigger on worst_headache + sudden_headache', () => {
      const result = checkEmergency(
        baseInput({
          symptoms: ['worst_headache', 'sudden_headache'],
        }),
      );
      expect(result.triggered).toBe(true);
      expect(result.ruleName).toBe('thunderclap_headache');
    });

    it('should trigger on worst_headache + sudden_onset', () => {
      const result = checkEmergency(
        baseInput({
          symptoms: ['worst_headache', 'sudden_onset'],
        }),
      );
      expect(result.triggered).toBe(true);
      expect(result.ruleName).toBe('thunderclap_headache');
    });

    it('should NOT trigger on worst_headache alone', () => {
      const result = checkEmergency(
        baseInput({ symptoms: ['worst_headache'] }),
      );
      expect(result.triggered).toBe(false);
    });

    it('should NOT trigger on sudden_headache alone', () => {
      const result = checkEmergency(
        baseInput({ symptoms: ['sudden_headache'] }),
      );
      expect(result.triggered).toBe(false);
    });
  });

  describe('Diabetic Emergency', () => {
    it('should trigger for diabetic (type1) with low_blood_sugar', () => {
      const input = baseInput({ symptoms: ['low_blood_sugar'] });
      input.profile.diabetesType = 'type1';
      const result = checkEmergency(input);
      expect(result.triggered).toBe(true);
      expect(result.ruleName).toBe('diabetic_emergency');
      expect(result.escalationType).toBe('emergency_room');
      expect(result.priority).toBe(12);
      expect(result.responseAr).toContain('السكر');
    });

    it('should trigger for diabetic (type2) with hypoglycemia', () => {
      const input = baseInput({ symptoms: ['hypoglycemia'] });
      input.profile.diabetesType = 'type2';
      const result = checkEmergency(input);
      expect(result.triggered).toBe(true);
      expect(result.ruleName).toBe('diabetic_emergency');
    });

    it('should trigger for diabetic with tremors', () => {
      const input = baseInput({ symptoms: ['tremors'] });
      input.profile.diabetesType = 'type2';
      const result = checkEmergency(input);
      expect(result.triggered).toBe(true);
      expect(result.ruleName).toBe('diabetic_emergency');
    });

    it('should trigger for diabetic with confusion', () => {
      const input = baseInput({ symptoms: ['confusion'] });
      input.profile.diabetesType = 'type1';
      const result = checkEmergency(input);
      expect(result.triggered).toBe(true);
      expect(result.ruleName).toBe('diabetic_emergency');
    });

    it('should trigger for diabetic with sweating_with_shaking', () => {
      const input = baseInput({
        symptoms: ['sweating_with_shaking'],
      });
      input.profile.diabetesType = 'type2';
      const result = checkEmergency(input);
      expect(result.triggered).toBe(true);
      expect(result.ruleName).toBe('diabetic_emergency');
    });

    it('should NOT trigger for non-diabetic with low_blood_sugar', () => {
      const result = checkEmergency(
        baseInput({ symptoms: ['low_blood_sugar'] }),
      );
      expect(result.triggered).toBe(false);
    });

    it('should NOT trigger for diabetic without sugar symptoms', () => {
      const input = baseInput({ symptoms: ['headache'] });
      input.profile.diabetesType = 'type2';
      const result = checkEmergency(input);
      expect(result.triggered).toBe(false);
    });
  });

  // ─── No False Positives ───────────────────────────────────────────

  describe('No False Positives', () => {
    it('should NOT trigger on empty symptoms', () => {
      const result = checkEmergency(baseInput());
      expect(result.triggered).toBe(false);
      expect(result.ruleName).toBeNull();
      expect(result.escalationType).toBeNull();
      expect(result.responseAr).toBeNull();
      expect(result.priority).toBeNull();
    });

    it('should NOT trigger on non-emergency symptoms', () => {
      const result = checkEmergency(
        baseInput({
          symptoms: ['headache', 'cough', 'runny_nose', 'sore_throat'],
        }),
      );
      expect(result.triggered).toBe(false);
    });

    it('should NOT trigger on mild fever alone', () => {
      const result = checkEmergency(baseInput({ symptoms: ['fever'] }));
      expect(result.triggered).toBe(false);
    });

    it('should NOT trigger on chest_pain without SOB', () => {
      const result = checkEmergency(
        baseInput({ symptoms: ['chest_pain'] }),
      );
      expect(result.triggered).toBe(false);
    });

    it('should NOT trigger on rash without SOB or throat_swelling', () => {
      const result = checkEmergency(baseInput({ symptoms: ['rash'] }));
      expect(result.triggered).toBe(false);
    });
  });

  // ─── Priority Ordering ───────────────────────────────────────────

  describe('Priority Ordering', () => {
    it('cardiac arrest should win over chest_pain_with_sob', () => {
      const result = checkEmergency(
        baseInput({
          symptoms: [
            'cardiac_arrest',
            'chest_pain',
            'shortness_of_breath',
          ],
        }),
      );
      expect(result.ruleName).toBe('cardiac_arrest');
      expect(result.priority).toBe(1);
    });

    it('stroke should win over chest_pain_with_sob when both match', () => {
      const result = checkEmergency(
        baseInput({
          symptoms: [
            'facial_droop',
            'unilateral_weakness',
            'chest_pain',
            'shortness_of_breath',
          ],
        }),
      );
      expect(result.ruleName).toBe('stroke_signs');
      expect(result.priority).toBe(2);
    });

    it('cardiac arrest (priority 1) should win over stroke (priority 2)', () => {
      const result = checkEmergency(
        baseInput({
          symptoms: [
            'cardiac_arrest',
            'facial_droop',
            'unilateral_weakness',
          ],
        }),
      );
      expect(result.ruleName).toBe('cardiac_arrest');
      expect(result.priority).toBe(1);
    });

    it('chest_pain_with_sob should win over loss_of_consciousness', () => {
      const result = checkEmergency(
        baseInput({
          symptoms: [
            'chest_pain',
            'shortness_of_breath',
            'loss_of_consciousness',
          ],
        }),
      );
      expect(result.ruleName).toBe('chest_pain_with_sob');
      expect(result.priority).toBe(3);
    });

    it('severe allergic reaction should win over loss_of_consciousness', () => {
      const result = checkEmergency(
        baseInput({
          symptoms: ['throat_swelling', 'loss_of_consciousness'],
        }),
      );
      expect(result.ruleName).toBe('severe_allergic_reaction');
      expect(result.priority).toBe(4);
    });
  });

  // ─── Edge Cases ───────────────────────────────────────────────────

  describe('Edge Cases', () => {
    it('should handle null age for febrile seizure (does not trigger)', () => {
      const input = baseInput({ symptoms: ['fever', 'seizure'] });
      input.profile.age = null;
      const result = checkEmergency(input);
      expect(result.triggered).toBe(false);
    });

    it('should handle null age for infant high fever (does not trigger)', () => {
      const input = baseInput({ symptoms: ['fever'] });
      input.profile.age = null;
      const result = checkEmergency(input);
      expect(result.triggered).toBe(false);
    });

    it('should handle null biological sex', () => {
      const input = baseInput({
        symptoms: ['chest_pain', 'shortness_of_breath'],
      });
      input.profile.biologicalSex = null;
      const result = checkEmergency(input);
      expect(result.triggered).toBe(true);
      expect(result.ruleName).toBe('chest_pain_with_sob');
    });

    it('should handle empty symptoms array', () => {
      const result = checkEmergency(baseInput({ symptoms: [] }));
      expect(result.triggered).toBe(false);
    });

    it('should produce Arabic response on every triggered rule', () => {
      // Test a sample of rules to ensure Arabic responses exist
      const testCases: { symptoms: string[]; overrides?: Partial<RulesInput> }[] = [
        { symptoms: ['cardiac_arrest'] },
        { symptoms: ['facial_droop', 'unilateral_weakness'] },
        { symptoms: ['chest_pain', 'shortness_of_breath'] },
        { symptoms: ['throat_swelling'] },
        { symptoms: ['loss_of_consciousness'] },
        { symptoms: ['severe_bleeding'] },
      ];

      for (const tc of testCases) {
        const result = checkEmergency(baseInput({ symptoms: tc.symptoms }));
        expect(result.triggered).toBe(true);
        expect(result.responseAr).not.toBeNull();
        expect(result.responseAr!.length).toBeGreaterThan(10);
      }
    });

    it('should handle Arabic rawText context without affecting rule evaluation', () => {
      const result = checkEmergency(
        baseInput({
          symptoms: ['chest_pain', 'shortness_of_breath'],
          rawText: 'عندي ألم في صدري ومش قادر اتنفس',
        }),
      );
      expect(result.triggered).toBe(true);
      expect(result.ruleName).toBe('chest_pain_with_sob');
    });

    it('should handle Arabic rawText with no matching symptoms', () => {
      const result = checkEmergency(
        baseInput({
          symptoms: [],
          rawText: 'عندي صداع خفيف من إمبارح',
        }),
      );
      expect(result.triggered).toBe(false);
    });
  });

  // ─── Determinism ──────────────────────────────────────────────────

  describe('Determinism', () => {
    it('should return identical results for identical inputs', () => {
      const input = baseInput({
        symptoms: ['chest_pain', 'shortness_of_breath', 'loss_of_consciousness'],
      });

      const result1 = checkEmergency(input);
      const result2 = checkEmergency(input);

      expect(result1).toEqual(result2);
    });

    it('should return identical results across 100 evaluations', () => {
      const input = baseInput({
        symptoms: ['facial_droop', 'unilateral_weakness', 'sudden_onset'],
      });

      const baseline = checkEmergency(input);
      for (let i = 0; i < 100; i++) {
        expect(checkEmergency(input)).toEqual(baseline);
      }
    });
  });
});

describe('checkEmergencyWithICU', () => {
  const mockIcuBeds: IcuBedInfo[] = [
    { hospitalNameAr: 'مستشفى القاهرة', hospitalNameEn: 'Cairo Hospital', unitType: 'general_icu', availableBeds: 2, distanceKm: 3.2, phoneDirect: '02-23456789' },
    { hospitalNameAr: 'مستشفى النيل', hospitalNameEn: 'Nile Hospital', unitType: 'cardiac_icu', availableBeds: 1, distanceKm: 5.7, phoneDirect: '02-34567890' },
  ];

  const mockFindBeds = async () => mockIcuBeds;

  it('returns base emergency result when no location provided', async () => {
    const input = baseInput({ symptoms: ['cardiac_arrest'] });
    const result = await checkEmergencyWithICU(input, undefined, mockFindBeds);
    expect(result.triggered).toBe(true);
    expect(result.nearbyIcuBeds).toBeUndefined();
  });

  it('includes nearby ICU beds when emergency triggered with location', async () => {
    const input = baseInput({ symptoms: ['cardiac_arrest'] });
    const result = await checkEmergencyWithICU(input, { lat: 30.0, lng: 31.2 }, mockFindBeds);
    expect(result.triggered).toBe(true);
    expect(result.nearbyIcuBeds).toHaveLength(2);
    expect(result.nearbyIcuBeds![0].hospitalNameAr).toBe('مستشفى القاهرة');
  });

  it('returns max 3 ICU beds', async () => {
    const manyBeds = [...mockIcuBeds, ...mockIcuBeds, ...mockIcuBeds]; // 6 beds
    const result = await checkEmergencyWithICU(
      baseInput({ symptoms: ['cardiac_arrest'] }),
      { lat: 30.0, lng: 31.2 },
      async () => manyBeds
    );
    expect(result.nearbyIcuBeds).toHaveLength(3);
  });

  it('returns base result when no emergency triggered', async () => {
    const input = baseInput({ symptoms: ['headache'] });
    const result = await checkEmergencyWithICU(input, { lat: 30.0, lng: 31.2 }, mockFindBeds);
    expect(result.triggered).toBe(false);
    expect(result.nearbyIcuBeds).toBeUndefined();
  });

  it('returns base result when ICU query fails (fail-safe)', async () => {
    const failingFn = async () => { throw new Error('Network error'); };
    const input = baseInput({ symptoms: ['cardiac_arrest'] });
    const result = await checkEmergencyWithICU(input, { lat: 30.0, lng: 31.2 }, failingFn);
    expect(result.triggered).toBe(true);
    expect(result.nearbyIcuBeds).toBeUndefined();
  });
});
