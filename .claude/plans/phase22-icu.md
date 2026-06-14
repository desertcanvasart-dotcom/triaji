# Phase 22 — ICU Bed Availability System — Implementation Plan

## Overview

Real-time ICU bed tracking across Triaji-registered hospitals, with geospatial search for verified doctors and emergency transfer requests. 6 deliverables, structured as 7 implementation batches.

---

## Batch 1 — Migration + Types + i18n (Foundation)

### Migration: `supabase/migrations/045_icu_registry.sql`
- `icu_unit_type` enum (8 types: general, cardiac, neonatal, paediatric, surgical, neurological, burns, respiratory)
- `icu_update_source` enum (manual, his_sync)
- `icu_units` table — per-hospital ICU unit registry with capacity, availability, HIS sync fields
- `icu_availability_log` — audit log for every bed count change
- `transfer_status` enum (requested → acknowledged → accepted → declined → en_route → arrived → cancelled)
- `icu_transfer_requests` — formal transfer request between doctors and hospitals
- `find_icu_beds_near` RPC — PostGIS geospatial search (reuses `tenant_config.location` + `ST_DWithin`)
- `icu_coordinator` role added to `admin_users_role_check` constraint
- Realtime enabled: `ALTER PUBLICATION supabase_realtime ADD TABLE icu_units`
- RLS: hospital staff write own units, verified doctors read all active units cross-tenant
- Indexes on: tenant_id, unit_type, available_beds, transfer status

### Types: `packages/shared/types/icu.ts`
- `IcuUnitType`, `IcuUpdateSource`, `TransferStatus` enums
- `IcuUnit`, `IcuAvailabilityLogEntry`, `IcuTransferRequest` interfaces
- `IcuSearchResult` (from RPC return type)

### Types export: `packages/shared/types/index.ts`
- Add ICU type re-exports

### i18n: `packages/shared/i18n/strings.ts`
- Add `icu` section with ~30 AR+EN keys (page titles, bed status, transfer flow, unit type names)

**Files: 4 created/modified**

---

## Batch 2 — Auth + Admin Layout (Hospital Admin)

### Auth expansion: `apps/admin/lib/auth/types.ts`
- Add `'icu_coordinator'` to AdminRole union
- Add `isIcuHospitalRole()` — returns true for `tenant_admin`, `tenant_manager`, `icu_coordinator`
- Add `getIcuRedirect()` — icu_coordinator → `/icu/beds`, tenant_admin → `/icu/setup`
- Add badge: `icu_coordinator` → { label: 'ICU', className: 'bg-red-100 text-red-700' }

### Middleware: `apps/admin/middleware.ts`
- Add `ICU_ROLES` constant (includes tenant_admin, tenant_manager, icu_coordinator)
- Add ICU route detection: `/icu/` and `/api/admin/icu/`
- icu_coordinator redirected from non-ICU routes

### Login: `apps/admin/app/login/page.tsx`
- Add ICU redirect check

### API auth: `apps/admin/lib/auth/api-auth.ts`
- Add `requireIcuAccess()` function

### Layout: `apps/admin/app/icu/layout.tsx`
- Server component, checks `isIcuHospitalRole()` or `isPlatformAdmin()`

### No separate sidebar — ICU routes use the existing hospital sidebar (tenant admin)
- Add ICU nav items to existing `Sidebar.tsx` conditional on tenant having ICU enabled
- Items: 🏥 ICU Setup → `/icu/setup`, 🛏️ ICU Beds → `/icu/beds`, 🚨 Transfers → `/icu/transfers`

### Placeholder pages (4):
- `/icu/setup/page.tsx`
- `/icu/beds/page.tsx`
- `/icu/transfers/page.tsx`
- `/icu/overview/page.tsx` (platform_admin only)

**Files: ~10 created/modified**

---

## Batch 3 — Hospital ICU Admin APIs (Deliverables 1 + 2)

### API routes in `apps/admin/app/api/admin/icu/`:

1. `units/route.ts`
   - GET: list hospital's ICU units (scoped to tenant_id)
   - POST: create new ICU unit (capacity, type, floor, phone, accepts_transfers)

2. `units/[id]/route.ts`
   - PUT: update unit details (name, floor, phone, accepts_transfers, is_active)

3. `units/[id]/beds/route.ts`
   - PUT: update available bed count
   - Body: `{ available_beds, change_reason }`
   - Validates: available_beds >= 0 && available_beds <= total_beds
   - Logs to `icu_availability_log`
   - Supabase Realtime broadcasts automatically via the UPDATE

4. `transfers/route.ts`
   - GET: list incoming transfer requests for this hospital (scoped to receiving_tenant_id)

5. `transfers/[id]/route.ts`
   - PUT: update transfer status (acknowledge, accept, decline)
   - On accept: decrement available_beds by 1, log, send WhatsApp to requesting doctor
   - On decline: send WhatsApp with reason to requesting doctor
   - Body varies: accept → `{ bed_assigned_ar, receiving_contact_phone }`, decline → `{ decline_reason_ar }`

**Files: 5 created**

---

## Batch 4 — Hospital ICU Admin UI (Deliverables 1 + 2)

### Components in `apps/admin/components/icu/`:

1. `IcuSetupWizard.tsx` — 3-step wizard
   - Step 1: checklist of 8 ICU types
   - Step 2: for each selected type → name, total beds, floor, phone, accepts_transfers
   - Step 3: confirmation + activate
   - POST to `/api/admin/icu/units` for each unit

2. `IcuBedManager.tsx` — daily working screen for ICU staff
   - Lists all hospital's ICU units as cards
   - Each card: unit name, bed visual (filled/empty dots), [−] [+] buttons
   - Change reason dropdown on increment/decrement
   - PUT to `/api/admin/icu/units/[id]/beds`
   - Supabase Realtime subscription for live updates
   - "آخر تحديث" timestamp per unit
   - "تحديث الكل الآن" button

3. `IcuTransferInbox.tsx` — incoming transfer requests
   - Real-time list (Supabase Realtime on `icu_transfer_requests`)
   - Status badges: requested (red pulse), acknowledged (yellow), accepted (green), en_route (blue)
   - Accept form: bed assignment text + contact phone
   - Decline form: reason text

4. Update all 3 placeholder pages to use components

**Files: 4 created, 3 modified**

---

## Batch 5 — Doctor-Facing ICU Search + Transfer (Deliverables 4 + 5)

### Doctor API routes in `apps/web/app/api/icu/`:

1. `search/route.ts`
   - GET: calls `find_icu_beds_near` RPC
   - Params: lat, lng, unit_type (optional), radius_km (default 50)
   - Auth: verified doctor account only

2. `transfer/route.ts`
   - POST: create transfer request
   - Body: patient info + clinical summary + urgency + icu_unit_id
   - Calculates estimated_eta_minutes from distance
   - Sends WhatsApp to receiving hospital's icu_coordinator (bilingual)
   - Auth: verified doctor

3. `transfer/[id]/route.ts`
   - GET: get transfer status (for tracking page)
   - PUT: doctor updates status (en_route, cancelled)
   - Auth: requesting doctor only

### Doctor-facing components in `apps/web/components/icu/`:

1. `IcuSearchPage.tsx` — shared component, `lang` prop
   - Location input: "📍 موقعي الحالي" (browser geolocation) or manual address
   - Unit type filter pills (All + 8 types)
   - Results list with colour coding (green/yellow/red/grey)
   - Each result: hospital name, distance, unit type, beds, last updated, phone, "طلب تحويل" button
   - Supabase Realtime subscription on `icu_units` for live bed count updates
   - Flash animation when count changes

2. `IcuTransferForm.tsx` — modal/sheet, `lang` prop
   - Patient info: name, age, sex, phone
   - Clinical: diagnosis, summary, urgency (urgent/emergency)
   - Emergency callout: "اتصل بالمستشفى مباشرة أولاً" with phone number
   - Current location text input

3. `IcuTransferTracker.tsx` — live status tracker, `lang` prop
   - Step indicator: requested → acknowledged → accepted → en_route → arrived
   - Hospital info + bed assignment + contact phone
   - "المريض في الطريق" button, "إلغاء" button
   - Supabase Realtime subscription on `icu_transfer_requests`

### Route files:
- `apps/web/app/ar/icu/page.tsx` → `<IcuSearchPage lang="ar" />`
- `apps/web/app/en/icu/page.tsx` → `<IcuSearchPage lang="en" />`
- `apps/web/app/ar/icu/transfer/[id]/page.tsx` → `<IcuTransferTracker lang="ar" />`
- `apps/web/app/en/icu/transfer/[id]/page.tsx` → `<IcuTransferTracker lang="en" />`

### WhatsApp notifications: `apps/web/lib/icu/notifications.ts`
- `sendTransferRequestNotification(phone, lang, data)` — to hospital
- `sendTransferAcceptedNotification(phone, lang, data)` — to doctor
- `sendTransferDeclinedNotification(phone, lang, data)` — to doctor
- All bilingual (AR + EN)

**Files: ~14 created**

---

## Batch 6 — HIS Sync + Emergency Engine Upgrade (Deliverables 3 + 6)

### HIS adapter extension: `packages/his-adapters/src/interface.ts`
- Add optional `getIcuAvailability?(): Promise<HisIcuAvailability[]>`
- Add `HisIcuAvailability` interface
- Stub implementations in Shifa + Neuron adapters (return empty array)

### Cron: `apps/web/app/api/cron/icu-his-sync/route.ts`
- Runs every 15 minutes
- For each tenant with HIS + icu_units with update_source='his_sync':
  - Call adapter.getIcuAvailability()
  - Match by his_unit_id → update available_beds if changed
  - Log to icu_availability_log
- Secured by CRON_SECRET

### Emergency engine: `packages/rules-engine/src/emergency.ts`
- **DO NOT modify** existing `checkEmergency()` function
- Add new async wrapper: `checkEmergencyWithICU(input, patientLocation?, icuUnitType?)`
- If emergency triggered + location provided → query `find_icu_beds_near`
- Return `EmergencyResult` extended with `nearbyIcuBeds: IcuSearchResult[]` (top 3)

### Emergency tests: `packages/rules-engine/tests/emergency.test.ts`
- Add test group for `checkEmergencyWithICU`
- Verify original `checkEmergency` tests still pass unchanged
- Test: emergency + location → nearbyIcuBeds populated
- Test: emergency + no location → no ICU data
- Test: non-emergency → no ICU query

**Files: ~6 created/modified**

---

## Batch 7 — Platform Admin ICU Overview + Verification

### Component: `apps/admin/components/icu/IcuNationalOverview.tsx`
- Aggregate stats: total beds registered, available now, occupancy %
- Regional breakdown table (governorate groups)
- Colour coding by occupancy pressure (green < 70%, yellow 70-85%, red > 85%)
- Real-time via Supabase Realtime on icu_units

### API: `apps/admin/app/api/admin/icu/overview/route.ts`
- GET: aggregate ICU stats across all tenants
- Auth: platform_admin only

### Update `/icu/overview/page.tsx` to use IcuNationalOverview

### Add ICU link to doctor dashboard:
- Edit `apps/web/components/doctor/DoctorDashboard.tsx`
- Add "🏥 العناية المركزة" card linking to `/ar/icu` or `/en/icu`

### TypeScript verification:
- `pnpm --filter @triaji/admin exec tsc --noEmit`
- `pnpm --filter @triaji/web exec tsc --noEmit`
- `pnpm --filter @triaji/rules-engine test`

**Files: ~5 created/modified**

---

## Summary

| Batch | Deliverable | Files | Key Output |
|-------|------------|-------|------------|
| 1 | Foundation | 4 | Migration 045, types, i18n |
| 2 | Auth + Layout | 10 | icu_coordinator role, route guards, placeholders |
| 3 | Hospital APIs | 5 | CRUD units, bed updates, transfer management |
| 4 | Hospital UI | 7 | Setup wizard, bed manager, transfer inbox |
| 5 | Doctor Search + Transfer | 14 | Search page (AR+EN), transfer form + tracker, WhatsApp |
| 6 | HIS Sync + Emergency | 6 | Cron sync, async emergency wrapper |
| 7 | Platform Overview + Verify | 5 | National dashboard, TS verification |
| **Total** | | **~51** | |

## Key Architectural Decisions

1. **No separate sidebar** — ICU routes added to existing hospital `Sidebar.tsx` as a conditional section (tenant must have ICU enabled). This avoids creating a 6th sidebar for what is a hospital-level feature, not a separate tenant type.

2. **icu_coordinator is NOT a separate tenant type** — it's a role within existing hospital tenants (`tenant_admin`, `tenant_manager` already have access). Only `icu_coordinator` is new (for charge nurses).

3. **PostGIS reuse** — `find_icu_beds_near` RPC uses existing `tenant_config.location` column (already populated for hospital tenants). No new geography tables needed.

4. **Realtime reuse** — same Supabase channel pattern as `use-queue-realtime.ts` for clinic queues.

5. **Emergency engine untouched** — `checkEmergency()` stays pure + synchronous. New `checkEmergencyWithICU()` is a separate async wrapper.

6. **Transfer requests don't decrement beds** — only acceptance does. This prevents phantom bed reservations.

7. **Bilingual throughout** — all doctor-facing pages have `/ar/` + `/en/` equivalents with shared components.
