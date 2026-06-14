-- ============================================================
-- Migration 042: Disease Protocols + Consent Management
-- Chronic disease monitoring + record access grants
-- ============================================================

-- Disease protocols
CREATE TABLE disease_protocols (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  condition_code  TEXT NOT NULL,
  version         INTEGER NOT NULL DEFAULT 1,
  name_ar         TEXT NOT NULL,
  name_en         TEXT NOT NULL,
  description_ar  TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  protocol_definition JSONB NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE disease_protocols ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_protocols" ON disease_protocols FOR SELECT USING (true);
CREATE POLICY "service_role_all_protocols" ON disease_protocols FOR ALL USING (auth.role() = 'service_role');

-- Patient enrollment in protocols
CREATE TABLE patient_protocol_enrollment (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id        UUID NOT NULL REFERENCES patients(id),
  protocol_id       UUID NOT NULL REFERENCES disease_protocols(id),
  condition_code    TEXT NOT NULL,
  enrolled_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  enrolled_by       TEXT NOT NULL DEFAULT 'system',
  is_active         BOOLEAN NOT NULL DEFAULT true,
  paused_at         TIMESTAMPTZ,
  paused_reason_ar  TEXT,
  last_compliance_check TIMESTAMPTZ,
  overall_compliance_pct DECIMAL(5,2),
  UNIQUE (patient_id, condition_code)
);

CREATE INDEX idx_enrollment_patient ON patient_protocol_enrollment (patient_id);
CREATE INDEX idx_enrollment_active  ON patient_protocol_enrollment (patient_id, is_active);

ALTER TABLE patient_protocol_enrollment ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_enrollment" ON patient_protocol_enrollment FOR ALL USING (auth.role() = 'service_role');

-- Consent / Record access grants
CREATE TYPE consent_scope AS ENUM (
  'full_record', 'recent_only', 'specific_conditions'
);

CREATE TABLE record_access_grants (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id         UUID NOT NULL REFERENCES patients(id),
  granted_to_doctor  UUID NOT NULL REFERENCES doctors(id),
  granted_to_account UUID NOT NULL REFERENCES doctor_accounts(id),
  scope              consent_scope NOT NULL DEFAULT 'full_record',
  conditions_filter  TEXT[],
  granted_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at         TIMESTAMPTZ,
  revoked_at         TIMESTAMPTZ,
  is_active          BOOLEAN NOT NULL DEFAULT true,
  grant_reason_ar    TEXT,
  source             TEXT NOT NULL DEFAULT 'patient',
  share_token        TEXT UNIQUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_grants_patient ON record_access_grants (patient_id);
CREATE INDEX idx_grants_doctor  ON record_access_grants (granted_to_account);
CREATE INDEX idx_grants_active  ON record_access_grants (patient_id, is_active);

ALTER TABLE record_access_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_grants" ON record_access_grants FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- SEED: 5 Disease Protocols
-- ============================================================

INSERT INTO disease_protocols (condition_code, name_ar, name_en, description_ar, protocol_definition) VALUES
(
  'diabetes',
  'بروتوكول متابعة السكري',
  'Diabetes Monitoring Protocol',
  'خطة متابعة شاملة لمرضى السكري من النوع الأول والثاني',
  '{
    "labs": [
      {"testCode":"HBA1C","testNameAr":"سكر تراكمي","frequencyMonths":3},
      {"testCode":"FBG","testNameAr":"سكر صايم","frequencyMonths":1},
      {"testCode":"RFT","testNameAr":"وظائف كلى","frequencyMonths":6},
      {"testCode":"LFT","testNameAr":"وظائف كبد","frequencyMonths":6},
      {"testCode":"LIPID","testNameAr":"دهون الدم","frequencyMonths":6},
      {"testCode":"UA","testNameAr":"تحليل بول","frequencyMonths":6}
    ],
    "vitals": [
      {"type":"weight_kg","frequencyWeeks":4},
      {"type":"blood_pressure_systolic","frequencyWeeks":2},
      {"type":"blood_glucose_fasting","frequencyWeeks":1}
    ],
    "followUpFrequency":{"months":3,"reason_ar":"متابعة السكري"},
    "targets": [
      {"metric":"HBA1C","targetAr":"أقل من 7%","targetEn":"Below 7%","targetMax":7.0,"unit":"%"},
      {"metric":"blood_glucose_fasting","targetAr":"70–130 mg/dL","targetEn":"70–130 mg/dL","targetMin":70,"targetMax":130,"unit":"mg/dL"},
      {"metric":"blood_pressure_systolic","targetAr":"أقل من 130","targetEn":"Below 130","targetMax":130,"unit":"mmHg"}
    ],
    "warnings": [
      {"metric":"HBA1C","condition":"above","threshold":8.0,"messageAr":"السكر التراكمي مرتفع — يحتاج مراجعة طبية","messageEn":"HbA1c is elevated — medical review needed","severity":"warning"},
      {"metric":"HBA1C","condition":"above","threshold":9.0,"messageAr":"السكر التراكمي مرتفع جداً — راجع طبيبك فوراً","messageEn":"HbA1c is critically high — see your doctor immediately","severity":"critical"},
      {"metric":"FBG","condition":"above","threshold":200,"messageAr":"سكر الدم مرتفع جداً — تواصل مع طبيبك","messageEn":"Blood glucose critically high — contact your doctor","severity":"critical"},
      {"metric":"FBG","condition":"below","threshold":70,"messageAr":"سكر الدم منخفض — تناول سكر الآن واتصل بطبيبك","messageEn":"Low blood sugar — eat sugar now and call your doctor","severity":"critical"}
    ]
  }'::jsonb
),
(
  'hypertension',
  'بروتوكول متابعة ضغط الدم',
  'Hypertension Monitoring Protocol',
  'خطة متابعة لمرضى ارتفاع ضغط الدم',
  '{
    "labs": [
      {"testCode":"RFT","testNameAr":"وظائف كلى","frequencyMonths":6},
      {"testCode":"LIPID","testNameAr":"دهون الدم","frequencyMonths":6},
      {"testCode":"UA","testNameAr":"تحليل بول","frequencyMonths":6}
    ],
    "vitals": [
      {"type":"blood_pressure_systolic","frequencyWeeks":1},
      {"type":"blood_pressure_diastolic","frequencyWeeks":1},
      {"type":"weight_kg","frequencyWeeks":4}
    ],
    "followUpFrequency":{"months":3,"reason_ar":"متابعة ضغط الدم"},
    "targets": [
      {"metric":"blood_pressure_systolic","targetAr":"أقل من 130","targetEn":"Below 130","targetMax":130,"unit":"mmHg"},
      {"metric":"blood_pressure_diastolic","targetAr":"أقل من 80","targetEn":"Below 80","targetMax":80,"unit":"mmHg"}
    ],
    "warnings": [
      {"metric":"blood_pressure_systolic","condition":"above","threshold":160,"messageAr":"ضغط الدم مرتفع جداً — استرح وراجع طبيبك","messageEn":"Blood pressure very high — rest and see your doctor","severity":"warning"},
      {"metric":"blood_pressure_systolic","condition":"above","threshold":180,"messageAr":"أزمة ضغط — اذهب للطوارئ فوراً","messageEn":"Hypertensive crisis — go to ER immediately","severity":"critical"}
    ]
  }'::jsonb
),
(
  'thyroid',
  'بروتوكول متابعة الغدة الدرقية',
  'Thyroid Monitoring Protocol',
  'خطة متابعة لمرضى الغدة الدرقية',
  '{
    "labs": [
      {"testCode":"TFT","testNameAr":"TSH","frequencyMonths":6},
      {"testCode":"T3T4","testNameAr":"T3 / T4","frequencyMonths":6}
    ],
    "vitals": [
      {"type":"weight_kg","frequencyWeeks":4},
      {"type":"heart_rate","frequencyWeeks":4}
    ],
    "followUpFrequency":{"months":6,"reason_ar":"متابعة الغدة الدرقية"},
    "targets": [
      {"metric":"TSH","targetAr":"0.4–4.0 mIU/L","targetEn":"0.4–4.0 mIU/L","targetMin":0.4,"targetMax":4.0,"unit":"mIU/L"}
    ],
    "warnings": [
      {"metric":"TSH","condition":"above","threshold":10.0,"messageAr":"TSH مرتفع جداً — راجع طبيبك","messageEn":"TSH critically high — see your doctor","severity":"warning"},
      {"metric":"TSH","condition":"below","threshold":0.1,"messageAr":"TSH منخفض جداً — راجع طبيبك","messageEn":"TSH critically low — see your doctor","severity":"warning"}
    ]
  }'::jsonb
),
(
  'kidney_disease',
  'بروتوكول متابعة الكلى المزمن',
  'Chronic Kidney Disease Protocol',
  'خطة متابعة لمرضى الكلى المزمن',
  '{
    "labs": [
      {"testCode":"RFT","testNameAr":"وظائف كلى","frequencyMonths":3},
      {"testCode":"UA","testNameAr":"تحليل بول + بروتين","frequencyMonths":3},
      {"testCode":"CBC","testNameAr":"صورة دم","frequencyMonths":3},
      {"testCode":"CALCIUM","testNameAr":"كالسيوم","frequencyMonths":6},
      {"testCode":"IRON","testNameAr":"حديد الدم","frequencyMonths":6}
    ],
    "vitals": [
      {"type":"blood_pressure_systolic","frequencyWeeks":1},
      {"type":"weight_kg","frequencyWeeks":2}
    ],
    "followUpFrequency":{"months":3,"reason_ar":"متابعة وظائف الكلى"},
    "targets": [
      {"metric":"blood_pressure_systolic","targetAr":"أقل من 130","targetEn":"Below 130","targetMax":130,"unit":"mmHg"}
    ],
    "warnings": [
      {"metric":"creatinine","condition":"above","threshold":3.0,"messageAr":"وظائف الكلى تحتاج مراجعة عاجلة","messageEn":"Kidney function needs urgent review","severity":"critical"}
    ]
  }'::jsonb
),
(
  'asthma',
  'بروتوكول متابعة الربو',
  'Asthma / COPD Monitoring Protocol',
  'خطة متابعة لمرضى الربو والانسداد الرئوي',
  '{
    "labs": [
      {"testCode":"CBC","testNameAr":"صورة دم كاملة","frequencyMonths":6}
    ],
    "vitals": [
      {"type":"oxygen_saturation","frequencyWeeks":2}
    ],
    "followUpFrequency":{"months":3,"reason_ar":"متابعة الربو / التنفس"},
    "targets": [
      {"metric":"oxygen_saturation","targetAr":"فوق 95%","targetEn":"Above 95%","targetMin":95,"unit":"%"}
    ],
    "warnings": [
      {"metric":"oxygen_saturation","condition":"below","threshold":92,"messageAr":"نسبة الأكسجين منخفضة — راجع طبيبك","messageEn":"Oxygen level low — see your doctor","severity":"warning"},
      {"metric":"oxygen_saturation","condition":"below","threshold":88,"messageAr":"نسبة الأكسجين خطيرة — اذهب للطوارئ","messageEn":"Oxygen critically low — go to ER","severity":"critical"}
    ]
  }'::jsonb
);
