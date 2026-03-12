import type { RulesInput, EmergencyResult } from './types';

interface EmergencyRule {
  name: string;
  priority: number;
  escalationType: 'emergency_room' | 'call_ambulance';
  responseAr: string;
  check: (input: RulesInput) => boolean;
}

function hasSymptom(symptoms: string[], code: string): boolean {
  return symptoms.includes(code);
}

function hasAny(symptoms: string[], codes: string[]): boolean {
  return codes.some((code) => symptoms.includes(code));
}

function hasAll(symptoms: string[], codes: string[]): boolean {
  return codes.every((code) => symptoms.includes(code));
}

/**
 * Emergency rules ordered by priority (lower number = higher priority).
 * All rules are checked and the highest-priority match wins.
 */
const EMERGENCY_RULES: EmergencyRule[] = [
  // Priority 1: Cardiac arrest signs
  {
    name: 'cardiac_arrest',
    priority: 1,
    escalationType: 'call_ambulance',
    responseAr:
      'اتصل بالإسعاف فوراً! في علامات توقف قلب. ابدأ إنعاش قلبي رئوي لو تعرف، ومتسيبش المريض لوحده.',
    check: (input) =>
      hasAny(input.symptoms, [
        'cardiac_arrest',
        'no_pulse',
        'not_breathing',
        'unresponsive',
      ]),
  },

  // Priority 2: Stroke signs
  {
    name: 'stroke_signs',
    priority: 2,
    escalationType: 'call_ambulance',
    responseAr:
      'اتصل بالإسعاف فوراً! في علامات جلطة في المخ. كل دقيقة بتفرق. متدّيش المريض أي أكل أو شرب.',
    check: (input) => {
      const strokeSymptoms = [
        'facial_droop',
        'unilateral_weakness',
        'speech_difficulty',
      ];
      const hasSuddenOnset = hasSymptom(input.symptoms, 'sudden_onset');
      const hasStrokeSign = hasAny(input.symptoms, strokeSymptoms);
      // Two or more stroke signs, or one stroke sign with sudden onset
      const strokeSignCount = strokeSymptoms.filter((s) =>
        input.symptoms.includes(s),
      ).length;
      return strokeSignCount >= 2 || (hasStrokeSign && hasSuddenOnset);
    },
  },

  // Priority 3: Chest pain + shortness of breath (possible heart attack)
  {
    name: 'chest_pain_with_sob',
    priority: 3,
    escalationType: 'call_ambulance',
    responseAr:
      'اتصل بالإسعاف فوراً! ألم في الصدر مع صعوبة في التنفس ممكن يكون أزمة قلبية. المريض يقعد ويستريح ومياخدش أي مجهود.',
    check: (input) =>
      hasSymptom(input.symptoms, 'chest_pain') &&
      hasSymptom(input.symptoms, 'shortness_of_breath'),
  },

  // Priority 4: Severe allergic reaction (anaphylaxis)
  {
    name: 'severe_allergic_reaction',
    priority: 4,
    escalationType: 'call_ambulance',
    responseAr:
      'اتصل بالإسعاف فوراً! في علامات حساسية شديدة. لو في حقنة أدرينالين (EpiPen) استخدمها فوراً.',
    check: (input) => {
      const hasThroatSwelling = hasSymptom(input.symptoms, 'throat_swelling');
      const hasDiffuseRash = hasSymptom(input.symptoms, 'rash');
      const hasSob = hasSymptom(input.symptoms, 'shortness_of_breath');
      return hasThroatSwelling || (hasDiffuseRash && hasSob);
    },
  },

  // Priority 5: SOB preventing speech
  {
    name: 'sob_preventing_speech',
    priority: 5,
    escalationType: 'call_ambulance',
    responseAr:
      'اتصل بالإسعاف فوراً! صعوبة التنفس شديدة لدرجة مش قادر يتكلم. المريض يقعد في وضع مستقيم.',
    check: (input) =>
      hasSymptom(input.symptoms, 'sob_preventing_speech') ||
      (hasSymptom(input.symptoms, 'shortness_of_breath') &&
        hasSymptom(input.symptoms, 'cannot_speak')),
  },

  // Priority 6: Febrile seizure (child + fever + convulsion)
  {
    name: 'febrile_seizure',
    priority: 6,
    escalationType: 'call_ambulance',
    responseAr:
      'اتصل بالإسعاف فوراً! الطفل عنده تشنج حراري. حط الطفل على جنبه ومتحطش أي حاجة في بقه. لاحظ الوقت.',
    check: (input) => {
      const isChild =
        input.profile.age !== null && input.profile.age < 12;
      const hasFever = hasSymptom(input.symptoms, 'fever') ||
        hasSymptom(input.symptoms, 'high_fever');
      const hasSeizure = hasSymptom(input.symptoms, 'seizure') ||
        hasSymptom(input.symptoms, 'convulsion');
      return isChild && hasFever && hasSeizure;
    },
  },

  // Priority 7: Infant high fever (age < 3 months + any fever)
  {
    name: 'infant_high_fever',
    priority: 7,
    escalationType: 'emergency_room',
    responseAr:
      'روح أقرب طوارئ فوراً! رضيع أقل من ٣ شهور وعنده سخونية. ده محتاج فحص فوري.',
    check: (input) => {
      const isInfant =
        input.profile.age !== null && input.profile.age < 0.25; // < 3 months ≈ 0.25 years
      const hasFever = hasAny(input.symptoms, ['fever', 'high_fever']);
      return isInfant && hasFever;
    },
  },

  // Priority 8: Loss of consciousness / syncope
  {
    name: 'loss_of_consciousness',
    priority: 8,
    escalationType: 'emergency_room',
    responseAr:
      'روح أقرب طوارئ فوراً! في فقدان وعي. حط المريض في وضع الإفاقة على جنبه وتأكد إنه بيتنفس.',
    check: (input) =>
      hasAny(input.symptoms, [
        'loss_of_consciousness',
        'syncope',
        'fainting',
        'passed_out',
      ]),
  },

  // Priority 9: Meningism signs (fever + neck stiffness + photophobia)
  {
    name: 'meningism_signs',
    priority: 9,
    escalationType: 'emergency_room',
    responseAr:
      'روح أقرب طوارئ فوراً! في علامات التهاب سحائي. سخونية مع تيبس في الرقبة وحساسية من النور.',
    check: (input) =>
      hasAny(input.symptoms, ['fever', 'high_fever']) &&
      hasSymptom(input.symptoms, 'neck_stiffness') &&
      hasSymptom(input.symptoms, 'photophobia'),
  },

  // Priority 10: Active severe bleeding
  {
    name: 'severe_bleeding',
    priority: 10,
    escalationType: 'emergency_room',
    responseAr:
      'روح أقرب طوارئ فوراً! في نزيف شديد. اضغط على مكان النزيف بقماشة نضيفة ومترفعش الضغط.',
    check: (input) =>
      hasAny(input.symptoms, [
        'severe_bleeding',
        'hemorrhage',
        'uncontrolled_bleeding',
      ]),
  },

  // Priority 11: Thunderclap headache (worst-ever sudden-onset headache)
  {
    name: 'thunderclap_headache',
    priority: 11,
    escalationType: 'emergency_room',
    responseAr:
      'روح أقرب طوارئ فوراً! صداع مفاجئ وشديد جداً ممكن يكون نزيف في المخ. محتاج أشعة فوراً.',
    check: (input) => {
      const hasWorstHeadache = hasSymptom(input.symptoms, 'worst_headache');
      const hasSuddenHeadache = hasSymptom(input.symptoms, 'sudden_headache');
      const hasThunderclapHeadache = hasSymptom(
        input.symptoms,
        'thunderclap_headache',
      );
      return (
        hasThunderclapHeadache ||
        (hasWorstHeadache && hasSuddenHeadache) ||
        (hasWorstHeadache && hasSymptom(input.symptoms, 'sudden_onset'))
      );
    },
  },

  // Priority 12: Diabetic emergency (very low blood sugar + diabetes)
  {
    name: 'diabetic_emergency',
    priority: 12,
    escalationType: 'emergency_room',
    responseAr:
      'روح أقرب طوارئ فوراً! في أعراض انخفاض شديد في السكر. لو المريض واعي، ادّيه عصير أو سكر فوراً.',
    check: (input) => {
      const hasDiabetes =
        input.profile.diabetesType === 'type1' ||
        input.profile.diabetesType === 'type2';
      const hasLowSugar = hasAny(input.symptoms, [
        'low_blood_sugar',
        'hypoglycemia',
        'tremors',
        'confusion',
        'sweating_with_shaking',
      ]);
      return hasDiabetes && hasLowSugar;
    },
  },
];

/**
 * Check all emergency rules against the input.
 * Returns the highest-priority (lowest number) matching rule.
 * Pure, synchronous, deterministic.
 */
export function checkEmergency(input: RulesInput): EmergencyResult {
  let bestMatch: EmergencyRule | null = null;

  for (const rule of EMERGENCY_RULES) {
    if (rule.check(input)) {
      if (bestMatch === null || rule.priority < bestMatch.priority) {
        bestMatch = rule;
      }
    }
  }

  if (bestMatch === null) {
    return {
      triggered: false,
      ruleName: null,
      escalationType: null,
      responseAr: null,
      priority: null,
    };
  }

  return {
    triggered: true,
    ruleName: bestMatch.name,
    escalationType: bestMatch.escalationType,
    responseAr: bestMatch.responseAr,
    priority: bestMatch.priority,
  };
}
