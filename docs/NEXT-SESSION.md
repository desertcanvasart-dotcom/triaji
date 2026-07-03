# Triaji — Next Session: Start Here

_Last updated 2026-07-03. Everything committed + pushed; `main` @ `b1f083e`, working tree clean.
Full history/detail in [remaining-work.md](remaining-work.md). Goal on the table: **set a customer
delivery date.** Framing already given to the user: web platform ~1 week, call center ~1 day after
credentials exist, mobile 2–4 weeks (phase 2)._

---

## Current state (verified 2026-07-03)

- **Code health:** `pnpm typecheck` green across all 12 workspace projects; `pnpm lint` passes
  (ESLint newly set up workspace-wide); 246 unit tests + 14 API smoke tests green; full
  widget→web→admin build passes.
- **CI is live:** GitHub Actions runs typecheck/lint/test/build on every push
  (`.github/workflows/ci.yml`) and a nightly live-schema drift scan
  (`.github/workflows/schema-drift.yml`) — both green on GitHub; the three Supabase repo secrets
  are set. Schema drift: **0 / 0**.
- **Security this session:** 3 IDOR holes fixed (`/api/booking/[id]`, `/api/telehealth/token`,
  `/api/admin/bookings/[id]/patient-history` — all were unauthenticated on service-role clients).
- **Fixed + E2E-verified:** clinical-document PDFs now served via authorized signed URLs
  (`GET /api/clinical-document/[id]/pdf`); emergency-rule priorities unique 1–17, DB migration
  **059 applied + verified**; `/api/health` liveness endpoint added.
- **Smoke harness:** `pnpm test:smoke` (needs the dev server running + root `.env.local`; point at
  a deployed host with `SMOKE_BASE_URL=https://…`). Covers auth gates, patient flows via minted
  HMAC session, and the signed-URL PDF flow with a self-cleaning fixture.

---

## Delivery checklist (in order)

### 1. Deploy the web app — THE gate; nothing ships without it
- Persistent Node host (Railway/Render/Fly/VM), **NOT serverless/edge** — the phone WebSocket needs
  a long-lived process. Start command is already `node server.js`.
- Set hosting env vars incl. the **new** Supabase keys (`sb_publishable_…` / `sb_secret_…`, same as
  local `.env.local`). Any old deployment on legacy keys is 401'ing — legacy keys are disabled.
- After deploy: `curl https://<host>/api/health` (expect 200) and
  `SMOKE_BASE_URL=https://<host> pnpm test:smoke` (expect 14 passing).

### 2. Credential-gated QA (never runtime-tested)
- **Telehealth/LiveKit:** needs `LIVEKIT_API_KEY/SECRET/URL` + a telehealth booking; test a real call.
- **Payment webhooks:** needs Fawry/Paymob/Vodafone secrets (were on hold per user's call).

### 3. Call center go-live (code 100% done; all infra/config)
1. Env keys: `TWILIO_*`, `DEEPGRAM_API_KEY`, `ELEVENLABS_API_KEY[/_EN]`, `TWILIO_WEBHOOK_BASE_URL`.
2. Twilio number → Voice webhook `POST https://<host>/api/phone/incoming`.
3. Per tenant: `tenant_config.phone_number` + `phone_number_active = true`.
4. Place a real test call. Local smoke: `pnpm --filter @triaji/web dev:phone`, WS to
   `ws://localhost:3000/api/phone/stream` (expect 101).

### 4. Product decision: lab payments
Unmodeled (no `lab_invoices` table); degrades safely today. Build it (migration + wiring, ~1–2
days) or explicitly exclude from v1.

### 5. Mobile — phase 2 (longest pole: store review 2–4 weeks)
Repo side is DONE (eas.json, expo-dev-client, LiveKit/image-picker plugins + permissions, env
docs in `apps/mobile/.env.example`; local `apps/mobile/.env` created). User side:
1. Real assets in `apps/mobile/assets/` — icon.png 1024×1024, splash.png, adaptive-icon.png,
   notification-icon.png (**the only build blocker**).
2. `eas init` in apps/mobile (replaces placeholder projectId; needed for EAS builds + push tokens).
3. Google Maps API key → `android.config.googleMaps.apiKey` (Android ICU/hospital map is blank
   without it; iOS uses Apple Maps, fine).
4. Then: `eas build --profile development` for both platforms, device QA (app has never run on a
   device), store accounts/credentials/privacy declarations, submit.

---

## Quick re-verify commands

```bash
pnpm typecheck && pnpm lint && pnpm test          # all static + unit checks
pnpm test:smoke                                    # needs dev server (:3000) + root .env.local
# drift scanners (expect 0 / 0)
set -a; source .env.local; set +a
curl -s -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/" -o /tmp/schema.json
python3 docs/scan-drift.py && python3 docs/scan-embeds.py
```

Useful context for whoever picks this up: memory notes `triaji-qa-recipes` (mint patient/doctor
sessions, FK-safe cleanup) and `schema-drift-verify-live-db` (verify against the LIVE DB, not
migrations). Harness layers still worth adding later: Playwright for the top browser journeys,
Sentry + uptime monitor on `/api/health` once deployed.
