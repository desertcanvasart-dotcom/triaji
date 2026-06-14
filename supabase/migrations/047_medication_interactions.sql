-- ============================================================
-- Migration 047: Medication Interaction Checking
-- Drug interaction database + audit log
-- ============================================================

CREATE TYPE interaction_severity AS ENUM (
  'contraindicated',  -- Critical: must not be used together
  'major',            -- Critical: significant risk, requires override
  'moderate',         -- Warning: use with caution, monitor
  'minor'             -- Info only: minimal clinical significance
);

CREATE TABLE drug_interactions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Drug pair (order-independent — both directions are valid)
  drug_a_name_en    TEXT NOT NULL,   -- Generic/INN name
  drug_a_rxcui      TEXT,            -- RxNorm CUI if known
  drug_b_name_en    TEXT NOT NULL,
  drug_b_rxcui      TEXT,

  severity          interaction_severity NOT NULL,

  -- Clinical explanation
  mechanism_ar      TEXT NOT NULL,
  mechanism_en      TEXT NOT NULL,
  consequence_ar    TEXT NOT NULL,
  consequence_en    TEXT NOT NULL,
  recommendation_ar TEXT NOT NULL,
  recommendation_en TEXT NOT NULL,

  -- Egyptian-specific context
  egypt_note_ar     TEXT,

  source            TEXT DEFAULT 'triaji_curated',
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bidirectional index — allows lookup in either drug order
CREATE INDEX idx_interactions_drug_a ON drug_interactions (LOWER(drug_a_name_en));
CREATE INDEX idx_interactions_drug_b ON drug_interactions (LOWER(drug_b_name_en));
CREATE INDEX idx_interactions_severity ON drug_interactions (severity);

-- ============================================================
-- SEED DATA — Most important interactions in Egyptian practice
-- ============================================================

INSERT INTO drug_interactions
  (drug_a_name_en, drug_b_name_en, severity,
   mechanism_ar, mechanism_en,
   consequence_ar, consequence_en,
   recommendation_ar, recommendation_en,
   egypt_note_ar)
VALUES

-- ══ CONTRAINDICATED ══════════════════════════════════════════

('Warfarin', 'Aspirin',
 'contraindicated',
 'الأسبرين يثبط الصفائح الدموية والوارفارين يثبط تخثر الدم',
 'Aspirin inhibits platelets; warfarin inhibits coagulation',
 'خطر نزيف داخلي شديد',
 'High risk of serious internal bleeding',
 'تجنب الجمع تماماً إلا تحت إشراف طبي مكثف',
 'Avoid combination except under intensive medical supervision',
 'شائع في مرضى الرجفان الأذيني على الوارفارين'),

('Metformin', 'IV Contrast Dye',
 'contraindicated',
 'الصبغة تؤثر على وظائف الكلى وتراكم الميتفورمين',
 'Contrast affects renal function causing metformin accumulation',
 'حماض لبني خطير',
 'Serious lactic acidosis',
 'أوقف الميتفورمين 48 ساعة قبل وبعد الصبغة',
 'Stop metformin 48h before and after contrast',
 'مهم جداً قبل أشعة مقطعية بصبغة لمرضى السكر'),

('MAO Inhibitors', 'Tramadol',
 'contraindicated',
 'تفاعل خطير بين مثبطات MAO والترامادول',
 'Dangerous serotonin syndrome interaction',
 'متلازمة السيروتونين — خطر الوفاة',
 'Serotonin syndrome — risk of death',
 'ممنوع تماماً',
 'Absolutely contraindicated',
 NULL),

('Sildenafil', 'Nitrates',
 'contraindicated',
 'كلاهما يوسع الأوعية الدموية بآليات متضافرة',
 'Both vasodilators with synergistic effect',
 'انخفاض حاد في ضغط الدم — قد يسبب الوفاة',
 'Severe hypotension — potentially fatal',
 'ممنوع الجمع تماماً',
 'Absolutely contraindicated',
 'شائع في مرضى قلب مصريين'),

-- ══ MAJOR ════════════════════════════════════════════════════

('Warfarin', 'Ciprofloxacin',
 'major',
 'السيبروفلوكساسين يثبط استقلاب الوارفارين',
 'Ciprofloxacin inhibits warfarin metabolism',
 'ارتفاع مستوى الوارفارين وخطر نزيف',
 'Elevated warfarin levels and bleeding risk',
 'راقب INR بعناية عند الجمع',
 'Monitor INR closely if combined',
 NULL),

('Warfarin', 'Metronidazole',
 'major',
 'الميترونيدازول يثبط استقلاب الوارفارين بشدة',
 'Metronidazole strongly inhibits warfarin metabolism',
 'ارتفاع كبير في مستوى الوارفارين',
 'Significant increase in warfarin levels',
 'راقب INR يومياً وقلل جرعة الوارفارين',
 'Monitor INR daily and reduce warfarin dose',
 NULL),

('ACE Inhibitors', 'Potassium Supplements',
 'major',
 'كلاهما يرفع مستوى البوتاسيوم',
 'Both increase potassium levels',
 'فرط بوتاسيوم الدم — خطر على القلب',
 'Hyperkalemia — cardiac risk',
 'راقب مستوى البوتاسيوم',
 'Monitor potassium levels',
 'شائع في مرضى ضغط الدم المصريين'),

('Metformin', 'Alcohol',
 'major',
 'الكحول يزيد من خطر الحماض اللبني مع الميتفورمين',
 'Alcohol increases lactic acidosis risk with metformin',
 'حماض لبني',
 'Lactic acidosis',
 'تجنب تناول الكحول مع الميتفورمين',
 'Avoid alcohol with metformin',
 NULL),

('Clopidogrel', 'Omeprazole',
 'major',
 'الأوميبرازول يثبط تحويل الكلوبيدوجريل لشكله الفعال',
 'Omeprazole inhibits conversion of clopidogrel to active form',
 'تقليل فعالية الكلوبيدوجريل',
 'Reduced clopidogrel effectiveness',
 'استخدم بانتوبرازول بدلاً من الأوميبرازول',
 'Use pantoprazole instead of omeprazole',
 'شائع جداً في مرضى القسطرة المصريين'),

('SSRIs', 'Tramadol',
 'major',
 'الجمع يزيد خطر متلازمة السيروتونين',
 'Combination increases serotonin syndrome risk',
 'متلازمة السيروتونين',
 'Serotonin syndrome',
 'استخدم مسكناً بديلاً أو راقب بعناية',
 'Use alternative analgesic or monitor closely',
 NULL),

('Digoxin', 'Amiodarone',
 'major',
 'الأميودارون يرفع مستوى الديجوكسين',
 'Amiodarone increases digoxin levels',
 'سمية الديجوكسين',
 'Digoxin toxicity',
 'قلل جرعة الديجوكسين إلى النصف وراقب المستوى',
 'Halve digoxin dose and monitor levels',
 NULL),

-- ══ MODERATE ═════════════════════════════════════════════════

('NSAIDs', 'ACE Inhibitors',
 'moderate',
 'مضادات الالتهاب تقلل فعالية أدوية الضغط وتؤثر على الكلى',
 'NSAIDs reduce antihypertensive effect and affect kidneys',
 'ارتفاع ضغط الدم وتدهور وظائف الكلى',
 'Blood pressure increase and renal impairment',
 'تجنب الاستخدام الطويل وراقب ضغط الدم',
 'Avoid prolonged use and monitor BP',
 'شائع — كثير من مرضى الضغط يأخذون مسكنات'),

('NSAIDs', 'Metformin',
 'moderate',
 'مضادات الالتهاب تقلل تدفق الدم للكلى',
 'NSAIDs reduce renal blood flow',
 'تراكم الميتفورمين وخطر حماض لبني',
 'Metformin accumulation and lactic acidosis risk',
 'تجنب في مرضى الكلى أو استخدم لفترة قصيرة',
 'Avoid in renal patients or use short-term only',
 NULL),

('Atorvastatin', 'Clarithromycin',
 'moderate',
 'الكلاريثروميسين يثبط استقلاب الأتورفاستاتين',
 'Clarithromycin inhibits atorvastatin metabolism',
 'ارتفاع مستوى الأتورفاستاتين وخطر آلام العضلات',
 'Elevated statin levels and myopathy risk',
 'أوقف الأتورفاستاتين مؤقتاً أو قلل الجرعة',
 'Temporarily stop atorvastatin or reduce dose',
 NULL),

('Levothyroxine', 'Calcium Supplements',
 'moderate',
 'الكالسيوم يقلل امتصاص الليفوثيروكسين',
 'Calcium reduces levothyroxine absorption',
 'نقص فعالية الليفوثيروكسين',
 'Reduced levothyroxine effectiveness',
 'افصل بينهما 4 ساعات على الأقل',
 'Separate doses by at least 4 hours',
 'شائع في مرضى الغدة الدرقية المصريين'),

('Levothyroxine', 'Iron Supplements',
 'moderate',
 'الحديد يقلل امتصاص الليفوثيروكسين',
 'Iron reduces levothyroxine absorption',
 'نقص فعالية الليفوثيروكسين',
 'Reduced levothyroxine effectiveness',
 'افصل بينهما 4 ساعات على الأقل',
 'Separate doses by at least 4 hours',
 NULL),

('Metformin', 'Contrast Dye',
 'moderate',
 'الصبغة تؤثر مؤقتاً على وظائف الكلى',
 'Contrast temporarily affects renal function',
 'تراكم الميتفورمين',
 'Metformin accumulation',
 'أوقف الميتفورمين يوم الفحص وأعده بعد 48 ساعة',
 'Stop metformin on day of procedure, restart after 48h',
 NULL),

-- ══ MINOR ════════════════════════════════════════════════════

('Cetirizine', 'Diazepam',
 'minor',
 'كلاهما يسبب النعاس',
 'Both cause drowsiness',
 'زيادة النعاس والدوخة',
 'Increased drowsiness and dizziness',
 'تجنب القيادة عند الجمع',
 'Avoid driving when combined',
 NULL),

('Metformin', 'Vitamin B12',
 'minor',
 'الميتفورمين قد يقلل امتصاص فيتامين B12',
 'Metformin may reduce vitamin B12 absorption',
 'نقص محتمل في فيتامين B12 على المدى الطويل',
 'Potential long-term B12 deficiency',
 'راقب مستوى B12 سنوياً',
 'Monitor B12 levels annually',
 'مهم في مرضى السكر على ميتفورمين لفترة طويلة'),

('Amlodipine', 'Simvastatin',
 'minor',
 'الأملوديبين يرفع مستوى السيمفاستاتين قليلاً',
 'Amlodipine slightly increases simvastatin levels',
 'زيادة طفيفة في خطر آلام العضلات',
 'Slightly increased myopathy risk',
 'لا تتجاوز 20mg من السيمفاستاتين',
 'Do not exceed simvastatin 20mg',
 NULL);

-- ============================================================
-- INTERACTION CHECK LOG — Safety audit
-- ============================================================

CREATE TABLE interaction_check_log (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id            UUID NOT NULL REFERENCES patients(id),
  doctor_account_id     UUID NOT NULL REFERENCES doctor_accounts(id),
  health_record_id      UUID REFERENCES health_records(id),

  new_drug_name_en      TEXT NOT NULL,
  new_drug_rxcui        TEXT,
  checked_against_drugs TEXT[] NOT NULL,

  interactions_found    JSONB NOT NULL DEFAULT '[]',
  highest_severity      interaction_severity,

  doctor_acknowledged   BOOLEAN NOT NULL DEFAULT false,
  acknowledgement_at    TIMESTAMPTZ,
  override_reason_ar    TEXT,

  check_source          TEXT NOT NULL DEFAULT 'local',

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_interaction_log_patient  ON interaction_check_log (patient_id);
CREATE INDEX idx_interaction_log_doctor   ON interaction_check_log (doctor_account_id);
CREATE INDEX idx_interaction_log_severity ON interaction_check_log (highest_severity);
CREATE INDEX idx_interaction_log_date     ON interaction_check_log (created_at DESC);

ALTER TABLE drug_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE interaction_check_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_interactions" ON drug_interactions FOR SELECT USING (true);
CREATE POLICY "service_role_all_interactions" ON drug_interactions FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_all_interaction_log" ON interaction_check_log FOR ALL USING (auth.role() = 'service_role');
