-- Seed: All 27 Egyptian governorates
INSERT INTO governorates (name_ar, name_en, region, code, centroid) VALUES
  -- Cairo Metro (3)
  ('القاهرة',       'Cairo',           'cairo_metro', 'CAI', ST_SetSRID(ST_MakePoint(31.2357, 30.0444), 4326)),
  ('الجيزة',        'Giza',            'cairo_metro', 'GIZ', ST_SetSRID(ST_MakePoint(31.2086, 30.0131), 4326)),
  ('القليوبية',     'Qalyubia',        'cairo_metro', 'QLB', ST_SetSRID(ST_MakePoint(31.2421, 30.3292), 4326)),

  -- Delta (8)
  ('الإسكندرية',    'Alexandria',      'delta',       'ALX', ST_SetSRID(ST_MakePoint(29.9187, 31.2001), 4326)),
  ('الدقهلية',      'Dakahlia',        'delta',       'DKH', ST_SetSRID(ST_MakePoint(31.3614, 31.0364), 4326)),
  ('الشرقية',       'Sharqia',         'delta',       'SHR', ST_SetSRID(ST_MakePoint(31.6800, 30.6700), 4326)),
  ('الغربية',       'Gharbia',         'delta',       'GHR', ST_SetSRID(ST_MakePoint(31.0100, 30.8700), 4326)),
  ('المنوفية',      'Monufia',         'delta',       'MNF', ST_SetSRID(ST_MakePoint(30.9876, 30.5972), 4326)),
  ('البحيرة',       'Beheira',         'delta',       'BHR', ST_SetSRID(ST_MakePoint(30.4192, 31.0341), 4326)),
  ('كفر الشيخ',     'Kafr El Sheikh',  'delta',       'KFS', ST_SetSRID(ST_MakePoint(30.9400, 31.1100), 4326)),
  ('دمياط',         'Damietta',        'delta',       'DMT', ST_SetSRID(ST_MakePoint(31.8125, 31.4175), 4326)),

  -- Canal (3)
  ('بورسعيد',       'Port Said',       'canal',       'PTS', ST_SetSRID(ST_MakePoint(32.3019, 31.2653), 4326)),
  ('الإسماعيلية',   'Ismailia',        'canal',       'ISM', ST_SetSRID(ST_MakePoint(32.2721, 30.5965), 4326)),
  ('السويس',        'Suez',            'canal',       'SUZ', ST_SetSRID(ST_MakePoint(32.5498, 29.9668), 4326)),

  -- Sinai (2)
  ('شمال سيناء',    'North Sinai',     'sinai',       'NSN', ST_SetSRID(ST_MakePoint(33.6177, 31.0582), 4326)),
  ('جنوب سيناء',    'South Sinai',     'sinai',       'SSN', ST_SetSRID(ST_MakePoint(33.8676, 28.4867), 4326)),

  -- Upper Egypt (8)
  ('الفيوم',        'Fayoum',          'upper_egypt', 'FYM', ST_SetSRID(ST_MakePoint(30.8418, 29.3084), 4326)),
  ('بني سويف',      'Beni Suef',       'upper_egypt', 'BNS', ST_SetSRID(ST_MakePoint(31.0842, 29.0661), 4326)),
  ('المنيا',        'Minya',           'upper_egypt', 'MNY', ST_SetSRID(ST_MakePoint(30.7441, 28.0871), 4326)),
  ('أسيوط',         'Asyut',           'upper_egypt', 'AST', ST_SetSRID(ST_MakePoint(31.1836, 27.1810), 4326)),
  ('سوهاج',         'Sohag',           'upper_egypt', 'SHG', ST_SetSRID(ST_MakePoint(31.6948, 26.5591), 4326)),
  ('قنا',           'Qena',            'upper_egypt', 'QNA', ST_SetSRID(ST_MakePoint(32.7200, 26.1600), 4326)),
  ('الأقصر',        'Luxor',           'upper_egypt', 'LXR', ST_SetSRID(ST_MakePoint(32.6396, 25.6872), 4326)),
  ('أسوان',         'Aswan',           'upper_egypt', 'ASW', ST_SetSRID(ST_MakePoint(32.8998, 24.0889), 4326)),

  -- Border (3)
  ('البحر الأحمر',  'Red Sea',         'border',      'RDS', ST_SetSRID(ST_MakePoint(33.7978, 27.1783), 4326)),
  ('الوادي الجديد', 'New Valley',      'border',      'NVL', ST_SetSRID(ST_MakePoint(28.9700, 25.4400), 4326)),
  ('مطروح',         'Matruh',          'border',      'MTR', ST_SetSRID(ST_MakePoint(27.2153, 31.3525), 4326));
