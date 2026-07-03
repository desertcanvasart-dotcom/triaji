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
- **Embedded-join drift — SWEPT (2026-06-15), now 0.** Built `docs/scan-embeds.py` (recurses into
  `alias:fk(col)` selects, resolves each embed to its real table via the OpenAPI FK graph). Fixed
  68 embed-inner column refs across 15 files (lab/orders, pharmacy/prescriptions, bookings, consent,
  referrals, chain/patients, icu/overview, protocols, lab chain libs). Re-run with
  `python3 docs/scan-embeds.py` (expect 0). Runtime-verified every changed endpoint against live
  PostgREST. Key live-only fixes the scanner could NOT catch (found via curl verification):
  - **Relationship-ambiguity (PGRST201):** `lab_order_routing→health_records` has TWO FKs
    (health_record_id + result_health_record_id) → hint `!lab_order_routing_health_record_id_fkey`.
    `bookings→triage_sessions` is circular → hint `!fk_session_booking`.
  - **Missing-relationship (PGRST200):** `icu_units` has no FK to `tenant_config`; route via
    `tenants!inner(tenant_config!inner(...))`.
  - **Wrong-table (PGRST205):** patient/consent queried `access_grants` (doesn't exist) → real table
    is `record_access_grants` (and `doctor_account_id`→`granted_to_account`).
  - **jsonb-shape mismatch — RESOLVED (2026-06-16).** `disease_protocols` schedule lives in
    `protocol_definition` (jsonb: labs[]/vitals[]/warnings[]/targets[]/followUpFrequency), not flat
    columns. `lib/protocols/check-compliance.ts` now derives ALL checks from it: lab cadence
    (`labs[].frequencyMonths`), per-vital frequency (`vitals[].frequencyWeeks` vs vitals_history),
    follow-up cadence (`followUpFrequency.months`), and clinical threshold alerts (`warnings[]`
    {metric,condition,threshold,severity,message} matched against the latest vital OR lab value from
    `health_records.lab_values`). All four data-layer queries verified 200 against live PostgREST.
  - **Response-shape note — UI RE-VERIFIED + FIXED (2026-06-16).** The lab/orders + pharmacy/
    prescriptions endpoints now return nested joins (`patients:patient_id(...)`, `doctors:doctor_id(...)`,
    items under `health_records`) instead of phantom flat fields. The 5 admin consumers
    (LabOrders, ResultsUpload, lab/results page, PrescriptionsList, PrescriptionDetail) read the old
    flat shape and would have rendered blank — fixed with a normalization layer at each fetch site.
    Also fixed two latent integration bugs: PrescriptionDetail/ResultsUpload read `data` instead of
    `data.prescription`/`data.order`; the stock action sent `body.items` (route wants
    `stock_confirmation`); ResultsUpload posted FormData/`lab_results` (route wants JSON `{results}`).
    Added a `doctors:doctor_id(name_ar)` join to the lab list so the doctor column populates. Admin
    typecheck clean. (No admin lint config exists, so `any` in the mappers is harmless.) Not runtime-
    clicked — needs an admin session + seeded lab/pharmacy data; shapes verified by construction.
- **Degraded-but-safe behaviors introduced:** partial chain lab results are no longer persisted
  (poll until `completed`); chain appointment bookings are only persisted when tied to an existing
  `lab_order_routing` (lab_appointments.lab_tenant_id is NOT NULL); lab-chain-sync inserts new
  branch stubs only (won't clobber admin-maintained branch rows).

## Other open items (not schema-drift)
- **Signed-URL retrieval for clinical-doc PDFs** (chip `task_13be5b51`): the `clinical-documents`
  bucket is private (correct), but the route stores a public URL via `getPublicUrl` → won't open.
  Switch to storing the storage path + on-demand `createSignedUrl` behind an authorized endpoint.
- **Rotate the Supabase service-role JWT — DONE (2026-06-16).** Migrated to the new key system:
  `SUPABASE_SERVICE_ROLE_KEY` = `sb_secret_…`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `sb_publishable_…`
  in root `.env.local`; verified server (service-role) + browser (publishable) both work end-to-end.
  Legacy literal key also redacted from gitignored `.claude/settings.local.json`. **Remaining user
  step:** in Supabase → Settings → API → Legacy tab → "Disable JWT-based API keys" to kill the old
  leaked legacy `service_role` key (safe now that the app runs on new keys). Also update production
  hosting env vars with the new keys before disabling, if deployed.
- ✅ **RLS hardening — migration `058_rls_hardening.sql` APPLIED + verified (2026-06-16).** The
  key-rotation review found the **publishable (browser) key could read PII**: `patients` (52),
  `triage_sessions` (51), `session_messages` (74 chat msgs) — because their SELECT policies allowed
  `OR tenant_id IS NULL` and all rows have null tenant; plus `admin_users` RLS **infinite recursion
  (42P17)** from self-referential policies. `058` dropped the anon-facing SELECT policies on
  patients/patient_profiles/triage_sessions/session_messages/bookings and replaced the recursive
  admin_users policies with a service-role policy. Post-apply verified against live: those tables
  now return **0 rows** to the publishable key, `admin_users` no longer errors, the app still works
  via the service role (patients 52 rows), and intended-public tables (doctors 55, specialties 18)
  remain readable. (Rotating keys did NOT fix this — the publishable key is public by design;
  protection is RLS.)
- ✅ **Emergency-trigger priorities — migration `059_emergency_trigger_priorities.sql` APPLIED + verified (2026-07-03).**
  The rules-engine now uses unique priorities 1–17 (adult + paediatric interleaved, order-preserving);
  `059` renumbered the 12 mirrored rows in `emergency_triggers` to match. Post-apply verified against
  live: all 12 rows carry the new numbers (1, 3, 6, 7, 9, 11–17), no duplicates. Gaps (2, 4, 5, 8, 10)
  are the paediatric rules that exist only in code. Seed file updated for fresh environments.
- **Phone call center (inbound AI voice triage) — WS transport WIRED (2026-06-16); not yet live.**
  The full pipeline exists and is drift-clean (`lib/phone/*`: Twilio, Deepgram STT, ElevenLabs TTS,
  DTMF, language/turn detection, handoff, transcript; `app/api/phone/*`; admin call log + callbacks;
  uses `triage_sessions` + the existing `callback_queue`). The one real code gap was that Twilio
  Media Streams need a WebSocket at `wss://…/api/phone/stream`, but Next App Router can't serve WS
  upgrades and the handler (`ws-server.ts` → `globalThis.__triaji_phone_ws_handler`, set by
  `instrumentation.ts`) was never attached to an HTTP server. **Fixed:** added a custom server
  `apps/web/server.js` that forwards `upgrade` events on `/api/phone/stream` to that handler and
  delegates everything else (HMR) to Next; `start` now runs `node server.js`, plus a `dev:phone`
  script for local testing. Verified locally: GET → 426, WS upgrade → 101 (`[Phone WS] New Twilio
  Media Stream connection`). **Remaining to go live (not code):** (1) set `TWILIO_*`, `DEEPGRAM_API_KEY`,
  `ELEVENLABS_API_KEY[/_EN]`, `TWILIO_WEBHOOK_BASE_URL` in env; (2) Twilio number → Voice webhook
  `POST /api/phone/incoming`; (3) per-tenant `tenant_config.phone_number` + `phone_number_active`;
  (4) DEPLOY via the new `start` (`node server.js`) on a host that allows WS (NOT a serverless/edge
  platform — needs a long-lived Node process); (5) place a real test call.
- **Verify-only (lower priority):** runtime-test telehealth/LiveKit, payments webhooks, the admin app
  UI, and mobile — none deeply exercised.
  - **Widget — RUNTIME-VERIFIED (2026-06-16).** Built clean (Vite, 39 modules, 167 KB), served from
    web `/widget.js`, loaded against a port-agnostic test harness with a real tenant
    (`dr-ahmed-clinic`): script loads (200) + executes, reads `TriajjiConfig`, calls
    `/api/embed/config?tenant=…` (200, resolves real tenant config), mounts `#triaji-widget-host`
    with a **closed** Shadow DOM, and the launcher renders in the widget's own teal — fully isolated
    from the host page's intentionally-hostile `button{background:red;…}` CSS (Shadow DOM isolation
    confirmed visually). Note: the chat panel couldn't be opened via automation (closed shadow root +
    0×0 fixed-position host = unreachable by selector/JS/coord-click); needs a manual click to
    exercise the chat/session flow. Build artifacts/test harness were not committed.
  - **admin lab/pharmacy UI — RENDER-VERIFIED (2026-06-16).** Seeded a temp fixture (1 lab order +
    2 tests, 1 prescription + 2 meds against patient `c1237352`/doctor `d48aeece`/tenant `1838ea15`),
    created a temp `platform_admin`, logged into the admin app (auth is a single non-httpOnly
    `sb-access-token` cookie; pages gate on `admin.tenant_id`, `tenantScope` returns null for
    platform_admin → sees all) and confirmed all three components render the normalized data:
    LabOrders (patient/doctor/tests/status/urgency), PrescriptionsList (patient/doctor/med-count/
    status/timeAgo), and PrescriptionDetail (doctor note from `routing_note_ar`, 2 meds with
    dose/frequency_ar/duration_ar, stock controls). Fixture + temp admin fully torn down afterward.
    The normalization fixes (commit `7306e1f`) are proven end-to-end in the browser.

## ✅ Protocol-compliance feature — DONE + APPLIED (2026-06-16)
- `057_protocol_alerts.sql` **applied to the live DB** and verified end-to-end: table 200,
  the `protocol_alerts → patient_protocol_enrollment → disease_protocols` embed resolves, and a
  full insert→read(doctor-alerts query shape)→delete round-trip succeeded. The cron writer + all
  5 reader endpoints (doctor/patients[, /[id], /[id]/alerts], patient/home) are now backed by a
  real table. check-compliance.ts computes all four alert types from `protocol_definition`.

## DB state (already applied in earlier passes — don't repeat)
- Migration `055_medical_record_shares.sql` applied.
- Migration `056_tenant_location.sql` applied.
- `clinical-documents` storage bucket created (private).
- Seeded: doctors for empty specialties, fresh availability slots.
- Schema-drift passes (column + embedded-join) added **no migrations** — code-to-live-schema fixes.
- Protocol-compliance pass added migration **057_protocol_alerts.sql** — APPLIED + verified.
