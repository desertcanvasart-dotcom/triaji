# Phase 27 — Lab Chain Integrations: Implementation Plan

## Overview
API adapters for Al-Borg, Al-Mokhtabar, and Alfa lab chains — digital order routing, appointment booking, automatic result retrieval, and payment integration. Contract-ready adapters with automatic manual fallback when API is unavailable. Same adapter pattern as HIS (Phase 9) and insurance (Phase 21).

**Two-layer approach:**
- **Layer A**: Complete adapter implementations (build now) — correct interface, auth, error handling, fallback
- **Layer B**: Env var gated — returns `isConfigured() = false` until contracts signed and credentials set

---

## Batch 1: Migration 050 + Lab Chain Adapter Package + Types + i18n (~15 files)

1. **`supabase/migrations/050_lab_chains.sql`**
   - `lab_chains` table — seeded with Al-Borg (200 branches), Al-Mokhtabar (150), Alfa (80), all `has_api = false`
   - `lab_chain_branches` table — PostGIS POINT for location, working hours, walk-in/home collection flags
   - `lab_chain_test_mapping` table — maps Triaji codes to chain codes (empty until contract)
   - `lab_chain_webhooks` table — webhook audit log
   - `lab_order_routing` ALTER: add chain_code, chain_order_id, chain_branch_id, chain_branch_name_ar, api_submission_at, api_error_count, last_api_error, manual_fallback_active
   - `find_nearest_chain_branches()` PostGIS RPC
   - `lab_chains.payment_via_triaji` column (default true)
   - Indexes + RLS

2. **`packages/lab-chain-adapters/`** — new package
   - `interface.ts` — LabChainAdapter interface (isConfigured, submitOrder, getAvailableSlots, bookAppointment, getResults, initiatePayment, verifyWebhook)
   - `factory.ts` — LabChainCode type, getLabChainAdapter(), isChainApiAvailable()
   - `adapters/alborg.ts` — Al-Borg: Bearer token auth, HMAC signature, test code map (placeholders), all 6 methods with graceful failure
   - `adapters/almokhtabar.ts` — Al-Mokhtabar: same pattern, different URL/key structure
   - `adapters/alfa.ts` — Alfa: same pattern
   - All three: `isConfigured()` checks env vars → false when empty

3. **`packages/shared/types/lab-chain.ts`** — LabChain, LabChainBranch, LabChainTestMapping, LabChainCode types
4. **`packages/shared/i18n/strings.ts`** — `labChain` section (~12 AR+EN strings)
5. **`.env.example`** — 12 lab chain env vars (all empty)

---

## Batch 2: Order Routing with Chain Detection (3 files)

1. **`apps/web/lib/lab/route-order.ts`** (modified)
   - `routeLabOrder()` checks if selected lab is a chain → if API available, use `routeViaChainApi()`, else manual
   - `routeViaChainApi()`: builds order → calls adapter.submitOrder() → updates lab_order_routing with chain data
   - On API failure: logs error, activates manual fallback, notifies doctor via WhatsApp, continues with manual routing

2. **`apps/web/lib/lab/chain-notifications.ts`** (new)
   - `notifyDoctorApiFallback(routingId, chainCode)` — bilingual WhatsApp explaining API fell back to manual
   - `notifyPatientChainBooking(phone, lang, data)` — chain booking confirmation
   - `notifyPatientChainResults(phone, lang, data)` — results ready from chain

3. **`apps/web/lib/lab/process-chain-results.ts`** (new)
   - `processChainResults(routingId, chainResult)` — maps chain results to Triaji format, creates health_records, generates Arabic summary via Claude, updates routing status, notifies doctor + patient, extracts vitals

---

## Batch 3: Chain Webhooks + Result Polling (5 files)

1. **`POST /api/webhooks/lab-chain/alborg/route.ts`** — verifies AlBorg webhook signature, logs to lab_chain_webhooks, calls processChainResults()
2. **`POST /api/webhooks/lab-chain/almokhtabar/route.ts`** — same for Al-Mokhtabar
3. **`POST /api/webhooks/lab-chain/alfa/route.ts`** — same for Alfa
4. **`GET /api/cron/lab-chain-results/route.ts`** — 2-hour polling cron: finds pending chain orders, calls adapter.getResults(), processes if ready
5. **`GET /api/cron/lab-chain-sync/route.ts`** — daily sync cron: can pull branch updates from chains (when API available)

---

## Batch 4: Chain-Aware Appointment Booking (3 files)

1. **`GET /api/lab/chains/[code]/slots/route.ts`** — calls adapter.getAvailableSlots() with patient location + preferred date. Returns slots with branch info + distance. Auth: patient.
2. **`POST /api/lab/chains/[code]/book/route.ts`** — calls adapter.bookAppointment(). Creates lab_appointments record. Sends WhatsApp confirmation. Auth: patient.
3. **Modify lab booking page** (`apps/web/components/lab/LabBookingPage.tsx`) — when chain API available, show real-time branch slots instead of generic time picker. Fallback: show generic picker + "سيتواصل معك المعمل لتأكيد الموعد"

---

## Batch 5: Branch Discovery + Lab Profile Enhancement (4 files)

1. **`GET /api/lab/chains/[code]/branches/route.ts`** — calls find_nearest_chain_branches() RPC with patient lat/lng. Returns branches sorted by distance.
2. **`apps/web/components/lab/ChainBranchFinder.tsx`** (new) — bilingual component showing nearest branches with distance, hours, phone, home collection badge, "Book here" button. Uses browser geolocation API.
3. **Branch pages:** `/ar/lab/[slug]/branches/page.tsx` + `/en/lab/[slug]/branches/page.tsx`
4. **Modify LabProfilePage** — for chain labs, show branch finder section

---

## Batch 6: Platform Admin — Chain Management (5 files)

1. **`GET/PUT /api/admin/chains/route.ts`** — list chains, update config
2. **`POST /api/admin/chains/[code]/test/route.ts`** — test API credentials (calls adapter.submitOrder with test payload)
3. **`POST /api/admin/chains/[code]/import-branches/route.ts`** — bulk CSV import of branches with geocoding
4. **`POST /api/admin/chains/[code]/import-tests/route.ts`** — bulk import test code mappings
5. **`apps/admin/app/(platform)/chains/page.tsx`** — Chain management page (English only, platform_admin):
   - 3 chain cards: name, API status (green/yellow/red), branch count, monthly orders
   - "Add API credentials" form
   - "Test API" button
   - "Import branches" CSV upload
   - "Import test mapping" CSV upload

---

## Batch 7: Verification
- TypeScript: 0 new errors
- Tests pass
- Manual checks:
  - With empty env vars: all orders use manual flow (Phase 17 unchanged)
  - isConfigured() returns false for all 3 chains
  - Factory returns correct adapter
  - find_nearest_chain_branches() RPC works with test data
  - Webhook signature verification rejects invalid payloads
  - Chain management page loads for platform_admin
  - Fallback notification WhatsApp sent in patient's language

---

## Key Architectural Decisions

1. **Env-var gating**: `isConfigured()` checks env vars → no code change needed when contract signed, just set credentials
2. **Never block**: if API fails at any point, manual fallback activates silently — doctor and patient never blocked
3. **Audit everything**: lab_chain_webhooks logs every incoming webhook, api_error_count tracks failures
4. **Same result format**: chain API results mapped to identical health_records format as manual uploads — patient sees no difference
5. **Payment via Triaji default**: uses Phase 26 payment gateway, not chain's own payment — simplifies settlement
6. **PostGIS for branches**: real distance-based nearest-branch discovery, same pattern as ICU beds (Phase 22)

## Total: ~35 new files, ~8 modified files
