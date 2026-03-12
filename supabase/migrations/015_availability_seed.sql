-- 015_availability_seed.sql
-- Seed realistic availability slots for 14 doctors across specialties.
-- Each doctor gets 3 slots per weekday (Sat-Thu), skipping Friday.
-- Egyptian workweek: Saturday–Thursday. Friday is the weekend.

DO $$
DECLARE
  v_doctor_id UUID;
  v_day DATE;
  v_end_date DATE;
  v_slot_time TIME;
  v_doctors UUID[];
  v_names TEXT[];
  i INT;
BEGIN
  -- Collect 14 doctors by English name (spread across specialties & governorates)
  v_names := ARRAY[
    'Dr. Ahmed Hassan',        -- Cardiology, Cairo
    'Dr. Mona El-Sherif',      -- Dermatology, Cairo
    'Dr. Salma Farouk',        -- Pediatrics, Cairo
    'Dr. Hany Abdelrahman',    -- Neurology, Cairo
    'Dr. Dina Mahmoud',        -- Gynecology, Giza
    'Dr. Amr Khalil',          -- Ophthalmology, Giza
    'Dr. Khaled Said',         -- Internal Medicine, Alexandria
    'Dr. Huda Ibrahim',        -- Gynecology, Alexandria
    'Dr. Mahmoud Gabr',        -- Cardiology, Dakahlia
    'Dr. Mohamed Samy',        -- Neurology, Dakahlia
    'Dr. Osama Reda',          -- Internal Medicine, Asyut
    'Dr. Hassan Younis',       -- Internal Medicine, Gharbia
    'Dr. Ahmed Galal',         -- Neurology, Sharqia
    'Dr. Mostafa Kamel'        -- General Surgery, Luxor
  ];

  -- Look up their UUIDs
  FOR i IN 1..array_length(v_names, 1) LOOP
    SELECT id INTO v_doctor_id FROM doctors WHERE name_en = v_names[i];
    IF v_doctor_id IS NOT NULL THEN
      v_doctors := array_append(v_doctors, v_doctor_id);
    END IF;
  END LOOP;

  -- Generate slots for each doctor
  v_end_date := (CURRENT_DATE + INTERVAL '14 days')::DATE;

  FOREACH v_doctor_id IN ARRAY v_doctors LOOP
    v_day := (CURRENT_DATE + INTERVAL '1 day')::DATE;

    WHILE v_day <= v_end_date LOOP
      -- Skip Friday (DOW 5). Saturday (DOW 6) is a working day in Egypt.
      IF EXTRACT(DOW FROM v_day) != 5 THEN
        -- Morning slot 09:00
        INSERT INTO doctor_availability (doctor_id, tenant_id, source, slot_datetime, duration_minutes, is_booked)
        VALUES (v_doctor_id, NULL, 'native', v_day + TIME '09:00', 30, false)
        ON CONFLICT DO NOTHING;

        -- Midday slot 12:00
        INSERT INTO doctor_availability (doctor_id, tenant_id, source, slot_datetime, duration_minutes, is_booked)
        VALUES (v_doctor_id, NULL, 'native', v_day + TIME '12:00', 30, false)
        ON CONFLICT DO NOTHING;

        -- Afternoon slot 17:00
        INSERT INTO doctor_availability (doctor_id, tenant_id, source, slot_datetime, duration_minutes, is_booked)
        VALUES (v_doctor_id, NULL, 'native', v_day + TIME '17:00', 30, false)
        ON CONFLICT DO NOTHING;
      END IF;

      v_day := v_day + INTERVAL '1 day';
    END LOOP;
  END LOOP;
END $$;
