# Data Model

The Postgres/Supabase schema, built across **65 ordered migrations** in
[`supabase/migrations/`](../supabase/migrations/) (run `001` … `065` in numeric order — check the
directory for the current highest number). Multi-tenant
and Arabic-first. This is a reference map, not every column — see the migrations for exact DDL, and
**verify against the live DB** when in doubt (some columns have drifted from the migrations).

## Tables by domain

### Tenancy & config
- **tenants** — top-level org (hospital, clinic, lab, pharmacy, insurer). `slug` (unique), `tier`
  (`tenant_tier`: platform/basic/premium/clinic/lab/radiology/pharmacy/insurance), `is_active`,
  `chain_id → chains`, branch fields.
- **tenant_config** — 1:1 per-tenant branding + feature settings (unique `tenant_id`): booking mode,
  governorate, widget domains, phone-line fields, clinic/lab/pharmacy/insurance settings, payment
  providers, and geo (`latitude`, `longitude`, `address_*`).
- **his_integrations** — 1:1 HIS connection per tenant: `vendor`, `base_url`, `auth_type`,
  `credentials_encrypted` (JSONB), `sync_enabled`.
- **governorates** — Egyptian geo reference: `name_*`, `region`, PostGIS `centroid`/`boundary`, `code`.
- **specialties** — medical specialty tree (self-FK `parent_specialty_id`), `urgency_default`.
- **admin_users** — staff auth (PK = `auth.users.id`); `tenant_id` (NULL = platform admin), `role`
  (~24 roles), `chain_id`, `branch_tenant_id`.

### Patients & profiles
- **patients** — identity: `phone_number` + `tenant_id` unique, `name_ar`, `expo_push_token`,
  triage-consent fields.
- **patient_profiles** — 1:1 clinical profile: demographics, generated `bmi`, lifestyle + chronic
  enums, `background_risk_score`, `risk_level`, insurance code, paediatric fields. (Old free-text
  allergy/condition/med/surgery columns are **deprecated** in favor of the junctions below.)
- **Structured junctions + catalogs:** `patient_allergies`/`allergy_options`,
  `patient_chronic_conditions`/`chronic_condition_options`, `patient_medications`,
  `patient_surgeries`/`surgery_options`, `patient_family_history`/`family_history_options`.
- **guardian_relationships** — parent↔child link between two `patients` rows (`can_book`,
  `can_view_records`) for paediatrics.

### Triage & sessions
- **triage_sessions** — one AI triage encounter: `patient_id`, `status`, `chief_complaint_ar`,
  `extracted_symptoms[]`, `determined_specialty_id`, `urgency_level`, `emergency_triggered`,
  `recommended_doctor_id`, `booking_id` (circular FK), `channel`
  (app/website_widget/hospital_kiosk/api/phone_call/doctor_intake), location, phone-call fields.
- **session_messages** — chat turns: `session_id`, `role` (ai/patient), `content_ar`,
  `rag_context_ids[]`, `emergency_check_result`, `image_urls[]`.
- **widget_events** — the embed engagement funnel.
- **health_assistant_sessions** — the standalone Arabic health-Q&A assistant ("تريجي يسألك").

### Doctors & bookings
- **doctors** — provider directory: `tenant_id` (NULL = platform-level; the doctor's **primary**
  affiliation), `specialty_id`, `governorate_id`, PostGIS `location` (GIST-indexed),
  `consultation_fee_egp`, `accepts_insurance`, ratings, `offers_telehealth`, `his_doctor_id`.
- **doctor_tenants** (migration 065) — a doctor's **complete** set of facility affiliations, since a
  doctor can work at more than one (e.g. a hospital job plus a private clinic): `(doctor_id,
  tenant_id)` composite PK, `is_primary` flags which row mirrors `doctors.tenant_id`. Backfilled from
  every pre-existing `doctors.tenant_id`. Public `SELECT` (shown on clinic pages). The two PostGIS
  matcher RPCs and `tenant_list_stats` (below) both consider every affiliation, not just the primary.
- **doctor_availability** — bookable slots (`slot_datetime`, `is_booked`, `his_slot_id`).
- **doctor_accounts** — doctor login (PK = `auth.users.id`), **distinct from `doctors`**;
  `doctor_id → doctors` (nullable until an admin matches), `syndicate_number` (unique),
  `verification_status`, clinical-document assets (signature/stamp), GP video-call config.
  Migration 064 added the clinic-affiliation intent a doctor declares at registration:
  `clinic_mode` (`independent` / `own_clinic` / `existing_clinic`), `requested_clinic_name_en`,
  `requested_clinic_address_ar`, `requested_tenant_id` — read once, at admin approval, to decide
  whether to provision a new clinic tenant or link the doctor into an existing one (see
  [user-guide.md](user-guide.md) for the full flow).
- **bookings** — appointments: `tenant_id`, `patient_id`, `doctor_id`, `session_id`, `slot_id`,
  `appointment_datetime`, `status`, `appointment_type` (in_person/telehealth), LiveKit fields.
- **clinic_queue** — real-time walk-in numbered queue per doctor per day.
- **vitals_history**, **follow_up_schedule**, **gp_relationships**/**gp_notes** (primary-care
  linkage), **gp_video_calls** (LiveKit GP telemedicine).

### Clinical records & documents
- **health_records** — the central clinical hub: uploads + doctor-authored documents. `patient_id`,
  `record_type`, `file_url`, AI-extraction JSON (`medications`, `lab_values`), and doctor-authored
  extensions (`doctor_authored`, `authored_by → doctor_accounts`, `document_type`, `document_number`
  = `TRJ-YYYY-NNNNN`, `pdf_url`).
- **prescription_items / lab_order_items / imaging_order_items** — line items cascading off a
  doctor-authored `health_records` document.
- **session_summaries** — patient-facing post-session summary + doctor SOAP fields.
- **history_consent / record_access_grants / medical_record_shares** — the consent + share-token
  chain (patient grants a doctor time-limited read access; "medical passport" share links).
- **referrals** — tier-1 (specialty) / tier-2 (doctor) referrals.
- **disease_protocols / patient_protocol_enrollment / protocol_alerts** — chronic-disease monitoring
  (diabetes, hypertension, thyroid, kidney, asthma) with a daily protocol-check cron.

### Labs & radiology
- **lab_services** (per-tenant catalog), **lab_test_catalog** (platform reference).
- **lab_order_routing** — the order→result pipeline (`health_record_id` → `lab_tenant_id` →
  `result_health_record_id`), plus chain-integration columns.
- **lab_appointments**, and the **lab_chains / lab_chain_branches / lab_chain_test_mapping /
  lab_chain_webhooks / lab_chain_sync_log** set for external chains (Al-Borg, Al-Mokhtabar, Alfa).

> Two distinct "chain" concepts: **`lab_chains`** (external labs integrated by code, migration 050)
> vs the generic multi-branch **`chains`** model (migration 052). Unrelated tables despite the name.

### Pharmacy
- **pharmacy_medications** (per-tenant inventory), **medication_catalog** (platform reference),
  **prescription_routing** (prescription→dispensing pipeline), **pharmacy_invoices**.

### Insurance
- **insurance_providers / insurance_companies** (reference), **patient_insurance_policies**
  (`annual_limit_egp`, generated `remaining_limit_egp`, `copay_pct`), **pre_authorization_requests**,
  **insurance_claims** (`claim_number`, links to invoices/booking/preauth/remittance),
  **remittance_records** (insurer→provider payment batches).

### ICU
- **icu_units** (bed registry, generated `occupied_beds`, `accepts_transfers`),
  **icu_availability_log** (bed-change audit), **icu_transfer_requests** (cross-hospital emergency
  transfer with location + ETA). All realtime-enabled; doctors can read cross-tenant.

### Payments
- **payment_transactions** — gateway txns; polymorphic `payable_type` + `payable_id`, `provider`,
  `fawry_code`, `amount_egp`, `status`, `triaji_reference` (unique).
- **clinic_invoices** — per-visit invoices (`invoice_number`, line items, insurance split).

### Chains (multi-branch)
- **chains**, **chain_pricing** (shared catalog with `branch_exceptions`), **chain_patient_registry**
  (cross-branch tracking), **doctor_branch_assignments**.

### Knowledge base & rules
- **kb_documents** (RAG content; NULL tenant = platform-wide) → **kb_embeddings** (pgvector chunks,
  ivfflat cosine index).
- **emergency_triggers** — configurable red-flag rules (JSONB conditions, `escalation_type`,
  `priority`).
- **drug_interactions / interaction_check_log** — bilingual interaction DB + doctor-override audit.
- **Paediatric reference** — `vaccine_catalog`, `vaccination_schedule`, `milestone_catalog` /
  `patient_milestones`, `growth_measurements`, `who_growth_reference`, `school_health_records`,
  `paediatric_drug_dosing`.

### Notifications / audit
- **his_sync_logs**, **callback_queue** (missed-call re-engagement), plus the per-domain audit logs
  (`interaction_check_log`, `icu_availability_log`, `lab_chain_sync_log`).

## Key relationships

- **Patient graph:** `patients (1→1) patient_profiles`, which fans out to the junction tables (each
  referencing an option catalog by `code`). `guardian_relationships` links two patients for paeds.
- **Triage ↔ booking circular FK:** `triage_sessions.booking_id ↔ bookings.session_id` — the
  `reserve_slot()` RPC writes both sides atomically.
- **Three doctor concepts:** `doctors` (public directory, one row per doctor) vs `doctor_accounts`
  (auth login, linked by `doctor_accounts.doctor_id`) vs `doctor_tenants` (the doctor's full set of
  facility affiliations — `doctors.tenant_id` is only the primary one). Clinical tables reference
  `doctors`/`doctor_accounts`; tenant-scoped rosters and search should also check `doctor_tenants`.
- **Clinical documents:** `health_records` is the hub — line items cascade off it, and
  `lab_order_routing` / `prescription_routing` reference it as both source order and result record.
- **Insurance flow:** `patient_insurance_policies → pre_authorization_requests → insurance_claims →
  remittance_records`, with claims also referencing invoices + bookings.

## Access model (RLS)

Every table has **RLS enabled**. The consistent pattern: a `service_role_all` policy so server code
using the **service-role key** (which bypasses RLS) reads/writes everything — essentially all reads
of PII/clinical data go through service-role API routes. The **anon/publishable key** shipped to the
browser is default-deny on sensitive tables and only gets `SELECT` on public reference/catalog data
(doctors directory, specialties, KB, `*_options`, `*_catalog`, lab services). Authenticated access is
role-gated (`admin_users` / `doctor_accounts` / patient policies keyed off `auth.uid()`,
`auth.jwt() ->> 'phone'`, or `app.current_tenant_id`).

**Migration 058 (RLS hardening)** removed anon-facing `tenant_id IS NULL` SELECT policies that had
leaked NULL-tenant PII to the browser key, and fixed the self-recursive `admin_users` policies. The
newest RLS-locked tables (`medical_record_shares` 055, `protocol_alerts` 057) have RLS on with **no**
public policies — reachable only via service-role.

## Postgres RPC functions

| RPC | Migration | Purpose |
|-----|-----------|---------|
| `match_kb_documents` | 009 | pgvector cosine search over `kb_embeddings` (RAG retrieval) |
| `find_doctors_near` | 009/013/065 | PostGIS nearest matching doctors by specialty within a radius (065: also matches via `doctor_tenants`) |
| `find_doctors_by_governorate` | 013/065 | fallback doctor search (no lat/lng), by rating (065: also matches via `doctor_tenants`) |
| `reserve_slot` | 016 | **atomic** slot booking (`FOR UPDATE`) — prevents double-booking, links session |
| `next_queue_number` | 033 | next daily walk-in queue number per tenant+doctor |
| `next_invoice_number` | 034 | clinic invoice number `INV-YYYY-NNNNN` |
| `next_claim_number` / `next_remittance_number` | 044 | insurer-scoped `CLM-…` / `RMT-…` |
| `find_icu_beds_near` | 045 | PostGIS hospitals with available ICU beds by type/radius |
| `calculate_percentile` | 048 | WHO growth-chart percentile interpolation (paeds) |
| `next_payment_reference` | 049 | `PAY-YYYY-NNNNNN` |
| `find_nearest_chain_branches` | 050 | PostGIS nearest lab-chain branches |
| `find_labs_near` | 060 | PostGIS distance-sorted lab/radiology tenants (config as JSONB) |
| `widget_analytics_summary` | 061 | pre-aggregated widget funnel/daily/top-pages as JSONB |
| `tenant_list_stats` | 062/065 | batched per-tenant doctor + 30-day booking counts (065: counts `doctor_tenants` affiliates too) |
| `next_clinical_document_number` | 063 | **atomic** `TRJ-YYYY-NNNNN` (single-row counter, row lock) |

## Extensions

- **postgis** — all geospatial columns + the proximity RPCs above (GIST-indexed `location` columns).
- **vector** (pgvector) — `kb_embeddings.embedding VECTOR(1024)`, ivfflat cosine index, Cohere
  `embed-multilingual-v3`.
- **uuid-ossp** — `uuid_generate_v4()` PKs. **pg_trgm / unaccent** — Arabic fuzzy text matching.
</content>
