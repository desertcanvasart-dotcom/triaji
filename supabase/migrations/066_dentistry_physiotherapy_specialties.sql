-- 066_dentistry_physiotherapy_specialties.sql
-- Adds Dentistry and Physiotherapy to the specialties list so doctors can pick
-- them at registration and patients can find them in the directory.
-- Idempotent: specialties has no unique constraint on name_en, so guard with NOT EXISTS.

INSERT INTO specialties (name_ar, name_en, urgency_default, icon_code, sort_order)
SELECT 'أسنان', 'Dentistry', 'routine', 'dentistry', 19
WHERE NOT EXISTS (SELECT 1 FROM specialties WHERE name_en = 'Dentistry');

INSERT INTO specialties (name_ar, name_en, urgency_default, icon_code, sort_order)
SELECT 'علاج طبيعي', 'Physiotherapy', 'routine', 'physiotherapy', 20
WHERE NOT EXISTS (SELECT 1 FROM specialties WHERE name_en = 'Physiotherapy');
