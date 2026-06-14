-- ============================================================
-- Migration 041: Referral System
-- Tier 1 (specialty) + Tier 2 (specific doctor) referrals
-- ============================================================

CREATE TYPE referral_status AS ENUM (
  'draft', 'sent', 'accepted', 'declined',
  'appointment_booked', 'consultation_done', 'outcome_reported', 'closed'
);

CREATE TYPE referral_tier AS ENUM ('tier_1', 'tier_2');

CREATE TABLE referrals (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  referring_doctor_id   UUID NOT NULL REFERENCES doctors(id),
  referring_account_id  UUID NOT NULL REFERENCES doctor_accounts(id),
  referring_booking_id  UUID REFERENCES bookings(id),

  patient_id            UUID NOT NULL REFERENCES patients(id),

  tier                  referral_tier NOT NULL DEFAULT 'tier_1',
  referred_specialty_id UUID NOT NULL REFERENCES specialties(id),
  referred_doctor_id    UUID REFERENCES doctors(id),
  referred_account_id   UUID REFERENCES doctor_accounts(id),

  reason_ar             TEXT NOT NULL,
  reason_en             TEXT,
  clinical_summary_ar   TEXT,
  clinical_summary_en   TEXT,
  urgency               TEXT NOT NULL DEFAULT 'routine',

  status                referral_status NOT NULL DEFAULT 'draft',
  sent_at               TIMESTAMPTZ,
  accepted_at           TIMESTAMPTZ,
  declined_at           TIMESTAMPTZ,
  decline_reason_ar     TEXT,
  appointment_booked_at TIMESTAMPTZ,
  consultation_done_at  TIMESTAMPTZ,

  outcome_booking_id    UUID REFERENCES bookings(id),
  outcome_summary_ar    TEXT,
  outcome_reported_at   TIMESTAMPTZ,

  referral_pdf_url      TEXT,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_referrals_referring ON referrals (referring_account_id);
CREATE INDEX idx_referrals_referred  ON referrals (referred_account_id);
CREATE INDEX idx_referrals_patient   ON referrals (patient_id);
CREATE INDEX idx_referrals_status    ON referrals (status);

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_referrals" ON referrals
  FOR ALL USING (auth.role() = 'service_role');
