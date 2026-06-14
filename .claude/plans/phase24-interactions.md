# Phase 24 — Medication Interaction Checking: Implementation Plan

## Overview
Drug interaction safety system using local curated database + RxNorm/OpenFDA API fallback. Tiered alert system (contraindicated → major → moderate → minor) integrated into prescription writing (web + mobile), pre-consultation view, patient medical records, and GP dashboard.

---

## Batch 1: Migration + Shared Types + i18n Strings
**Files: 3 new, 1 modified**

1. **`supabase/migrations/046_medication_interactions.sql`** (new, already exists — verify/use)
   - `interaction_severity` enum (contraindicated, major, moderate, minor)
   - `drug_interactions` table — 20 seeded Egyptian-context interactions
   - `interaction_check_log` table — audit log for every check
   - Indexes on drug names, severity, patient, doctor

2. **`packages/shared/types/interactions.ts`** (new)
   - `InteractionSeverity`, `InteractionResult`, `CheckResult` types
   - Shared between web and mobile

3. **`packages/shared/types/index.ts`** (modified)
   - Re-export interactions types

4. **`packages/shared/i18n/strings.ts`** (modified)
   - Add `interactions` section with all 20+ AR+EN string pairs

---

## Batch 2: Drug Resolution + Interaction Checking Service
**Files: 4 new**

1. **`apps/web/lib/interactions/resolve-drug.ts`** (new)
   - `resolveDrugToRxCUI(nameAr, nameEn)` — resolution chain:
     1. Check `medication_catalog` for generic_name_en
     2. Use drug_name_en directly if available
     3. Fall back to RxNorm API lookup
   - Returns `{ rxcui, resolvedName } | null`

2. **`apps/web/lib/interactions/openfda.ts`** (new)
   - `checkOpenFDA(drugAName, drugBName)` — query OpenFDA drug/label endpoint
   - `parseInteractionWithClaude(fdaText, drugA, drugB)` — Claude extracts severity from FDA label text
   - `translateInteractionToArabic(result)` — adds AR translations

3. **`apps/web/lib/interactions/cache.ts`** (new)
   - `cacheInteraction(result)` — save API result to `drug_interactions` with `source='openfda'`
   - Prevents re-calling API for same drug pair

4. **`apps/web/lib/interactions/checker.ts`** (new)
   - `checkDrugInteractions(newDrug, existingDrugs)` → `CheckResult`
   - Check order: local DB first → OpenFDA fallback → cache result
   - Bidirectional check (A↔B)
   - Aggregate all interactions, determine highest severity
   - Graceful degradation: if API unavailable, return local-only results

---

## Batch 3: Interaction Check API Route
**Files: 1 new**

1. **`apps/web/app/api/interactions/check/route.ts`** (new)
   - POST: `{ newDrug: { nameAr, nameEn }, existingDrugs: [{ nameAr, nameEn }], patientId, doctorAccountId }`
   - Calls `checkDrugInteractions()`
   - Logs to `interaction_check_log`
   - Returns `CheckResult`
   - Auth: doctor session required
   - Privacy: only sends generic drug names to external APIs, never patient data

---

## Batch 4: Web UI — InteractionAlert + InteractionBadge
**Files: 2 new**

1. **`apps/web/components/doctor/InteractionAlert.tsx`** (new)
   - Props: `{ interactions, lang, onRemoveDrug, onOverride, onAcknowledge }`
   - Bilingual (AR+EN via `t()`)
   - Three visual tiers:
     - **Contraindicated/Major**: Red banner, blocks save, override reason text area required, "إزالة الدواء" + "متابعة مع التوثيق" buttons
     - **Moderate**: Yellow banner, non-blocking, acknowledgement checkbox, confirmation dialog if not acknowledged before save
     - **Minor**: Small info badge inline, no action required
   - Shows: mechanism, consequence, recommendation, Egypt note (if present)

2. **`apps/web/components/doctor/InteractionBadge.tsx`** (new)
   - Small inline badge for medication rows showing interaction count/severity
   - Props: `{ severity, drugPair, lang }`

---

## Batch 5: Prescription Form Integration (Web)
**Files: 2 modified**

1. **`apps/web/components/doctor/PrescriptionForm.tsx`** (modified)
   - On drug name field blur: call `/api/interactions/check` with new drug + patient's existing medications + other drugs in current prescription
   - Show `InteractionAlert` below the drug row that triggered it
   - Disable "حفظ وإرسال" button if any contraindicated/major without override
   - Track override reasons per interaction
   - Pass acknowledged/override data with save request

2. **`apps/web/app/api/doctor/clinical-document/route.ts`** (modified)
   - Final interaction check before saving prescription
   - If contraindicated/major without override reason → return 409
   - Log all interactions to `interaction_check_log` with doctor response
   - Save prescription as normal if checks pass

---

## Batch 6: Pre-Consultation View Integration
**Files: 2 modified**

1. **`apps/web/components/doctor/PreConsultationView.tsx`** (modified)
   - On load: run interaction check across patient's `patient_medications`
   - If interactions found: show informational banner at top
   - Non-blocking — just alerts doctor to existing issues before they write anything

2. **`apps/mobile/app/(doctor)/consultation/[bookingId].tsx`** (modified)
   - Same banner: check patient medications for known interactions on load

---

## Batch 7: Patient Medical Record View
**Files: 2 modified**

1. **`apps/web/app/ar/medical-record/page.tsx`** (modified)
   - Add interaction indicator to medications section
   - Simplified patient-facing text: non-alarming, always ends with "تحدث مع طبيبك"
   - Link to detail view

2. **`apps/web/app/en/medical-record/page.tsx`** (modified)
   - Same, English version

---

## Batch 8: Doctor Dashboard GP Alerts
**Files: 2 modified**

1. **`apps/web/app/ar/doctor/dashboard/page.tsx`** (modified)
   - New section: "تنبيهات دوائية لمرضاك"
   - Only visible for doctors with active GP relationships (Phase 20)
   - Lists patients whose current medications have known interactions
   - Severity badge + "عرض السجل" / "تواصل فوراً" actions

2. **`apps/web/app/en/doctor/dashboard/page.tsx`** (modified)
   - Same section, English

---

## Batch 9: Mobile — InteractionAlert Component + PrescriptionForm
**Files: 2 new, 1 modified**

1. **`apps/mobile/lib/interactions/checker.ts`** (new)
   - Calls web API `/api/interactions/check` (same backend)
   - Mobile-compatible wrapper

2. **`apps/mobile/components/InteractionAlert.tsx`** (new)
   - React Native version of the alert (ScrollView, bilingual)
   - Same tiered behaviour: blocking for critical/major, warning for moderate, info for minor

3. **`apps/mobile/app/(doctor)/consultation/[bookingId].tsx`** (modified — already in Batch 6)
   - Add interaction checking to the simplified prescription form
   - Show InteractionAlert below drug input on blur

---

## Batch 10: Verification
- Run `pnpm test` — all tests pass
- Run `pnpm --filter @triaji/admin exec tsc --noEmit` — 0 errors
- Run `pnpm --filter @triaji/web exec tsc --noEmit` — 0 errors
- Verify: Warfarin + Aspirin → contraindicated (local DB)
- Verify: Clopidogrel + Omeprazole → major (local DB)
- Verify: Unknown pair → OpenFDA fallback
- Verify: API unavailable → graceful degradation

---

## Key Architectural Decisions

1. **Local DB first, API fallback** — fast for common interactions, comprehensive for rare ones
2. **Cache API results** — reduces external calls, improves latency over time
3. **Claude parses FDA label text** — because OpenFDA returns unstructured label text, not structured severity
4. **Privacy-first** — only generic drug names sent to external APIs, never patient IDs or names
5. **Alert fatigue prevention** — minor = info only, no blocking, no acknowledgement
6. **Audit trail** — every check logged with doctor response for safety compliance

## Total: ~15 new files, ~8 modified files
