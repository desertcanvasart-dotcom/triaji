# Phase 25 — Paediatric Profiles: Implementation Plan

## Overview
Parent-managed child records with growth charts (WHO percentiles), Egyptian vaccination schedule, developmental milestones, school health records, and weight-based paediatric dosing calculator. Parent's single phone-number login manages multiple child profiles.

**IMPORTANT:** Migration number must be **048_paediatric.sql** — 047 was used for medication interactions in Phase 24.

---

## Batch 1: Migration 048 + Shared Types + i18n (3 files)
**~800 lines of SQL, 2 TS files**

1. **`supabase/migrations/048_paediatric.sql`**
   - `guardian_relation` enum + `guardian_relationships` table (parent↔child link)
   - `patient_profiles` ALTER: add `is_paediatric`, `date_of_birth`, `gestational_age_weeks`, `birth_weight_grams`, `blood_type`, `school_name_ar`, `school_grade_ar`, `paediatrician_name_ar`, `special_needs_ar`, `turning_18_notified`
   - `growth_measurements` table with computed BMI, WHO percentiles stored
   - `who_growth_reference` table — seeded with WHO data (~200 rows for key ages, both sexes, weight + height + bmi + head_circ)
   - `calculate_percentile` SQL function (linear interpolation between percentile points)
   - `vaccine_catalog` table — seeded with 14 Egyptian MOH vaccines
   - `vaccination_schedule` table — tracks due/given/overdue/skipped/deferred per vaccine dose
   - `milestone_catalog` table — seeded with ~25 key milestones across 5 categories
   - `patient_milestones` table — per-child tracking
   - `school_health_records` table
   - `paediatric_drug_dosing` table — seeded with 8 common paediatric drugs + Egyptian formulations
   - Indexes + RLS on all tables (guardian access + doctor access patterns)

2. **`packages/shared/types/paediatric.ts`** (new)
   - Types: GuardianRelation, GuardianRelationship, GrowthMeasurement, WhoGrowthReference, VaccineStatus, VaccineCatalog, VaccinationScheduleEntry, MilestoneCategory, MilestoneCatalog, PatientMilestone, SchoolHealthRecord, PaediatricDrugDosing

3. **`packages/shared/i18n/strings.ts`** (modified)
   - Add `paediatric` section with ~50 AR+EN string pairs

---

## Batch 2: Parent-Child APIs (5 routes)

1. **`POST /api/patient/children`** — Add child profile
   - Creates `patients` row, `patient_profiles` row (is_paediatric=true), `guardian_relationships` row
   - Auto-generates `vaccination_schedule` from `vaccine_catalog` based on date_of_birth
   - Auth: patient (parent)

2. **`GET /api/patient/children`** — List guardian's children
   - Returns children with age calculated from date_of_birth
   - Auth: patient (parent)

3. **`GET /api/patient/children/switch`** — Switch active child context
   - Sets a cookie/session variable for the active child profile
   - Auth: patient (parent)

4. **Profile switcher component** (web) — horizontal chip row showing "أنا" + children
5. **Profile switcher component** (mobile) — horizontal ScrollView chips

---

## Batch 3: Growth Charts (5 files)

1. **`GET /api/child/[id]/growth`** — Growth measurements + WHO reference data
2. **`POST /api/child/[id]/growth`** — Add measurement (calculates percentile via SQL function)
3. **`apps/web/components/paediatric/GrowthChart.tsx`** — recharts with percentile bands (green P15-P85, yellow P3-P15/P85-P97, red outside). Bilingual labels, dot chart with child's measurements.
4. **`apps/mobile/components/paediatric/GrowthChart.tsx`** — Victory Native version (separate implementation)
5. **Quick measurement entry** — bottom sheet/modal for adding weight/height/head circumference

---

## Batch 4: Vaccination Schedule (5 files)

1. **`GET /api/child/[id]/vaccines`** — Vaccination schedule with status
2. **`PUT /api/child/[id]/vaccines/[vaccId]`** — Mark given/skipped/deferred
3. **`GET /api/child/[id]/vaccines/certificate`** — Generate PDF (pdf-lib)
4. **Vaccination tracking page** (web) — `/ar/child/[id]/vaccines` + `/en/child/[id]/vaccines`
5. **`GET /api/cron/vaccination-reminders`** — Daily cron: find due/overdue, send bilingual WhatsApp to parent

---

## Batch 5: Developmental Milestones (3 files)

1. **`GET /api/child/[id]/milestones`** — Milestones for child's age
2. **`PUT /api/child/[id]/milestones/[mId]`** — Update milestone (achieved/not)
3. **Milestone tracking page** (web) — `/ar/child/[id]/milestones` + `/en/child/[id]/milestones`
   - Organized by category + age group
   - Red flag banner for unachieved milestones past target age
   - NON-ALARMING language, always ends with "تكلم مع طبيب الأطفال"

---

## Batch 6: School Health Records (3 files)

1. **`POST /api/doctor/school-health`** — Doctor creates school health record
2. **`apps/web/components/doctor/SchoolHealthForm.tsx`** — Structured form (exam fields, fitness assessment, certificate generation)
3. **School health page** (web) — `/ar/child/[id]/school` + `/en/child/[id]/school`
   - Shows exam history with 🏫 icon
   - Certificate PDF download

---

## Batch 7: Paediatric Dose Calculator (3 files)

1. **`GET /api/doctor/paediatric-dose`** — Query: drug name, weight_kg, age_months → returns calculated dose range + Egyptian formulations
2. **`apps/web/components/doctor/PaediatricDoseCalculator.tsx`** — Side panel showing dose formula, calculated range, formulations, "نسخ للروشتة" button
3. **Integration with PrescriptionForm** — When patient is paediatric, show calculator button. "Copy to prescription" auto-fills dose/frequency fields.

---

## Batch 8: Child Medical Record Dashboard + Add Child Flow UI (6 files)

1. **`apps/web/components/paediatric/ChildMedicalRecordDashboard.tsx`** — Extended dashboard for paediatric patients showing growth summary, vaccination progress, milestone status, school health, allergies
2. **`apps/web/app/ar/child/add/page.tsx`** + `/en/child/add/page.tsx` — 3-step add child flow
3. **MedicalRecordDashboard modification** — Detect is_paediatric and render ChildMedicalRecordDashboard
4. **Mobile child screens** — React Native equivalents (separate implementations)

---

## Batch 9: Triage Integration + Profile Switcher Polish (3 files)

1. **Triage prompt update** — When child profile selected, inject child context into system prompt (age in months, paediatric flag, different urgency thresholds)
2. **Profile switcher** — finalize on web (TopBar dropdown) and mobile (horizontal chip row)
3. **Navigation guards** — Ensure all child routes verify guardian relationship

---

## Batch 10: Verification
- Apply migration 048 to Supabase
- Verify all seeded data (14 vaccines, ~25 milestones, 8 drugs, WHO reference)
- TypeScript check: 0 new errors in web, admin, mobile
- Tests pass
- Manual checks:
  - Add child flow works end-to-end
  - Growth chart renders with percentile bands
  - Vaccination schedule auto-generated from DOB
  - Certificate PDF generates
  - Milestone red flags display with reassuring language
  - Dose calculator: Amoxicillin 18.5kg → 247–308mg/dose × 3
  - Bilingual: all pages have AR + EN routes

---

## Key Design Decisions

1. **Each child = separate `patients` row** — reuses all existing infrastructure (bookings, health records, prescriptions) without modification
2. **Guardian relationship table** — supports future multi-guardian scenarios without current complexity
3. **WHO data in database** — not hardcoded, allows updates without code changes
4. **Vaccination schedule auto-generation** — on child creation, populates all future vaccine dates from DOB + schedule_months
5. **Dose calculator shows formula** — doctors must see mg/kg calculation to verify, not just the answer
6. **Non-alarming milestone language** — parents are anxious; always reassuring, always directs to paediatrician

## Total: ~40 new files, ~10 modified files
