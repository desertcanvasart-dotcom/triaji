# Remaining Work — Schema-Drift Remediation (resume here)

**Snapshot:** uncommitted on `main` (was `831f3da`). Both `pnpm --filter @triaji/web typecheck`
and `pnpm --filter @triaji/admin typecheck` are **clean**. Whole-API **scanned column drift is now
0** (`python3 docs/scan-drift.py`) — the full ~262→0 sweep is done, including the final
lab/pharmacy ingestion cluster (113 refs across 26 files).

The dominant bug class this whole effort: **code references DB columns/tables that don't exist
in the live Supabase** (wrong table or wrong column name) — it compiles because Supabase queries
are loosely typed + `as` casts hide it, and only fails at runtime. Always verify against the
**live DB**, not the migrations and not the existing code. See memory notes
`schema-drift-verify-live-db` and `triaji-qa-recipes`.

---

## How to resume / re-verify (2 commands)

```bash
set -a; source .env.local; set +a
curl -s -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/" -o /tmp/schema.json
python3 docs/scan-drift.py            # expect: total drift refs: 0
python3 docs/scan-drift.py --files    # per-reference with file paths
```
Then `pnpm --filter @triaji/web typecheck && pnpm --filter @triaji/admin typecheck`.

Tip for must-provide columns (NOT NULL with **no** DB default — the ones an insert must set):
the PostgREST OpenAPI marks them by absence of a `default` key, NOT by the `required` array
(`required` = NOT NULL incl. defaulted cols like `id`/`created_at`). Filter `definitions[t].properties[c]`
for those lacking `default`.

---

## ✅ Done this pass (lab/pharmacy ingestion cluster, 113→0)
- **pharmacy_medications** — name_ar→drug_name_ar, name_en→drug_name_en, form→form_ar,
  generic_name→generic_name_en, manufacturer→manufacturer_ar, price→price_egp; dropped
  category/unit/barcode/catalog_medication_id/min_stock_level/storage_conditions; set in_stock.
- **lab_chain_branches / lab_chain_test_mapping** (cron/lab-chain-sync, lib/lab/route-order) —
  branch_id→chain_branch_id, branch_name→name_en, branch_name_ar→name_ar (+ NOT-NULL address_ar
  stub via `ignoreDuplicates`); test_name/test_name_ar→chain_test_name_ar; dropped last_synced_at.
- **lab_order_routing** — result_record_id/results_health_record_id→result_health_record_id,
  results_received_at→results_ready_at, last_api_error_at→last_api_error; dropped estimated_date,
  last_polled_at, partial_results(+_count), order_number (→chain_order_id/id), total_egp,
  payment_status, paid_at. Spanned ingestion + the **payments** subsystem.
- **prescription_routing** — notes→routing_note_ar; dropped routed_by/routed_by_id/collected_by/
  prepared_by/received_by/stock_checked_at/stock_checked_by/patient_name_ar; and the insert now
  supplies the genuinely-required `patient_id`/`doctor_id` (from the health record / prescriber).
- **health_records lab ingestion** (process-chain-results, admin/lab/results) — results write to
  the `lab_values` jsonb with lab_date/lab_name/has_abnormal_values/uploaded_at + NOT-NULL
  file_*/mime_type sentinels; dropped content/source/source_chain_code/test_codes/chain_order_id/
  patient_name_ar/tenant_id/created_at. Doctor-portal reads aliased (created_at:uploaded_at,
  title_ar:summary_ar).
- **lab_order_items** — removed the impossible result-column UPDATE (table has no result cols;
  results live in health_records.lab_values, item_id carried inside each entry).
- **lab_appointments** (web book + admin appointments) — appointment_date/time→appointment_datetime,
  tenant_id→lab_tenant_id, order_*→lab_order_routing_id, source→is_walk_in, notes→notes_ar; dropped
  updated_at and all chain-only metadata (chain_*/slot_id/test_codes/patient_dob/patient_sex/user_id).
- **lab_chain_webhooks** (3 webhook routes) — received_at→created_at(default), chain_order_id→inside
  payload (correlate via routing_id, now looked up before logging; also stores signature/is_verified);
  dropped processing_error.
- **his_integrations / tenants stragglers** — his/disconnect dropped updated_at; booking engine reads
  booking_mode from `tenant_config` (not his_integrations); insurance/policy maps insurer→tenant via
  `tenant_config.insurer_code` (not tenants.insurance_provider_code); route-order getChainConfig now
  resolves chain via `tenants.chain_id → lab_chains.id → lab_chains.code` (dropped tenants.config and
  the lab_chains.lab_tenant_id/chain_code/branch_id fallback).

## ⚠️ Residual decisions / caveats (NOT drift — product follow-ups)
- **Lab payments are unmodeled.** No `lab_invoices` table and `lab_order_routing` has no money
  columns. The `lab_invoice` payable now degrades: `payments/initiate` requires the caller to pass
  `amount_egp` (lookup returns 0), `payments/[reference]` shows the chain_order_id, and the webhook
  `updateLabInvoice` is a no-op (payment_transactions is the source of truth). If lab payment becomes
  a real feature, add a migration (lab_invoices, or total_egp/payment_status/paid_at on routing).
- **Embedded-join drift is NOT covered by the scanner.** `scan-drift.py` skips embedded selects
  (tokens containing `(` / `:`). Confirmed one live break already fixed in passing
  (pharmacy/prescription/[id]/status read `tenants(phone, address_ar)` — neither is on `tenants`;
  contact lives on `tenant_config`). **A follow-up sweep for `.select('… embed:other(col) …')`
  drift is warranted** — could surface more runtime-only 400s.
- **Degraded-but-safe behaviors introduced:** partial chain lab results are no longer persisted
  (poll until `completed`); chain appointment bookings are only persisted when tied to an existing
  `lab_order_routing` (lab_appointments.lab_tenant_id is NOT NULL); lab-chain-sync inserts new
  branch stubs only (won't clobber admin-maintained branch rows).

## Other open items (not schema-drift)
- **Signed-URL retrieval for clinical-doc PDFs** (chip `task_13be5b51`): the `clinical-documents`
  bucket is private (correct), but the route stores a public URL via `getPublicUrl` → won't open.
  Switch to storing the storage path + on-demand `createSignedUrl` behind an authorized endpoint.
- **Rotate the Supabase service-role JWT** hardcoded in `.claude/settings.local.json`.
- **Verify-only (lower priority):** runtime-test telehealth/LiveKit, payments webhooks, the admin app
  UI, mobile, and the widget — none deeply exercised.

## DB state (already applied in earlier passes — don't repeat)
- Migration `055_medical_record_shares.sql` applied.
- Migration `056_tenant_location.sql` applied.
- `clinical-documents` storage bucket created (private).
- Seeded: doctors for empty specialties, fresh availability slots.
- This pass added **no migrations** — all fixes were code-to-live-schema corrections.
