# Phase 29 — Multi-Branch / Chain Model: Implementation Plan

## Overview
Chains table sitting above tenants — multiple branch tenants grouped under one chain owner. Shared doctors, patient recognition, pricing catalog, and consolidated analytics. Critical constraint: existing single-location tenants (chain_id=NULL) completely unaffected.

---

## Batch 1: Migration 052 + Types + i18n (~5 files)

1. **`supabase/migrations/052_chains.sql`**
   - `chain_type` enum (clinic_chain, lab_chain, radiology_chain, pharmacy_chain, mixed)
   - `chains` table — name, type, owner_account_id, config flags (shared_pricing, shared_patient_records), branding
   - `tenants` ALTER: add chain_id FK (nullable!), branch_name_ar/en, branch_number
   - `admin_users` role constraint: add chain_owner + branch_manager
   - `admin_users` ALTER: add chain_id, branch_tenant_id columns
   - `chain_pricing` table — service type/code/name, price, urgent price, branch exceptions, effective_from
   - `chain_patient_registry` table — patient recognition across branches (chain_id + patient_id unique)
   - `doctor_branch_assignments` table — doctor works at multiple branches with per-branch schedule JSONB
   - Indexes on all chain/branch FKs + RLS

2. **`packages/shared/types/chain.ts`** (new)
   - ChainType, Chain, ChainPricing, ChainPatientRegistry, DoctorBranchAssignment types

3. **`packages/shared/types/index.ts`** (modified) — re-exports

4. **`packages/shared/i18n/strings.ts`** (modified) — `chain` section (~30 AR+EN strings: chainDashboard, branches, addBranch, branchName, sharedPricing, chainPatients, branchPerformance, copySettings, assignDoctor, etc.)

---

## Batch 2: Auth + Chain Admin Layout + APIs (~15 files)

1. **Auth expansion:**
   - `types.ts`: add chain_owner, branch_manager to AdminRole, isChainRole(), getChainRedirect()
   - `middleware.ts`: add CHAIN_ROLES, /chain/ route access control, branch_manager redirect to their branch's admin
   - `login/page.tsx`: add chain redirect
   - `api-auth.ts`: add requireChainAccess()

2. **Chain sidebar:** `apps/admin/components/chain/ChainSidebar.tsx`
   - Accent colour: teal-700 (chain management is platform-level)
   - Nav: Dashboard, Branches, Doctors, Patients, Pricing, Analytics, Settings

3. **Chain layout:** `apps/admin/app/chain/layout.tsx` — validates chain_owner

4. **Chain APIs (8 routes):**
   - `POST/GET/PUT /api/chain` — CRUD
   - `POST/GET /api/chain/[id]/branches` — add branch (creates tenant with chain_id), list with stats
   - `GET/POST /api/chain/[id]/doctors/assign` — list chain doctors, assign to branches
   - `PUT /api/chain/[id]/doctors/[doctorId]/schedule` — update cross-branch schedule
   - `GET/POST/PUT /api/chain/[id]/pricing` — pricing CRUD with branch exceptions
   - `GET /api/chain/[id]/patients` — chain-wide patient list
   - `GET /api/chain/[id]/analytics` — consolidated stats
   - `GET /api/chain/[id]/analytics/compare` — branch comparison

---

## Batch 3: Chain Admin UI — Dashboard + Branches (~8 files)

1. **`/chain/dashboard/page.tsx`** — ChainDashboard component:
   - 4 stat cards (total patients, today's patients, monthly revenue, avg wait time)
   - Branch status cards (green active / red closed, patient count, doctor count, wait time)
   - Revenue bar chart (recharts, per branch per week)
   - New patients line chart

2. **`/chain/branches/page.tsx`** — Branch list with status, doctor count, last activity
3. **`/chain/branches/new/page.tsx`** — Add branch wizard (3 steps: identity, copy settings, assign doctors)
4. **`/chain/branches/[branchId]/page.tsx`** — Branch detail: links to that branch's existing admin panel

---

## Batch 4: Shared Doctors + Shared Patients (~6 files)

1. **`/chain/doctors/page.tsx`** — Chain-wide doctor roster:
   - All doctors across all branches
   - Per-doctor: which branches assigned, schedule per branch
   - "Assign to branch" action
   - "Edit schedule" action

2. **`/chain/patients/page.tsx`** — Chain-wide patient list:
   - From chain_patient_registry
   - Shows: name, first seen, total visits, branches visited, last visit
   - Search + filter

3. **Shared patient recognition integration:**
   - Modify booking flow: when patient books at any chain branch, upsert chain_patient_registry
   - Modify reception/queue: when loading patient, check chain_patient_registry for cross-branch history
   - Show "مريض معروف — عيادات الأندلس منذ يناير 2026" badge

---

## Batch 5: Shared Pricing + Analytics (~6 files)

1. **`/chain/pricing/page.tsx`** — Pricing catalog:
   - Service type tabs (consultation, lab, procedure)
   - Add/edit price with branch exception support
   - "Export PDF" button

2. **Pricing integration:**
   - Modify invoice creation: if tenant belongs to chain with shared_pricing=true, load chain_pricing and pre-fill
   - Branch exception check before fallback to shared price
   - Manual override still allowed

3. **`/chain/analytics/page.tsx`** — Consolidated analytics:
   - Period selector (month/week/all)
   - Per-branch revenue cards with % change
   - Stacked bar chart (patients per branch per week)
   - Doctor performance table
   - Peak hours heatmap
   - Branch comparison table
   - Export PDF/Excel

4. **`/chain/settings/page.tsx`** — Chain settings: name, branding, shared_pricing toggle, shared_patient_records toggle

---

## Batch 6: Patient-Facing Chain Page (AR+EN) + Branch Manager (~4 files)

1. **`apps/web/app/ar/chain/[chainSlug]/page.tsx`** + **`/en/chain/[chainSlug]/page.tsx`**
   - Public page showing chain info + all branches
   - Branches sorted by distance (geolocation)
   - Each branch: name, address, hours, "Book appointment" link to existing branch booking page
   - Bilingual via lang prop

2. **Branch manager routing:**
   - branch_manager login → redirect to their specific branch's admin (clinic/lab/pharmacy dashboard)
   - Same access as clinic_owner but scoped to one branch
   - Cannot modify chain pricing or doctor assignments

---

## Batch 7: Verification
- TypeScript: 0 new errors
- Tests pass
- Critical checks:
  - Existing single-location tenants: chain_id=NULL, all flows unchanged
  - Chain creation: creates chains row + first branch tenant
  - Second branch: creates tenant with same chain_id
  - Shared doctor: appears in booking at both branches
  - Shared patient: recognised at branch B after visiting branch A
  - Shared pricing: pre-fills invoice at all branches, exception overrides
  - Analytics: cross-branch totals correct
  - Branch manager: scoped to one branch, no chain-level access
  - /ar/chain/[slug]: renders with branches sorted by distance

---

## Key Architectural Decisions

1. **Additive, not migratory**: chain_id is nullable — existing tenants unaffected, no data migration
2. **Each branch = full tenant**: branches are regular tenants with all existing functionality intact — chain is an overlay, not a replacement
3. **Shared pricing is optional**: `shared_pricing` flag controls whether chain prices apply — can be turned off per chain
4. **Branch manager = scoped clinic_owner**: same admin panel, just restricted to one branch
5. **Patient recognition is chain-scoped**: cross-branch visibility only within the same chain — never across chains or independent providers
6. **Financial isolation**: branch staff cannot see other branches' billing — analytics are chain_owner only

## Colour system update:
| Tenant Type | Accent |
|---|---|
| Platform | teal-600 |
| Clinic | indigo-700 |
| Lab | emerald-700 |
| Pharmacy | purple-700 |
| Insurance | amber-700 |
| Chain | teal-700 |

## Total: ~45 new files, ~10 modified files
