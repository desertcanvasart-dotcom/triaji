-- 012_doctors_seed.sql
-- Seed 40 doctors across 8 governorates from the Dr_Database.
-- Adds Endocrinology specialty first (not in original 17).

-- Add Endocrinology specialty if not exists
INSERT INTO specialties (name_ar, name_en, urgency_default, sort_order)
VALUES ('غدد صماء', 'Endocrinology', 'routine', 18)
ON CONFLICT DO NOTHING;

-- Seed doctors using a DO block to look up foreign keys by name
DO $$
DECLARE
  -- Specialty IDs
  v_cardiology        UUID;
  v_dermatology       UUID;
  v_orthopedics       UUID;
  v_pediatrics        UUID;
  v_neurology         UUID;
  v_general_surgery   UUID;
  v_gynecology        UUID;
  v_ophthalmology     UUID;
  v_endocrinology     UUID;
  v_internal_medicine UUID;
  v_pulmonology       UUID;
  -- Governorate IDs
  v_cairo             UUID;
  v_giza              UUID;
  v_alexandria        UUID;
  v_dakahlia          UUID;
  v_asyut             UUID;
  v_luxor             UUID;
  v_gharbia           UUID;
  v_sharqia           UUID;
BEGIN
  -- Look up specialty UUIDs
  SELECT id INTO v_cardiology        FROM specialties WHERE name_en = 'Cardiology';
  SELECT id INTO v_dermatology       FROM specialties WHERE name_en = 'Dermatology';
  SELECT id INTO v_orthopedics       FROM specialties WHERE name_en = 'Orthopedics';
  SELECT id INTO v_pediatrics        FROM specialties WHERE name_en = 'Pediatrics';
  SELECT id INTO v_neurology         FROM specialties WHERE name_en = 'Neurology';
  SELECT id INTO v_general_surgery   FROM specialties WHERE name_en = 'General Surgery';
  SELECT id INTO v_gynecology        FROM specialties WHERE name_en = 'Obstetrics & Gynecology';
  SELECT id INTO v_ophthalmology     FROM specialties WHERE name_en = 'Ophthalmology';
  SELECT id INTO v_endocrinology     FROM specialties WHERE name_en = 'Endocrinology';
  SELECT id INTO v_internal_medicine FROM specialties WHERE name_en = 'Internal Medicine';
  SELECT id INTO v_pulmonology       FROM specialties WHERE name_en = 'Pulmonology';

  -- Look up governorate UUIDs
  SELECT id INTO v_cairo       FROM governorates WHERE name_en = 'Cairo';
  SELECT id INTO v_giza        FROM governorates WHERE name_en = 'Giza';
  SELECT id INTO v_alexandria  FROM governorates WHERE name_en = 'Alexandria';
  SELECT id INTO v_dakahlia    FROM governorates WHERE name_en = 'Dakahlia';
  SELECT id INTO v_asyut       FROM governorates WHERE name_en = 'Asyut';
  SELECT id INTO v_luxor       FROM governorates WHERE name_en = 'Luxor';
  SELECT id INTO v_gharbia     FROM governorates WHERE name_en = 'Gharbia';
  SELECT id INTO v_sharqia     FROM governorates WHERE name_en = 'Sharqia';

  -- ═══════════════════════════════════════════════════════════════════════
  -- CAIRO (القاهرة) — 5 doctors
  -- ═══════════════════════════════════════════════════════════════════════

  INSERT INTO doctors (name_ar, name_en, title_ar, specialty_id, governorate_id, clinic_address_ar,
    location, consultation_fee_egp, rating_avg, rating_count, languages, tenant_id)
  VALUES
  ('د. أحمد حسن', 'Dr. Ahmed Hassan', 'استشاري قلب وأوعية دموية', v_cardiology, v_cairo,
   'مركز نايل للقلب — وسط البلد، القاهرة',
   ST_SetSRID(ST_MakePoint(31.2357, 30.0444), 4326), 350, 4.8, 245, '{ar,en}', NULL),

  ('د. منى الشريف', 'Dr. Mona El-Sherif', 'استشاري جلدية', v_dermatology, v_cairo,
   'عيادة الزمالك للجلدية — الزمالك، القاهرة',
   ST_SetSRID(ST_MakePoint(31.2294, 30.0561), 4326), 250, 4.5, 156, '{ar,en}', NULL),

  ('د. كريم نجيب', 'Dr. Karim Naguib', 'استشاري عظام', v_orthopedics, v_cairo,
   'مستشفى القاهرة للمفاصل — مدينة نصر، القاهرة',
   ST_SetSRID(ST_MakePoint(31.3214, 30.0369), 4326), 300, 4.7, 189, '{ar,en}', NULL),

  ('د. سلمى فاروق', 'Dr. Salma Farouk', 'أخصائي أطفال', v_pediatrics, v_cairo,
   'عيادة أطفال فرست — المعادي، القاهرة',
   ST_SetSRID(ST_MakePoint(31.2497, 30.0626), 4326), 200, 4.6, 210, '{ar,en}', NULL),

  ('د. هاني عبد الرحمن', 'Dr. Hany Abdelrahman', 'استشاري مخ وأعصاب', v_neurology, v_cairo,
   'مركز التجمع الخامس للأعصاب — القاهرة الجديدة',
   ST_SetSRID(ST_MakePoint(31.4100, 30.0074), 4326), 400, 4.9, 312, '{ar,en}', NULL)

  ON CONFLICT DO NOTHING;

  -- ═══════════════════════════════════════════════════════════════════════
  -- GIZA (الجيزة) — 5 doctors
  -- ═══════════════════════════════════════════════════════════════════════

  INSERT INTO doctors (name_ar, name_en, title_ar, specialty_id, governorate_id, clinic_address_ar,
    location, consultation_fee_egp, rating_avg, rating_count, languages, tenant_id)
  VALUES
  ('د. يوسف طارق', 'Dr. Youssef Tarek', 'استشاري جراحة عامة', v_general_surgery, v_giza,
   'مستشفى الأهرام الجراحي — الهرم، الجيزة',
   ST_SetSRID(ST_MakePoint(31.2089, 30.0131), 4326), 300, 4.6, 178, '{ar,en}', NULL),

  ('د. دينا محمود', 'Dr. Dina Mahmoud', 'استشاري نساء وتوليد', v_gynecology, v_giza,
   'مركز الجيزة لصحة المرأة — الدقي، الجيزة',
   ST_SetSRID(ST_MakePoint(31.2143, 30.0087), 4326), 280, 4.7, 234, '{ar,en}', NULL),

  ('د. عمرو خليل', 'Dr. Amr Khalil', 'استشاري عيون', v_ophthalmology, v_giza,
   'عيادة فيجن كير — فيصل، الجيزة',
   ST_SetSRID(ST_MakePoint(31.2101, 29.9897), 4326), 220, 4.4, 98, '{ar,en}', NULL),

  ('د. ندى سمير', 'Dr. Nada Samir', 'استشاري غدد صماء', v_endocrinology, v_giza,
   'مركز النيل للسكر — العجوزة، الجيزة',
   ST_SetSRID(ST_MakePoint(31.2088, 30.0221), 4326), 250, 4.5, 145, '{ar,en}', NULL),

  ('د. شريف لطفي', 'Dr. Sherif Lotfy', 'استشاري قلب وأوعية دموية', v_cardiology, v_giza,
   'مركز هارت لاين الطبي — ٦ أكتوبر، الجيزة',
   ST_SetSRID(ST_MakePoint(31.0176, 29.9602), 4326), 320, 4.7, 198, '{ar,en}', NULL)

  ON CONFLICT DO NOTHING;

  -- ═══════════════════════════════════════════════════════════════════════
  -- ALEXANDRIA (الإسكندرية) — 5 doctors
  -- ═══════════════════════════════════════════════════════════════════════

  INSERT INTO doctors (name_ar, name_en, title_ar, specialty_id, governorate_id, clinic_address_ar,
    location, consultation_fee_egp, rating_avg, rating_count, languages, tenant_id)
  VALUES
  ('د. خالد سعيد', 'Dr. Khaled Said', 'استشاري باطنة', v_internal_medicine, v_alexandria,
   'برج الإسكندرية الطبي — سموحة، الإسكندرية',
   ST_SetSRID(ST_MakePoint(29.9487, 31.2156), 4326), 250, 4.6, 267, '{ar,en}', NULL),

  ('د. رانيا فؤاد', 'Dr. Rania Fouad', 'أخصائي أطفال', v_pediatrics, v_alexandria,
   'عيادة أطفال البحر المتوسط — ميامي، الإسكندرية',
   ST_SetSRID(ST_MakePoint(29.9187, 31.2001), 4326), 180, 4.3, 89, '{ar,en}', NULL),

  ('د. تامر فهمي', 'Dr. Tamer Fahmy', 'استشاري جلدية', v_dermatology, v_alexandria,
   'عيادة سكين بلس — جليم، الإسكندرية',
   ST_SetSRID(ST_MakePoint(29.9101, 31.1956), 4326), 200, 4.5, 134, '{ar,en}', NULL),

  ('د. هدى إبراهيم', 'Dr. Huda Ibrahim', 'استشاري نساء وتوليد', v_gynecology, v_alexandria,
   'مستشفى الإسكندرية للنساء — سيدي بشر، الإسكندرية',
   ST_SetSRID(ST_MakePoint(29.9234, 31.2089), 4326), 280, 4.8, 289, '{ar,en}', NULL),

  ('د. عادل زكي', 'Dr. Adel Zaki', 'استشاري عظام', v_orthopedics, v_alexandria,
   'مركز الساحل لجراحة العظام — المنتزه، الإسكندرية',
   ST_SetSRID(ST_MakePoint(29.9156, 31.2134), 4326), 250, 4.6, 176, '{ar,en}', NULL)

  ON CONFLICT DO NOTHING;

  -- ═══════════════════════════════════════════════════════════════════════
  -- DAKAHLIA / MANSOURA (الدقهلية / المنصورة) — 5 doctors
  -- ═══════════════════════════════════════════════════════════════════════

  INSERT INTO doctors (name_ar, name_en, title_ar, specialty_id, governorate_id, clinic_address_ar,
    location, consultation_fee_egp, rating_avg, rating_count, languages, tenant_id)
  VALUES
  ('د. محمود جبر', 'Dr. Mahmoud Gabr', 'استشاري قلب وأوعية دموية', v_cardiology, v_dakahlia,
   'معهد الدلتا للقلب — المنصورة',
   ST_SetSRID(ST_MakePoint(31.3804, 31.0409), 4326), 250, 4.7, 223, '{ar,en}', NULL),

  ('د. هبة مصطفى', 'Dr. Heba Mostafa', 'أخصائي أطفال', v_pediatrics, v_dakahlia,
   'مستشفى المنصورة للأطفال — المنصورة',
   ST_SetSRID(ST_MakePoint(31.3765, 31.0370), 4326), 150, 4.4, 112, '{ar,en}', NULL),

  ('د. محمد سامي', 'Dr. Mohamed Samy', 'استشاري مخ وأعصاب', v_neurology, v_dakahlia,
   'عيادة نيورو كير — المنصورة',
   ST_SetSRID(ST_MakePoint(31.3850, 31.0450), 4326), 200, 4.6, 167, '{ar,en}', NULL),

  ('د. فاطمة عادل', 'Dr. Fatma Adel', 'أخصائي جلدية', v_dermatology, v_dakahlia,
   'مركز الدلتا للجلدية — المنصورة',
   ST_SetSRID(ST_MakePoint(31.3790, 31.0380), 4326), 150, 4.2, 67, '{ar,en}', NULL),

  ('د. أحمد فريد', 'Dr. Ahmed Farid', 'استشاري غدد صماء', v_endocrinology, v_dakahlia,
   'عيادة السكر والهرمونات — المنصورة',
   ST_SetSRID(ST_MakePoint(31.3820, 31.0420), 4326), 180, 4.5, 134, '{ar,en}', NULL)

  ON CONFLICT DO NOTHING;

  -- ═══════════════════════════════════════════════════════════════════════
  -- ASYUT (أسيوط) — 5 doctors
  -- ═══════════════════════════════════════════════════════════════════════

  INSERT INTO doctors (name_ar, name_en, title_ar, specialty_id, governorate_id, clinic_address_ar,
    location, consultation_fee_egp, rating_avg, rating_count, languages, tenant_id)
  VALUES
  ('د. أسامة رضا', 'Dr. Osama Reda', 'استشاري باطنة', v_internal_medicine, v_asyut,
   'مركز صعيد مصر الطبي — أسيوط',
   ST_SetSRID(ST_MakePoint(31.1884, 27.1783), 4326), 150, 4.5, 198, '{ar,en}', NULL),

  ('د. مي حسن', 'Dr. Mai Hassan', 'استشاري نساء وتوليد', v_gynecology, v_asyut,
   'عيادة أسيوط لصحة المرأة — أسيوط',
   ST_SetSRID(ST_MakePoint(31.1900, 27.1810), 4326), 150, 4.4, 145, '{ar,en}', NULL),

  ('د. سمير عبد العزيز', 'Dr. Samir Abdelaziz', 'استشاري عظام', v_orthopedics, v_asyut,
   'مستشفى أسيوط للعظام والمفاصل — أسيوط',
   ST_SetSRID(ST_MakePoint(31.1850, 27.1750), 4326), 150, 4.6, 178, '{ar,en}', NULL),

  ('د. نورهان علي', 'Dr. Nourhan Ali', 'أخصائي أطفال', v_pediatrics, v_asyut,
   'عيادة رعاية الأسرة للأطفال — أسيوط',
   ST_SetSRID(ST_MakePoint(31.1920, 27.1830), 4326), 120, 4.3, 78, '{ar,en}', NULL),

  ('د. هشام نبيل', 'Dr. Hisham Nabil', 'استشاري قلب وأوعية دموية', v_cardiology, v_asyut,
   'هارت كير — أسيوط',
   ST_SetSRID(ST_MakePoint(31.1870, 27.1770), 4326), 180, 4.7, 156, '{ar,en}', NULL)

  ON CONFLICT DO NOTHING;

  -- ═══════════════════════════════════════════════════════════════════════
  -- LUXOR (الأقصر) — 5 doctors
  -- ═══════════════════════════════════════════════════════════════════════

  INSERT INTO doctors (name_ar, name_en, title_ar, specialty_id, governorate_id, clinic_address_ar,
    location, consultation_fee_egp, rating_avg, rating_count, languages, tenant_id)
  VALUES
  ('د. ياسمين الدين', 'Dr. Yasmine El-Din', 'أخصائي جلدية', v_dermatology, v_luxor,
   'عيادة الأقصر للجلدية — الأقصر',
   ST_SetSRID(ST_MakePoint(32.6396, 25.6872), 4326), 150, 4.3, 67, '{ar,en}', NULL),

  ('د. مصطفى كامل', 'Dr. Mostafa Kamel', 'استشاري جراحة عامة', v_general_surgery, v_luxor,
   'مستشفى النيل الجراحي — الأقصر',
   ST_SetSRID(ST_MakePoint(32.6412, 25.6901), 4326), 200, 4.5, 134, '{ar,en}', NULL),

  ('د. رشا طه', 'Dr. Rasha Taha', 'أخصائي أطفال', v_pediatrics, v_luxor,
   'عيادة الأقصر للأطفال — الأقصر',
   ST_SetSRID(ST_MakePoint(32.6380, 25.6860), 4326), 120, 4.2, 56, '{ar,en}', NULL),

  ('د. وليد فتحي', 'Dr. Walid Fathi', 'استشاري عيون', v_ophthalmology, v_luxor,
   'مركز الأقصر للعيون — الأقصر',
   ST_SetSRID(ST_MakePoint(32.6430, 25.6920), 4326), 150, 4.4, 89, '{ar,en}', NULL),

  ('د. أمينة سعد', 'Dr. Amina Saad', 'استشاري نساء وتوليد', v_gynecology, v_luxor,
   'عيادة النيل للنساء — الأقصر',
   ST_SetSRID(ST_MakePoint(32.6405, 25.6885), 4326), 150, 4.5, 112, '{ar,en}', NULL)

  ON CONFLICT DO NOTHING;

  -- ═══════════════════════════════════════════════════════════════════════
  -- GHARBIA / TANTA (الغربية / طنطا) — 5 doctors
  -- ═══════════════════════════════════════════════════════════════════════

  INSERT INTO doctors (name_ar, name_en, title_ar, specialty_id, governorate_id, clinic_address_ar,
    location, consultation_fee_egp, rating_avg, rating_count, languages, tenant_id)
  VALUES
  ('د. حسن يونس', 'Dr. Hassan Younis', 'استشاري باطنة', v_internal_medicine, v_gharbia,
   'مستشفى الدلتا العام — طنطا',
   ST_SetSRID(ST_MakePoint(31.0004, 30.7865), 4326), 180, 4.6, 213, '{ar,en}', NULL),

  ('د. دينا أشرف', 'Dr. Dina Ashraf', 'استشاري غدد صماء', v_endocrinology, v_gharbia,
   'مركز الهرمونات والتمثيل الغذائي — طنطا',
   ST_SetSRID(ST_MakePoint(30.9980, 30.7840), 4326), 180, 4.4, 98, '{ar,en}', NULL),

  ('د. خالد حمدي', 'Dr. Khaled Hamdy', 'استشاري عظام', v_orthopedics, v_gharbia,
   'عيادة طنطا للمفاصل — طنطا',
   ST_SetSRID(ST_MakePoint(31.0020, 30.7880), 4326), 180, 4.5, 145, '{ar,en}', NULL),

  ('د. مروة عبد الحميد', 'Dr. Marwa Abdelhamid', 'أخصائي جلدية', v_dermatology, v_gharbia,
   'مركز كلير سكين الطبي — طنطا',
   ST_SetSRID(ST_MakePoint(30.9960, 30.7850), 4326), 150, 4.3, 67, '{ar,en}', NULL),

  ('د. ياسر عماد', 'Dr. Yasser Emad', 'استشاري قلب وأوعية دموية', v_cardiology, v_gharbia,
   'عيادة هارت لاين الدلتا — طنطا',
   ST_SetSRID(ST_MakePoint(31.0040, 30.7890), 4326), 220, 4.7, 187, '{ar,en}', NULL)

  ON CONFLICT DO NOTHING;

  -- ═══════════════════════════════════════════════════════════════════════
  -- SHARQIA / ZAGAZIG (الشرقية / الزقازيق) — 5 doctors
  -- ═══════════════════════════════════════════════════════════════════════

  INSERT INTO doctors (name_ar, name_en, title_ar, specialty_id, governorate_id, clinic_address_ar,
    location, consultation_fee_egp, rating_avg, rating_count, languages, tenant_id)
  VALUES
  ('د. سلمى يوسف', 'Dr. Salma Youssef', 'أخصائي أطفال', v_pediatrics, v_sharqia,
   'مستشفى الشرقية للأطفال — الزقازيق',
   ST_SetSRID(ST_MakePoint(31.5133, 30.5877), 4326), 150, 4.3, 89, '{ar,en}', NULL),

  ('د. أحمد جلال', 'Dr. Ahmed Galal', 'استشاري مخ وأعصاب', v_neurology, v_sharqia,
   'عيادة برين كير — الزقازيق',
   ST_SetSRID(ST_MakePoint(31.5150, 30.5890), 4326), 200, 4.5, 134, '{ar,en}', NULL),

  ('د. ليلى حاتم', 'Dr. Laila Hatem', 'استشاري نساء وتوليد', v_gynecology, v_sharqia,
   'عيادة وومن كير الشرقية — الزقازيق',
   ST_SetSRID(ST_MakePoint(31.5120, 30.5860), 4326), 180, 4.4, 112, '{ar,en}', NULL),

  ('د. كريم صلاح', 'Dr. Karim Salah', 'استشاري عيون', v_ophthalmology, v_sharqia,
   'مركز آي فيجن — الزقازيق',
   ST_SetSRID(ST_MakePoint(31.5170, 30.5900), 4326), 180, 4.3, 78, '{ar,en}', NULL),

  ('د. هدى ناصر', 'Dr. Huda Nasser', 'استشاري باطنة', v_internal_medicine, v_sharqia,
   'عيادة النيل للباطنة — الزقازيق',
   ST_SetSRID(ST_MakePoint(31.5100, 30.5850), 4326), 180, 4.6, 198, '{ar,en}', NULL)

  ON CONFLICT DO NOTHING;

END $$;
