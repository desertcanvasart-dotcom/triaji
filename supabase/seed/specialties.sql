-- Seed: 19 base medical specialties
INSERT INTO specialties (name_ar, name_en, urgency_default, icon_code, sort_order) VALUES
  ('باطنة',              'Internal Medicine',        'routine',   'internal',    1),
  ('قلب وأوعية دموية',   'Cardiology',               'urgent',    'cardiology',  2),
  ('مخ وأعصاب',          'Neurology',                'urgent',    'neurology',   3),
  ('عظام',               'Orthopedics',              'routine',   'orthopedics', 4),
  ('جلدية',              'Dermatology',              'routine',   'dermatology', 5),
  ('أنف وأذن وحنجرة',    'ENT',                      'routine',   'ent',         6),
  ('عيون',               'Ophthalmology',            'routine',   'ophthalm',    7),
  ('مسالك بولية',        'Urology',                  'routine',   'urology',     8),
  ('جهاز هضمي',          'Gastroenterology',         'routine',   'gastro',      9),
  ('صدر',                'Pulmonology',              'urgent',    'pulmonology', 10),
  ('أطفال',              'Pediatrics',               'urgent',    'pediatrics',  11),
  ('نساء وتوليد',        'Obstetrics & Gynecology',  'urgent',    'obgyn',       12),
  ('نفسية',              'Psychiatry',               'routine',   'psychiatry',  13),
  ('جراحة عامة',         'General Surgery',          'urgent',    'surgery',     14),
  ('طوارئ',              'Emergency Medicine',       'emergency', 'emergency',   15),
  ('طب الأسرة',          'Family Medicine',          'routine',   'family',      16),
  ('أورام',              'Oncology',                 'urgent',    'oncology',    17),
  -- 18 is Endocrinology, added by migration 012_doctors_seed.sql
  ('أسنان',              'Dentistry',                'routine',   'dentistry',   19),
  ('علاج طبيعي',         'Physiotherapy',            'routine',   'physiotherapy', 20);
