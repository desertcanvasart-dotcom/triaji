-- Seed: Emergency trigger rules
-- These are the database-stored versions of the rules also coded in packages/rules-engine.
-- The rules-engine evaluates deterministically in code; these records enable admin editing.
--
-- Priorities mirror packages/rules-engine/src/emergency.ts, where every rule has a
-- unique priority. The gaps (2, 4, 5, 8, 10) belong to the paediatric rules, which
-- exist only in code and are not mirrored here.

INSERT INTO emergency_triggers (name, description_ar, symptom_conditions, profile_conditions, response_ar, escalation_type, priority) VALUES

-- Priority 1: Cardiac arrest
('cardiac_arrest',
 'علامات توقف القلب',
 '{"any_of": ["cardiac_arrest", "no_pulse", "not_breathing", "unconscious_not_breathing"]}',
 NULL,
 'دي حالة طوارئ قصوى — اتصل بالإسعاف فوراً على 123. لو في حد معاك يعرف يعمل إنعاش قلبي رئوي، يبدأ فوراً.',
 'call_ambulance', 1),

-- Priority 3: Stroke signs
('stroke_signs',
 'علامات سكتة دماغية',
 '{"any_of": ["facial_droop", "unilateral_weakness", "speech_difficulty", "sudden_confusion"]}',
 NULL,
 'الأعراض دي ممكن تكون سكتة دماغية — لازم تروح أقرب طوارئ فوراً أو اتصل بالإسعاف على 123. كل دقيقة بتفرق.',
 'call_ambulance', 3),

-- Priority 6: Chest pain + SOB
('chest_pain_sob',
 'ألم في الصدر مع ضيق في التنفس',
 '{"all_of": ["chest_pain", "shortness_of_breath"]}',
 NULL,
 'ألم الصدر مع صعوبة التنفس ممكن يكون حالة قلبية خطيرة — لازم تروح الطوارئ فوراً أو اتصل بـ 123.',
 'call_ambulance', 6),

-- Priority 7: Severe allergic reaction
('anaphylaxis',
 'حساسية شديدة أو صدمة تحسسية',
 '{"any_of": ["throat_swelling", "anaphylaxis"], "or_combination": {"all_of": ["rash", "shortness_of_breath"]}}',
 NULL,
 'دي أعراض حساسية شديدة جداً — لو عندك حقنة أدرينالين استخدمها فوراً واتصل بالإسعاف على 123.',
 'call_ambulance', 7),

-- Priority 9: SOB preventing speech
('severe_sob',
 'ضيق تنفس شديد مش قادر يتكلم',
 '{"any_of": ["sob_preventing_speech", "cannot_speak_full_sentences", "severe_breathing_difficulty"]}',
 NULL,
 'ضيق التنفس الشديد ده محتاج تدخل فوري — اتصل بالإسعاف على 123 أو روح أقرب طوارئ.',
 'call_ambulance', 9),

-- Priority 11: Febrile seizure
('febrile_seizure',
 'تشنج حراري عند طفل',
 '{"all_of": ["seizure", "fever"]}',
 '{"age_max": 12}',
 'التشنج مع السخونية عند الأطفال محتاج طوارئ فوراً — اتصل بـ 123 ومتحاولش تحط حاجة في بقه.',
 'call_ambulance', 11),

-- Priority 12: Infant high fever
('infant_fever',
 'سخونية عند رضيع أقل من 3 شهور',
 '{"any_of": ["fever", "high_fever"]}',
 '{"age_max": 0.25}',
 'أي سخونية عند رضيع أقل من 3 شهور لازم تتعرض على دكتور فوراً — روح أقرب طوارئ أطفال دلوقتي.',
 'emergency_room', 12),

-- Priority 13: Loss of consciousness
('loss_of_consciousness',
 'فقدان الوعي أو إغماء',
 '{"any_of": ["loss_of_consciousness", "syncope", "fainting", "unconscious"]}',
 NULL,
 'فقدان الوعي محتاج يتشاف في الطوارئ — لو الشخص لسه مش فايق، اتصل بـ 123 فوراً.',
 'emergency_room', 13),

-- Priority 14: Meningism
('meningism',
 'علامات التهاب السحايا',
 '{"all_of": ["fever", "neck_stiffness"]}',
 NULL,
 'السخونية مع تيبس الرقبة ممكن تكون التهاب سحايا — لازم تروح الطوارئ فوراً.',
 'emergency_room', 14),

-- Priority 15: Severe bleeding
('severe_bleeding',
 'نزيف شديد غير متحكم فيه',
 '{"any_of": ["severe_bleeding", "uncontrolled_bleeding", "heavy_bleeding"]}',
 NULL,
 'النزيف الشديد محتاج ضغط على مكان النزيف وتروح الطوارئ فوراً — لو النزيف مش بيوقف، اتصل بـ 123.',
 'emergency_room', 15),

-- Priority 16: Thunderclap headache
('thunderclap_headache',
 'صداع رعدي — أسوأ صداع مفاجئ',
 '{"any_of": ["worst_headache", "thunderclap_headache"], "or_combination": {"all_of": ["sudden_headache", "severe_headache"]}}',
 NULL,
 'الصداع المفاجئ الشديد ده ممكن يكون خطير — لازم تروح الطوارئ فوراً للاطمئنان.',
 'emergency_room', 16),

-- Priority 17: Diabetic emergency
('diabetic_emergency',
 'طوارئ سكر — انخفاض حاد',
 '{"any_of": ["low_blood_sugar", "hypoglycemia", "diabetic_crisis"]}',
 '{"diabetes_type_not": "none"}',
 'لو السكر نازل جداً، كل أو اشرب حاجة فيها سكر فوراً. لو مش قادر تاكل أو تشرب، اتصل بـ 123.',
 'emergency_room', 17);
