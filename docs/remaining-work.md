# Remaining Work — Schema-Drift Remediation (resume here)

**Snapshot:** `main` @ `831f3da` (all pushed). Both `pnpm --filter @triaji/web typecheck` and
`pnpm --filter @triaji/admin typecheck` are **clean**. Whole-API column drift is down from
~262 → **103 refs**, all in the **lab / pharmacy ingestion subsystem**.

The dominant bug class this whole effort: **code references DB columns/tables that don't exist
in the live Supabase** (wrong table or wrong column name) — it compiles because Supabase queries
are loosely typed + `as` casts hide it, and only fails at runtime. Always verify against the
**live DB**, not the migrations and not the existing code. See memory notes
`schema-drift-verify-live-db` and `triaji-qa-recipes`.

---

## How to resume (2 commands)

**1. Re-run the drift scan** (lists every column ref not in the live schema, grouped by table):
```bash
set -a; source .env.local; set +a
curl -s -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/" -o /tmp/schema.json
# then run the scan in docs/scan-drift.py (or paste the scan from the session transcript)
```
The scan: parse `/tmp/schema.json` → `definitions[table].properties` = real columns; for every
`.from('t').select/insert/update/upsert(...)` and every `.eq/.order/.gte/...('col')`, flag columns
not in `t`'s real column set.

**2. After each cluster:** `pnpm --filter @triaji/web typecheck && pnpm --filter @triaji/admin typecheck`,
then re-run the scan to confirm the count drops, then commit + push.

To **runtime-verify**: mint a patient session (HMAC `patient-token`, see `triaji-qa-recipes`) or a
verified-doctor session (Supabase auth user + `doctor_accounts` row, `id` = auth user id), seed a
minimal fixture, hit the endpoint, then delete the fixture (FK order in `triaji-qa-recipes`).

---

## ✅ Already done (do NOT redo)
filter renames (his_integrations/protocol/health_records); `patients` cluster; geo/`tenant_config`
cluster (+ migration `056_tenant_location.sql`, runtime-verified — `/api/lab/nearby` returns
`distance_km`); doctors/doctor_accounts; session_summaries; bookings; misc batch
(his/connect, patient_protocol_enrollment, patient_medications, medication_catalog, referrals,
insurance_claims copay, emergency_triggers, kb_documents, gp_relationships, lab_services,
lab_test_catalog, clinic/pharmacy invoices, icu_availability_log/units/transfer, push-token).

---

## ⏳ Remaining: lab/pharmacy ingestion (103 refs)

Order suggestion: do the **clean renames** first (low risk), then the **reworks** (need decisions).

### A. Clean renames / drops (safe, ~40 refs)
- **pharmacy_medications** (12) — `admin/api/admin/pharmacy/medications`. Real cols: drug_name_ar/en,
  form_ar/en, generic_name_en, in_stock, is_active, manufacturer_ar, price_egp, requires_prescription,
  sort_order, stock_quantity, strength, tenant_id. Map: name_ar→drug_name_ar, name_en→drug_name_en,
  form→form_ar, generic_name→generic_name_en, manufacturer→manufacturer_ar, price→price_egp; DROP
  category, unit, barcode, catalog_medication_id, min_stock_level, storage_conditions.
- **lab_chain_branches** (4) — `cron/lab-chain-sync`. branch_id→chain_branch_id, branch_name→name_en,
  branch_name_ar→name_ar; DROP last_synced_at.
- **lab_chain_test_mapping** (3) — `lib/lab/route-order`, `cron/lab-chain-sync`. test_name/test_name_ar
  →chain_test_name_ar; DROP last_synced_at.
- **lab_order_routing** (15, MIXED) — real cols include chain_order_id, received_at, result_health_record_id,
  results_ready_at, last_api_error, api_error_count, manual_fallback_active, routed_at, sample_collected_at,
  delivered_at, status. RENAME: result_record_id→result_health_record_id, results_health_record_id→
  result_health_record_id, results_received_at→results_ready_at, last_api_error_at→last_api_error (text,
  no _at). DROP (exist nowhere): estimated_date, last_polled_at, partial_results, partial_results_count,
  paid_at, payment_status, order_number (use chain_order_id or id).
- **prescription_routing** (10) — real: collected_at, delivery_address_ar, delivery_requested,
  doctor_account_id, estimated_ready_at, invoice_id, patient_phone, pharmacy_note_ar, pharmacy_tenant_id,
  ready_at, received_at, routed_at, routing_note_ar, status, stock_confirmation. Map: notes→routing_note_ar,
  patient_name_ar→DROP, routed_by/routed_by_id→doctor_account_id, collected_by/prepared_by/received_by→DROP
  (use collected_at/ready_at/received_at timestamps), stock_checked_at/stock_checked_by→stock_confirmation (jsonb).
- **his_integrations** (2) + **tenants** (2) — stragglers from earlier clusters; re-scan and map to
  sync_enabled / tenant_config as before.

### B. Reworks — need a decision before coding (~63 refs)
- **health_records lab-ingestion** (16) — `lib/lab/process-chain-results.ts`, `admin/api/admin/lab/results`.
  Code writes content/source/source_chain_code/result_date/test_codes/chain_order_id/patient_name_ar/
  patient_phone — none exist. Lab results must go into **`health_records.lab_values` (jsonb array)** with
  `lab_date`/`lab_name`/`has_abnormal_values`, `uploaded_at` (not created_at), and the NOT-NULL
  `file_url`/`file_name`/`mime_type` (sentinels like the clinical-document fix). patient name/phone come
  from the `patients` join, not stored on the record.
- **lab_order_items** (6) — `admin/api/admin/lab/results` UPDATEs result_value/reference_range/unit/status
  there, but lab_order_items has **no result columns** (only test_name_ar/en, urgency, notes_ar,
  fasting_required, health_record_id, sort_order). **Decision:** results belong in
  `health_records.lab_values`; the lab_order_items write should be removed/rethought.
- **lab_appointments** (21) — `lab/chains/[code]/book`, `admin/api/admin/lab/appointments`. Real cols are
  LEAN: appointment_datetime, is_home_collection, is_walk_in, lab_order_routing_id, lab_tenant_id, notes_ar,
  patient_id, patient_name_ar, patient_phone, status, collection_address_ar, checked_in_at, completed_at.
  Map the real ones (appointment_date/time→appointment_datetime, tenant_id→lab_tenant_id,
  order_id/order_routing_id→lab_order_routing_id, patient_name→patient_name_ar, home_collection→
  is_home_collection). **Decision:** the chain booking metadata it tries to store (chain_booking_id,
  chain_code, branch_name, chain_confirmation_code, test_codes, patient_dob, patient_sex, slot_id, user_id)
  doesn't fit lab_appointments — relocate to `lab_order_routing` (has chain_code/chain_branch_id/chain_order_id)
  or drop.
- **lab_chains** (3) — `lib/lab/route-order` reads lab_chains.lab_tenant_id/chain_code/branch_id; lab_chains
  has `code` and NO tenant link. **Decision:** how does a lab *tenant* map to a chain? (e.g. a
  `tenant_config` field, or remove the lab_chains fallback in getChainConfig and rely on tenant_config.config).
- **lab_chain_webhooks** (9) — `webhooks/lab-chain/{alborg,alfa,almokhtabar}`. Real: chain_code, event_type,
  payload (jsonb), routing_id, signature, is_verified, processed_at, created_at. Map: received_at→created_at;
  DROP processing_error; chain_order_id → store inside `payload` and correlate to a routing via `routing_id`.

---

## Other open items (not schema-drift)
- **Signed-URL retrieval for clinical-doc PDFs** (chip `task_13be5b51`): the `clinical-documents` bucket is
  private (correct), but the route stores a public URL via `getPublicUrl` → won't open. Switch to storing
  the storage path + on-demand `createSignedUrl` behind an authorized endpoint.
- **Rotate the Supabase service-role JWT** hardcoded in `.claude/settings.local.json`.
- **Verify-only (lower priority):** runtime-test telehealth/LiveKit, payments webhooks, the admin app UI,
  mobile, and the widget — none deeply exercised.

## DB state (already applied this effort — don't repeat)
- Migration `055_medical_record_shares.sql` applied.
- Migration `056_tenant_location.sql` applied.
- `clinical-documents` storage bucket created (private).
- Seeded: doctors for empty specialties, fresh availability slots.
