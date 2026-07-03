-- 059_emergency_trigger_priorities.sql
-- Renumber emergency_triggers priorities to match packages/rules-engine
-- (emergency.ts), where every rule now has a unique priority. The relative
-- order of these 12 rules is unchanged; the gaps (2, 4, 5, 8, 10) belong to
-- the paediatric rules that exist only in code. Keeps the admin panel's
-- display numbers in sync with the engine.
--
-- Idempotent: each row is only touched while it still carries its old
-- priority, so re-runs are no-ops and admin-edited priorities are preserved.

UPDATE emergency_triggers AS et
SET priority = m.new_priority
FROM (VALUES
  ('stroke_signs',          2, 3),
  ('chest_pain_sob',        3, 6),
  ('anaphylaxis',           4, 7),
  ('severe_sob',            5, 9),
  ('febrile_seizure',       6, 11),
  ('infant_fever',          7, 12),
  ('loss_of_consciousness', 8, 13),
  ('meningism',             9, 14),
  ('severe_bleeding',      10, 15),
  ('thunderclap_headache', 11, 16),
  ('diabetic_emergency',   12, 17)
) AS m(name, old_priority, new_priority)
WHERE et.name = m.name
  AND et.priority = m.old_priority;
