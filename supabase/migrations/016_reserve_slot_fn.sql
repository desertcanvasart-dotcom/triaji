-- 016_reserve_slot_fn.sql
-- Atomic slot reservation function with optimistic locking.
-- Prevents double-booking via SELECT ... FOR UPDATE.

DROP FUNCTION IF EXISTS reserve_slot(UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION reserve_slot(
  p_slot_id      UUID,
  p_patient_id   UUID,
  p_doctor_id    UUID,
  p_session_id   UUID,
  p_patient_name TEXT DEFAULT NULL,
  p_phone_number TEXT DEFAULT NULL,
  p_notes        TEXT DEFAULT NULL
) RETURNS TABLE (
  success    BOOLEAN,
  booking_id UUID,
  error_code TEXT
) AS $$
DECLARE
  v_booking_id   UUID;
  v_slot_taken   BOOLEAN;
  v_slot_future  BOOLEAN;
BEGIN
  -- Lock and check slot atomically
  SELECT
    da.is_booked,
    da.slot_datetime > NOW()
  INTO v_slot_taken, v_slot_future
  FROM   doctor_availability da
  WHERE  da.id = p_slot_id
  FOR    UPDATE;

  -- Slot not found
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::UUID, 'SLOT_NOT_FOUND'::TEXT;
    RETURN;
  END IF;

  -- Already booked
  IF v_slot_taken THEN
    RETURN QUERY SELECT false, NULL::UUID, 'SLOT_TAKEN'::TEXT;
    RETURN;
  END IF;

  -- Slot is in the past
  IF NOT v_slot_future THEN
    RETURN QUERY SELECT false, NULL::UUID, 'SLOT_PAST'::TEXT;
    RETURN;
  END IF;

  -- Update patient name/phone if provided (for guest patients)
  IF p_patient_name IS NOT NULL THEN
    UPDATE patients SET name_ar = p_patient_name WHERE id = p_patient_id;
  END IF;
  IF p_phone_number IS NOT NULL THEN
    UPDATE patients SET phone_number = p_phone_number WHERE id = p_patient_id;
  END IF;

  -- Mark slot as booked
  UPDATE doctor_availability SET is_booked = true WHERE id = p_slot_id;

  -- Create booking
  INSERT INTO bookings (
    patient_id, doctor_id, session_id, slot_id,
    appointment_datetime, duration_minutes, status, booking_source, notes_ar
  )
  SELECT
    p_patient_id, p_doctor_id, p_session_id, p_slot_id,
    da.slot_datetime, da.duration_minutes, 'pending', 'native', p_notes
  FROM doctor_availability da WHERE da.id = p_slot_id
  RETURNING id INTO v_booking_id;

  -- Link booking to triage session
  UPDATE triage_sessions SET booking_id = v_booking_id WHERE id = p_session_id;

  RETURN QUERY SELECT true, v_booking_id, NULL::TEXT;
END;
$$ LANGUAGE plpgsql;
