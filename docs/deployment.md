# Deployment Runbook

How to deploy Triaji to production. Pairs with [getting-started.md](getting-started.md) (local dev)
and the live delivery checklist in [NEXT-SESSION.md](NEXT-SESSION.md).

> **The one hard rule:** the **web app must run on a persistent Node host — never
> serverless/edge.** It uses a custom Node server (`apps/web/server.js`) to serve the Twilio phone
> WebSocket; `next start`/serverless silently drop the `/api/phone/stream` upgrade and the phone
> call-center stops working. Suitable hosts: Railway, Render, Fly.io, a VM, or any container
> platform that runs a long-lived process.

## Topology — what runs where

| Service | Build | Start | Port | Notes |
|---------|-------|-------|------|-------|
| **web** (patient + doctor + all `/api/*`, incl. phone WS) | `pnpm build` (builds widget → web → admin) | `pnpm --filter @triaji/web start` → `NODE_ENV=production node server.js` | `PORT` (default 3000), `HOSTNAME` 0.0.0.0 | **Persistent Node process.** The widget bundle is built and copied into `web/public` by the build. |
| **admin** (provider/platform panel) | `pnpm --filter @triaji/admin build` | `pnpm --filter @triaji/admin start` → `next start` | `--port 3001` | Standard Next.js; can be serverless or Node. Deploy as its own service/subdomain. |
| **Supabase** | migrations applied | managed | — | Postgres + PostGIS + pgvector. |
| **Cron scheduler** | — | hits `/api/cron/*` on the web host | — | Any scheduler (Railway cron, GitHub Actions, cron-job.org) with the `CRON_SECRET` header. |
| **mobile** | EAS build | app stores | — | Separate release train — see [NEXT-SESSION.md](NEXT-SESSION.md) mobile checklist. |

There is **no deploy config committed** (no Dockerfile / railway.toml / fly.toml) — configure your
platform's build & start commands to the table above. A minimal build command for the web service is
`pnpm install --frozen-lockfile && pnpm build`; start is `pnpm --filter @triaji/web start`.

## 1. Prerequisites

1. **Supabase project** with the extensions enabled (PostGIS, vector, uuid-ossp, pg_trgm, unaccent —
   migration `001` does this) and **all 63 migrations applied in order** (`supabase/migrations/001…063`).
   Apply via the Supabase SQL editor or CLI. Verify the RPCs exist (e.g. `find_labs_near`,
   `reserve_slot`, `next_clinical_document_number`).
2. **Seed** the knowledge base so triage retrieval works: `pnpm seed:kb && pnpm embed:kb`
   (`COHERE_API_KEY` required). Optionally `pnpm seed:doctors && pnpm seed:slots` for demo data.
3. **Supabase keys:** use the current `sb_publishable_…` / `sb_secret_…` keys. **Legacy keys are
   disabled and will 401** — any older deployment on them must be re-keyed.
4. A **platform admin** user in `admin_users` (role `platform_admin`) to bootstrap the admin panel and
   verify doctors. `PLATFORM_ADMIN_SECRET` gates admin bootstrap.

## 2. Environment variables

Set the full production env on **both** the web and admin services (they share the same variables).
Copy from `.env.example` — grouped in [getting-started.md](getting-started.md#environment-variables-grouped).
Minimum to boot: the three **Supabase** vars + `ANTHROPIC_API_KEY` + `COHERE_API_KEY` +
`NEXT_PUBLIC_APP_URL` (your public web URL). Add the rest as you enable each integration:

- **Messaging:** `WHATSAPP_*`, `SMS_GATEWAY_*` (OTP + booking confirmations).
- **Payments:** `FAWRY_*`, `PAYMOB_*`, `VF_*`.
- **Telehealth:** `LIVEKIT_API_KEY/SECRET/URL`.
- **Phone:** `TWILIO_*`, `DEEPGRAM_API_KEY`, `ELEVENLABS_*`, `HUMAN_AGENT_PHONE`,
  `TWILIO_WEBHOOK_BASE_URL`.
- **Cache/push:** `UPSTASH_REDIS_REST_*`, `EXPO_ACCESS_TOKEN`.
- **HIS / lab chains:** `HIS_ENCRYPTION_KEY`, `ALBORG_*`, `ALMOKHTABAR_*`, `ALFA_*`.
- **Ops:** `CRON_SECRET` (protects `/api/cron/*`), `PLATFORM_ADMIN_SECRET`.

Most features **degrade gracefully** when a key is absent — deploy first with the core set, then
light up integrations.

## 3. Build

CI (`.github/workflows/ci.yml`) already runs typecheck/lint/test/build on every push. For a release,
build from a green commit:

```bash
pnpm install --frozen-lockfile
pnpm typecheck && pnpm lint && pnpm test     # gate (matches CI)
pnpm build                                    # widget → web → admin
```

`pnpm build` builds the widget first and copies it into `apps/web/public`, then builds web, then
admin. If your platform builds each service separately, ensure the web build runs `pnpm build:widget`
first (or run the root `pnpm build`).

## 4. Deploy the web service

1. Provision a **persistent Node** service. Build: `pnpm install --frozen-lockfile && pnpm build`.
   Start: `pnpm --filter @triaji/web start`. Expose `PORT` (the platform's assigned port; `server.js`
   reads `PORT`, binds `0.0.0.0`).
2. Set the full env (section 2). Set `NEXT_PUBLIC_APP_URL` to the public URL.
3. Point your domain at it (e.g. `https://app.triaji.com`). Ensure **WebSocket upgrades** pass through
   the proxy/load balancer (needed for `/api/phone/stream`).

## 5. Deploy the admin service

Separate service/subdomain (e.g. `https://admin.triaji.com`). Build:
`pnpm install --frozen-lockfile && pnpm --filter @triaji/admin build`. Start:
`pnpm --filter @triaji/admin start` (port 3001, or the platform port). Same env as web.

## 6. Cron jobs

Schedule GET requests to the web host's `/api/cron/*` endpoints, each with header
`x-cron-secret: <CRON_SECRET>`. The documented example (from `.env.example`):

```
schedule: */30 * * * *
GET https://<web-host>/api/cron/his-sync
header:  x-cron-secret: <CRON_SECRET>
```

All cron endpoints (set the cadence to your needs; his-sync is the one with a documented 30-min
cadence):

| Endpoint | Does | Suggested cadence |
|----------|------|-------------------|
| `/api/cron/his-sync` | sync HIS doctors/availability | every 30 min |
| `/api/cron/icu-his-sync` | sync ICU bed data from HIS | every 15–30 min |
| `/api/cron/lab-chain-sync` | sync lab-chain data | hourly |
| `/api/cron/lab-chain-results` | pull ready lab results | every 15–30 min |
| `/api/cron/followup-reminders` | send follow-up reminders | daily |
| `/api/cron/vaccination-reminders` | send vaccination reminders | daily |
| `/api/cron/protocol-check` | run chronic-disease protocol checks → alerts | daily |
| `/api/cron/claims-deadline` | flag claims nearing deadline | daily |
| `/api/cron/payment-expiry` | expire stale pending payments | every 15–30 min |
| `/api/cron/callbacks` | process pending phone callbacks | every 5–15 min |

Any scheduler works (Railway cron, a GitHub Actions scheduled workflow, cron-job.org, a platform
scheduler). Keep `CRON_SECRET` secret — these endpoints mutate data.

## 7. Provider-integration webhooks & config

After the web host is live, point external providers back at it:

- **Twilio (phone):** set the number's Voice webhook to `POST https://<web-host>/api/phone/incoming`;
  set `TWILIO_WEBHOOK_BASE_URL` to `https://<web-host>`. Twilio streams media to
  `wss://<web-host>/api/phone/stream`. Per tenant: set `tenant_config.phone_number` +
  `phone_number_active = true`.
- **Payments:** configure each gateway's webhook to the matching route —
  `POST https://<web-host>/api/webhooks/{fawry|paymob|vodafone}`. (Note: Fawry uses **plain SHA-256**
  signatures; a live Fawry-staging test of the charge-request field order is still pending — see
  NEXT-SESSION.)
- **Lab chains:** set each chain's results webhook to
  `POST https://<web-host>/api/webhooks/lab-chain/{alborg|alfa|almokhtabar}`; see
  [lab-chain-activation.md](lab-chain-activation.md).
- **Telehealth:** LiveKit needs `LIVEKIT_URL` reachable from clients; no inbound webhook.

## 8. Post-deploy verification

```bash
# 1. Liveness + dependency health
curl https://<web-host>/api/health            # expect 200

# 2. API smoke suite against the deployed host (auth gates, patient flow, signed-URL PDF)
SMOKE_BASE_URL=https://<web-host> pnpm test:smoke   # expect 14 passing

# 3. Schema/embedding drift scanners (expect 0 / 0)
set -a; source .env.local; set +a
curl -s -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/" -o /tmp/schema.json
python3 docs/scan-drift.py && python3 docs/scan-embeds.py
```

Then spot-check manually: patient OTP login → triage chat returns an AI reply (needs Anthropic
credit) → book a doctor; admin login → a dashboard loads; if configured, place a real **test phone
call** and a **test payment**.

## 9. Rollback & operational notes

- **Rollback:** redeploy the previous green commit. App code carries no destructive migrations at
  deploy time — **DB migrations are applied manually and are forward-only**, so a code rollback is
  safe as long as the newer migrations are additive (060–063 are). Never auto-run migrations on boot.
- **Migrations:** apply new `NNN_*.sql` files to Supabase **before** (or with) the deploy that needs
  them. Routes that depend on a new RPC (e.g. `find_labs_near`, `next_clinical_document_number`) have
  a **legacy fallback** and log a warning until the migration is applied — check logs for
  `"legacy path"` / `"RPC unavailable"` after a deploy to confirm the migration landed.
- **Monitoring:** point an uptime monitor at `/api/health`; add error tracking (e.g. Sentry). Watch
  the phone WS by confirming a test call connects.
- **Secrets:** rotate the Supabase service-role key, `CRON_SECRET`, and provider secrets via the host's
  secret store; never commit them. `.env.local` is git-ignored.
- **Scaling:** the web service is stateful only via the phone WS during a live call — scale
  horizontally behind a WS-aware load balancer; Redis (Upstash) holds OTP/session cache across
  instances.

## Deploy checklist (quick)

- [ ] Supabase reachable, all migrations 001–063 applied, KB seeded + embedded
- [ ] Current `sb_publishable_`/`sb_secret_` keys (not legacy)
- [ ] Web on a persistent Node host, `node server.js`, WS upgrades allowed, full env set
- [ ] Admin deployed as its own service, same env
- [ ] Cron scheduler hitting `/api/cron/*` with `CRON_SECRET`
- [ ] Provider webhooks pointed at the web host (Twilio, payments, lab chains)
- [ ] `curl /api/health` = 200, `SMOKE_BASE_URL=… pnpm test:smoke` = 14 passing, drift = 0/0
- [ ] Manual spot-check: patient login + triage, admin login, (if configured) test call + payment
</content>
