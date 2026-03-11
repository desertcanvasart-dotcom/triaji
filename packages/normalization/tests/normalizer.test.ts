import { describe, it, expect } from 'vitest';
import { normalize } from '../src/normalizer.js';

describe('normalize', () => {
  describe('headache variants', () => {
    it('maps "دماغي واجعاني" to headache', () => {
      const result = normalize('دماغي واجعاني');
      expect(result.symptoms).toContain('headache');
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
    });

    it('maps "صداع" to headache', () => {
      const result = normalize('صداع');
      expect(result.symptoms).toContain('headache');
    });

    it('maps "راسي بتوجعني" to headache', () => {
      const result = normalize('راسي بتوجعني');
      expect(result.symptoms).toContain('headache');
    });

    it('maps "دماغي هتنفجر" to worst_headache', () => {
      const result = normalize('دماغي هتنفجر');
      expect(result.symptoms).toContain('worst_headache');
      expect(result.symptoms).toContain('sudden_headache');
    });

    it('maps "دوخة" to dizziness', () => {
      const result = normalize('دوخة');
      expect(result.symptoms).toContain('dizziness');
    });
  });

  describe('chest pain', () => {
    it('maps "صدري بيوجعني" to chest_pain', () => {
      const result = normalize('صدري بيوجعني');
      expect(result.symptoms).toContain('chest_pain');
    });

    it('maps "حاسس بضغط على صدري" to chest_pain and chest_pressure', () => {
      const result = normalize('حاسس بضغط على صدري');
      expect(result.symptoms).toContain('chest_pain');
      expect(result.symptoms).toContain('chest_pressure');
    });

    it('maps "قلبي بيوجعني" to chest_pain and cardiac_pain', () => {
      const result = normalize('قلبي بيوجعني');
      expect(result.symptoms).toContain('chest_pain');
      expect(result.symptoms).toContain('cardiac_pain');
    });
  });

  describe('breathing', () => {
    it('maps "مش قادر اتنفس" to shortness_of_breath', () => {
      const result = normalize('مش قادر اتنفس');
      expect(result.symptoms).toContain('shortness_of_breath');
    });

    it('maps "نفسي مخنوق" to shortness_of_breath', () => {
      const result = normalize('نفسي مخنوق');
      expect(result.symptoms).toContain('shortness_of_breath');
    });

    it('maps "كتمة" to shortness_of_breath', () => {
      const result = normalize('كتمة');
      expect(result.symptoms).toContain('shortness_of_breath');
    });
  });

  describe('abdominal', () => {
    it('maps "بطني واجعاني" to abdominal_pain', () => {
      const result = normalize('بطني واجعاني');
      expect(result.symptoms).toContain('abdominal_pain');
    });

    it('maps "مغص شديد" to abdominal_pain', () => {
      const result = normalize('مغص شديد');
      expect(result.symptoms).toContain('abdominal_pain');
    });

    it('maps "حموضة" to heartburn', () => {
      const result = normalize('حموضة');
      expect(result.symptoms).toContain('heartburn');
    });
  });

  describe('fever', () => {
    it('maps "حرارتي عالية" to fever and high_fever', () => {
      const result = normalize('حرارتي عالية');
      expect(result.symptoms).toContain('fever');
      expect(result.symptoms).toContain('high_fever');
    });

    it('maps "جسمي ولعان" to fever and body_aches', () => {
      const result = normalize('جسمي ولعان');
      expect(result.symptoms).toContain('fever');
      expect(result.symptoms).toContain('body_aches');
    });

    it('maps "بسخن وببرد" to fever and chills', () => {
      const result = normalize('بسخن وببرد');
      expect(result.symptoms).toContain('fever');
      expect(result.symptoms).toContain('chills');
    });
  });

  describe('dizziness variants', () => {
    it('maps "الدنيا بتلف" to dizziness and vertigo', () => {
      const result = normalize('الدنيا بتلف');
      expect(result.symptoms).toContain('dizziness');
      expect(result.symptoms).toContain('vertigo');
    });

    it('maps "دايخ" to dizziness', () => {
      const result = normalize('دايخ');
      expect(result.symptoms).toContain('dizziness');
    });
  });

  describe('back and neck pain', () => {
    it('maps "ضهري واجعني" to back_pain', () => {
      const result = normalize('ضهري واجعني');
      expect(result.symptoms).toContain('back_pain');
    });

    it('maps "رقبتي واجعاني" to neck_pain', () => {
      const result = normalize('رقبتي واجعاني');
      expect(result.symptoms).toContain('neck_pain');
    });
  });

  describe('cough and throat', () => {
    it('maps "كحة" to cough', () => {
      const result = normalize('كحة');
      expect(result.symptoms).toContain('cough');
    });

    it('maps "بكح دم" to coughing_blood', () => {
      const result = normalize('بكح دم');
      expect(result.symptoms).toContain('coughing_blood');
    });

    it('maps "زوري واجعني" to sore_throat', () => {
      const result = normalize('زوري واجعني');
      expect(result.symptoms).toContain('sore_throat');
    });

    it('maps "مش قادر ابلع" to difficulty_swallowing', () => {
      const result = normalize('مش قادر ابلع');
      expect(result.symptoms).toContain('difficulty_swallowing');
    });
  });

  describe('rash and skin', () => {
    it('maps "طفح جلدي" to rash', () => {
      const result = normalize('طفح جلدي');
      expect(result.symptoms).toContain('rash');
    });

    it('maps "بشرتي بتحكني" to itching', () => {
      const result = normalize('بشرتي بتحكني');
      expect(result.symptoms).toContain('itching');
    });

    it('maps "ورم" to swelling', () => {
      const result = normalize('ورم');
      expect(result.symptoms).toContain('swelling');
    });
  });

  describe('urinary', () => {
    it('maps "حرقان في البول" to burning_urination', () => {
      const result = normalize('حرقان في البول');
      expect(result.symptoms).toContain('burning_urination');
    });

    it('maps "بتبول دم" to blood_in_urine', () => {
      const result = normalize('بتبول دم');
      expect(result.symptoms).toContain('blood_in_urine');
    });
  });

  describe('stroke signs', () => {
    it('maps "وشي ملخبط" to facial_droop', () => {
      const result = normalize('وشي ملخبط');
      expect(result.symptoms).toContain('facial_droop');
    });

    it('maps "مش قادر اتكلم كويس" to speech_difficulty', () => {
      const result = normalize('مش قادر اتكلم كويس');
      expect(result.symptoms).toContain('speech_difficulty');
    });

    it('maps "ايدي مش بتتحرك" to unilateral_weakness', () => {
      const result = normalize('ايدي مش بتتحرك');
      expect(result.symptoms).toContain('unilateral_weakness');
    });
  });

  describe('consciousness', () => {
    it('maps "اغمى عليا" to loss_of_consciousness', () => {
      const result = normalize('اغمى عليا');
      expect(result.symptoms).toContain('loss_of_consciousness');
    });
  });

  describe('allergic emergency', () => {
    it('maps "حلقي مقفل" to throat_swelling', () => {
      const result = normalize('حلقي مقفل');
      expect(result.symptoms).toContain('throat_swelling');
    });

    it('maps "مش قادر اتنفس وعندي طفح" to anaphylaxis', () => {
      const result = normalize('مش قادر اتنفس وعندي طفح');
      expect(result.symptoms).toContain('anaphylaxis');
      expect(result.symptoms).toContain('shortness_of_breath');
      expect(result.symptoms).toContain('rash');
    });
  });

  describe('seizure', () => {
    it('maps "تشنج" to seizure', () => {
      const result = normalize('تشنج');
      expect(result.symptoms).toContain('seizure');
    });
  });

  describe('diabetic', () => {
    it('maps "سكري نازل" to low_blood_sugar', () => {
      const result = normalize('سكري نازل');
      expect(result.symptoms).toContain('low_blood_sugar');
    });
  });

  describe('confidence scores', () => {
    it('returns high confidence for known phrases', () => {
      const result = normalize('صداع');
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
    });

    it('returns low confidence for unknown input', () => {
      const result = normalize('كلام مش مفهوم خالص');
      expect(result.confidence).toBeLessThanOrEqual(0.3);
    });

    it('returns 0.0 confidence for empty input', () => {
      const result = normalize('');
      expect(result.confidence).toBe(0.0);
    });

    it('returns higher confidence for multiple symptom matches', () => {
      const singleResult = normalize('صداع');
      const multiResult = normalize('صداع وكحة وحرارتي عالية');
      expect(multiResult.confidence).toBeGreaterThan(singleResult.confidence);
    });
  });

  describe('multi-symptom extraction', () => {
    it('extracts multiple symptoms from compound complaint', () => {
      const result = normalize('صداع وصدري بيوجعني ودايخ');
      expect(result.symptoms).toContain('headache');
      expect(result.symptoms).toContain('chest_pain');
      expect(result.symptoms).toContain('dizziness');
      expect(result.symptoms.length).toBeGreaterThanOrEqual(3);
    });

    it('extracts fever and cough together', () => {
      const result = normalize('سخن وكحة شديدة');
      expect(result.symptoms).toContain('fever');
      expect(result.symptoms).toContain('cough');
    });

    it('extracts stroke signs together', () => {
      const result = normalize('وشي ملخبط ومش قادر اتكلم كويس');
      expect(result.symptoms).toContain('facial_droop');
      expect(result.symptoms).toContain('speech_difficulty');
    });
  });

  describe('unknown input', () => {
    it('returns empty symptoms for unrecognized text', () => {
      const result = normalize('أنا رايح السوبر ماركت');
      expect(result.symptoms).toHaveLength(0);
    });

    it('returns low confidence for unrecognized text', () => {
      const result = normalize('الجو حلو النهارده');
      expect(result.confidence).toBeLessThanOrEqual(0.3);
    });

    it('preserves original text', () => {
      const input = 'أي حاجة تاني';
      const result = normalize(input);
      expect(result.originalText).toBe(input);
    });
  });

  describe('body part extraction', () => {
    it('extracts head from headache complaint', () => {
      const result = normalize('دماغي واجعاني');
      expect(result.bodyParts).toContain('head');
    });

    it('extracts chest from chest pain', () => {
      const result = normalize('صدري بيوجعني');
      expect(result.bodyParts).toContain('chest');
    });

    it('extracts back from back pain', () => {
      const result = normalize('ضهري واجعني');
      expect(result.bodyParts).toContain('back');
    });

    it('extracts neck from neck complaint', () => {
      const result = normalize('رقبتي واجعاني');
      expect(result.bodyParts).toContain('neck');
    });

    it('extracts throat body part', () => {
      const result = normalize('زوري واجعني');
      expect(result.bodyParts).toContain('throat');
    });

    it('extracts multiple body parts', () => {
      const result = normalize('ضهري ورقبتي واجعاني');
      expect(result.bodyParts).toContain('back');
      expect(result.bodyParts).toContain('neck');
    });

    it('extracts heart from cardiac complaint', () => {
      const result = normalize('قلبي بيوجعني');
      expect(result.bodyParts).toContain('heart');
    });
  });

  describe('severity extraction', () => {
    it('detects severe severity', () => {
      const result = normalize('مغص شديد');
      expect(result.severity).toBe('severe');
    });

    it('detects mild severity', () => {
      const result = normalize('صداع خفيف');
      expect(result.severity).toBe('mild');
    });

    it('detects moderate severity', () => {
      const result = normalize('وجع متوسط في بطني');
      expect(result.severity).toBe('moderate');
    });

    it('detects worst_ever severity', () => {
      const result = normalize('أسوأ وجع في حياتي');
      expect(result.severity).toBe('worst_ever');
    });

    it('returns null severity when none detected', () => {
      const result = normalize('صداع');
      expect(result.severity).toBeNull();
    });

    it('detects "جامد" as severe', () => {
      const result = normalize('وجع جامد في صدري');
      expect(result.severity).toBe('severe');
    });
  });

  describe('diacritics stripping', () => {
    it('normalizes text with diacritics', () => {
      const result = normalize('صُدَاع');
      expect(result.symptoms).toContain('headache');
    });
  });

  describe('edge cases', () => {
    it('handles whitespace-only input', () => {
      const result = normalize('   ');
      expect(result.symptoms).toHaveLength(0);
      expect(result.confidence).toBe(0.0);
    });

    it('handles input with extra whitespace', () => {
      const result = normalize('  صداع  ');
      expect(result.symptoms).toContain('headache');
    });
  });
});
