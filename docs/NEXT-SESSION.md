# Triaji — Next Session: Start Here

_Last updated 2026-06-16. Everything below is committed + pushed; `main` @ `b5c8a0f`, working tree
clean. Full detail lives in [remaining-work.md](remaining-work.md); this is the short, actionable list._

---

## ⚠️ 0. CHECK FIRST — could be breaking production right now
The legacy Supabase API keys were **disabled** this session. Local `.env.local` was updated to the
new keys, but **any deployed host (Railway/Vercel/etc.) still using the old `anon`/`service_role`
keys is now returning 401 → prod is down.**
- **Fix:** in the hosting env, set
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = the `sb_publishable_…` value
  - `SUPABASE_SERVICE_ROLE_KEY` = the `sb_secret_…` value
  (same values already in local root `.env.local`).
- If nothing is deployed yet, ignore this.

---

## 1. Call center — go live (biggest item; code is DONE, needs infra)
The inbound AI-voice triage pipeline is complete and the WebSocket transport is now wired
(`apps/web/server.js`; `start` = `node server.js`). Remaining is all credentials/config/deploy:
1. **Env keys:** `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`,
   `TWILIO_WEBHOOK_BASE_URL`, `DEEPGRAM_API_KEY`, `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`,
   `ELEVENLABS_VOICE_ID_EN` (all documented in `.env.example`).
2. **Twilio:** point the phone number's Voice webhook to `POST https://<host>/api/phone/incoming`.
3. **Per tenant:** set `tenant_config.phone_number` + `phone_number_active = true`.
4. **Deploy** the web app via the new `start` (`node server.js`) on a **persistent Node host**
   (Railway/Render/Fly/VM) — **NOT** serverless/edge (Vercel functions, CF Workers): it needs a
   long-lived process for the WebSocket.
5. **Test:** call the number → AI triage. (Ask me to help drive the end-to-end test.)
- Local smoke test anytime: `pnpm --filter @triaji/web dev:phone`, then WS-connect to
  `ws://localhost:3000/api/phone/stream` (expect 101).

## 2. I can do these on request — just say which
- **Signed-URL for clinical-doc PDFs** (chip `task_13be5b51`): the `clinical-documents` bucket is
  private (correct) but the route stores a public URL via `getPublicUrl`, so PDFs won't open.
  Fix = store the storage path + mint an on-demand `createSignedUrl` behind an authorized endpoint.
- **Lab payments** (product decision): unmodeled — no `lab_invoices` table; the `lab_invoice`
  payable degrades safely today. Decide: build it (needs a migration + wiring) or leave as-is.

## 3. Verify-only — blocked on creds / native runtime
- **Telehealth/LiveKit:** needs `LIVEKIT_API_KEY/SECRET/URL` + a booking; video can't be checked headless.
- **Payment webhooks:** needs Fawry/Paymob/Vodafone secrets (on hold per your call).
- **Mobile (Expo):** not headless-verifiable.

---

## ✅ Done this session (context only — no action)
- Schema-drift cleared: column refs **113→0**, embedded-join refs **68→0** (reusable scanners:
  `docs/scan-drift.py`, `docs/scan-embeds.py`).
- Protocol-compliance feature + `protocol_alerts` table — migration **057** applied + verified.
- Admin lab/pharmacy UI adapted to nested API shapes + render-verified with a (cleaned-up) fixture.
- Widget runtime-verified (build + load + Shadow-DOM isolation).
- **Security:** Supabase keys rotated to the new `sb_secret_`/`sb_publishable_` system, legacy keys
  disabled (old leaked key dead), RLS hardening migration **058** applied — patient/session PII no
  longer readable by the public key; `admin_users` recursion fixed.
- Call-center WebSocket transport wired (`apps/web/server.js`).

## Quick re-verify commands
```bash
# drift scanners (expect 0 / 0)
set -a; source .env.local; set +a
curl -s -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/" -o /tmp/schema.json
python3 docs/scan-drift.py && python3 docs/scan-embeds.py
# typecheck
pnpm --filter @triaji/web typecheck && pnpm --filter @triaji/admin typecheck
```
