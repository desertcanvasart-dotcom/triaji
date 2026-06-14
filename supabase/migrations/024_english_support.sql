-- Phase 12: English Language Support
-- Adds English specialty names and patient language preference

-- Add English specialty names
ALTER TABLE specialties
  ADD COLUMN IF NOT EXISTS name_en TEXT;

UPDATE specialties SET name_en = 'Cardiology'        WHERE name_ar = 'قلب وأوعية دموية';
UPDATE specialties SET name_en = 'Internal Medicine'  WHERE name_ar = 'باطنة';
UPDATE specialties SET name_en = 'Orthopaedics'       WHERE name_ar = 'عظام';
UPDATE specialties SET name_en = 'Neurology'           WHERE name_ar = 'مخ وأعصاب';
UPDATE specialties SET name_en = 'Gastroenterology'    WHERE name_ar = 'جهاز هضمي';
UPDATE specialties SET name_en = 'Dermatology'         WHERE name_ar = 'جلدية';
UPDATE specialties SET name_en = 'Gynaecology'         WHERE name_ar = 'نساء وتوليد';
UPDATE specialties SET name_en = 'Paediatrics'         WHERE name_ar = 'أطفال';
UPDATE specialties SET name_en = 'ENT'                 WHERE name_ar = 'أنف وأذن وحنجرة';
UPDATE specialties SET name_en = 'Ophthalmology'       WHERE name_ar = 'عيون';
UPDATE specialties SET name_en = 'Urology'             WHERE name_ar = 'مسالك بولية';
UPDATE specialties SET name_en = 'Psychiatry'          WHERE name_ar = 'نفسية';
UPDATE specialties SET name_en = 'Pulmonology'         WHERE name_ar = 'صدر';
UPDATE specialties SET name_en = 'Endocrinology'       WHERE name_ar = 'غدد صماء';
UPDATE specialties SET name_en = 'Oncology'            WHERE name_ar = 'أورام';
UPDATE specialties SET name_en = 'Rheumatology'        WHERE name_ar = 'روماتيزم';
UPDATE specialties SET name_en = 'General Surgery'     WHERE name_ar = 'جراحة عامة';
UPDATE specialties SET name_en = 'Emergency Medicine'  WHERE name_ar = 'طوارئ';
UPDATE specialties SET name_en = 'Family Medicine'     WHERE name_ar = 'طب الأسرة';

-- Add language preference to patient_profiles
ALTER TABLE patient_profiles
  ADD COLUMN IF NOT EXISTS preferred_language TEXT NOT NULL DEFAULT 'ar'
  CHECK (preferred_language IN ('ar', 'en'));
