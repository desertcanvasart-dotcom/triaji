/**
 * Egyptian Arabic colloquial medical phrases mapped to normalized symptom codes.
 *
 * Each key is an Egyptian dialect phrase (without diacritics) and
 * each value is an array of symptom codes the phrase implies.
 */
export const dialectMap = new Map<string, string[]>([
  // --- Headache variants ---
  ['دماغي واجعاني', ['headache']],
  ['صداع', ['headache']],
  ['راسي بتوجعني', ['headache']],
  ['دماغي هتنفجر', ['worst_headache', 'sudden_headache']],
  ['دوخة', ['dizziness']],

  // --- Chest pain ---
  ['الم في صدري', ['chest_pain']],
  ['صدري بيوجعني', ['chest_pain']],
  ['حاسس بضغط على صدري', ['chest_pain', 'chest_pressure']],
  ['قلبي بيوجعني', ['chest_pain', 'cardiac_pain']],

  // --- Breathing ---
  ['مش قادر اتنفس', ['shortness_of_breath']],
  ['نفسي مخنوق', ['shortness_of_breath']],
  ['بتعب لما بمشي', ['exertional_dyspnea', 'shortness_of_breath']],
  ['كتمة', ['shortness_of_breath']],

  // --- Abdominal ---
  ['بطني واجعاني', ['abdominal_pain']],
  ['معدتي بتوجعني', ['abdominal_pain', 'stomach_pain']],
  ['مغص شديد', ['abdominal_pain', 'cramping']],
  ['حموضة', ['heartburn', 'acid_reflux']],

  // --- Fever ---
  ['حرارتي عالية', ['fever', 'high_fever']],
  ['سخن', ['fever']],
  ['جسمي ولعان', ['fever', 'body_aches']],
  ['بسخن وببرد', ['fever', 'chills']],

  // --- Dizziness ---
  ['الدنيا بتلف', ['dizziness', 'vertigo']],
  ['دايخ', ['dizziness']],
  ['مش ثابت', ['dizziness', 'unsteadiness']],
  ['هقع', ['dizziness', 'near_syncope']],

  // --- Back pain ---
  ['ضهري واجعني', ['back_pain']],
  ['وجع في الظهر', ['back_pain']],
  ['رقبتي واجعاني', ['neck_pain']],

  // --- Cough ---
  ['كحة', ['cough']],
  ['كحة شديدة', ['cough', 'severe_cough']],
  ['بكح دم', ['coughing_blood', 'hemoptysis']],
  ['زوري واجعني', ['sore_throat']],
  ['مش قادر ابلع', ['difficulty_swallowing']],

  // --- Rash / Skin ---
  ['طفح جلدي', ['rash']],
  ['حساسية', ['allergic_reaction', 'rash']],
  ['بشرتي بتحكني', ['itching', 'rash']],
  ['ورم', ['swelling']],

  // --- Urinary ---
  ['بتوجعني لما بتبول', ['urinary_pain']],
  ['بتبول دم', ['blood_in_urine', 'hematuria']],
  ['حرقان في البول', ['burning_urination', 'urinary_pain']],

  // --- General ---
  ['تعبان', ['fatigue']],
  ['مش قادر اتحرك', ['immobility', 'weakness']],
  ['وقعت', ['fall', 'trauma']],
  ['بنزف', ['bleeding']],

  // --- Stroke signs ---
  ['وشي ملخبط', ['facial_droop']],
  ['مش قادر اتكلم كويس', ['speech_difficulty']],
  ['ايدي مش بتتحرك', ['unilateral_weakness']],

  // --- Consciousness ---
  ['اغمى عليا', ['loss_of_consciousness', 'syncope']],
  ['فقدت وعيي', ['loss_of_consciousness']],

  // --- Allergic emergency ---
  ['مش قادر اتنفس وعندي طفح', ['shortness_of_breath', 'rash', 'anaphylaxis']],
  ['حلقي مقفل', ['throat_swelling', 'airway_obstruction']],

  // --- Seizure ---
  ['تشنج', ['seizure']],
  ['اترعش', ['seizure', 'tremor']],

  // --- Diabetic ---
  ['سكري نازل', ['low_blood_sugar', 'hypoglycemia']],
  ['حاسس بدوخة وعرق', ['dizziness', 'sweating', 'low_blood_sugar']],

  // --- Meningitis-like ---
  ['رقبتي متيبسة', ['neck_stiffness']],
  ['النور بيوجعني', ['photophobia']],
]);
