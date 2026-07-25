-- 069_consent_scope_categories.sql
-- The privacy screen lets a patient share one category of their record —
-- vitals, lab results or medications — but `consent_scope` (migration 042) only
-- had 'full_record', 'recent_only' and 'specific_conditions', so those choices
-- could never be stored. Adds the three missing values.
--
-- The app maps its own wording onto these: 'full' → full_record and
-- 'conditions' → specific_conditions; see apps/web/lib/consent/scopes.ts.
--
-- NOTE: ALTER TYPE ... ADD VALUE cannot run inside a transaction block on some
-- Postgres versions. If this fails as a batch, run the three statements one at
-- a time.

ALTER TYPE consent_scope ADD VALUE IF NOT EXISTS 'vitals_only';
ALTER TYPE consent_scope ADD VALUE IF NOT EXISTS 'lab_results';
ALTER TYPE consent_scope ADD VALUE IF NOT EXISTS 'medications';
