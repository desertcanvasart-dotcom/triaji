# Deployment Runbook

How to deploy DoctorTrio to production. Pairs with [getting-started.md](getting-started.md) (local
dev) and the live delivery checklist in [NEXT-SESSION.md](NEXT-SESSION.md).

**Live today:** deployed on **Railway**, GitHub-connected (push to `main` → auto-deploy, ~5–6
minutes to go live), on the custom domain **doctortrio.online**:

| Surface | URL |
|---|---|
| Patient web app + landing page | `https://doctortrio.online`, `https://app.doctortrio.online`, `https://www.doctortrio.online` |
| Provider/admin panel | `https://admin.doctortrio.online` |
| Widget embed script | `https://doctortrio.online/widget.js` (served by the web service — see note in §5) |

> **The one hard rule:** the **web app must run on a persistent Node host — never
> serverless/edge.** It uses a custom Node server (`apps/web/server.js`) to serve the Twilio phone
> WebSocket; `next start`/serverless silently drop the `/api/phone/stream` upgrade and the phone
> call-center stops working. Railway (or Render, Fly.io, a VM, any container platform running a
> long-lived process) all work; Vercel does not.

## Topology — what runs where

| Service | Build | Start | Port | Notes |
|---------|-------|-------|------|-------|
| **web** (patient + doctor + all `/api/*`, incl. phone WS, incl. `widget.js`) | `pnpm --filter @triaji/web build` | `pnpm --filter @triaji/web start` → `NODE_ENV=production node server.js` | `PORT` (Railway-assigned), `HOSTNAME` 0.0.0.0 | **Persistent Node process.** Custom domains: apex + `www` + `app`. |
| **admin** (provider/platform panel) | `pnpm --filter @triaji/admin build` | `pnpm --filter @triaji/admin start` → `next start` | `--port 3001` / platform port | Standard Next.js. Custom domain: `admin`. |
| **Supabase** | migrations applied | managed | — | Postgres + PostGIS + pgvector. |
| **Cron scheduler** | — | hits `/api/cron/*` on the web host | — | Any scheduler (Railway cron, GitHub Actions, cron-job.org) with the `CRON_SECRET` header. |
| **mobile** | EAS build | app stores | — | Separate release train — see [NEXT-SESSION.md](NEXT-SESSION.md) mobile checklist. |

Two Railway services that look plausible but **should not exist** as public services: a `widget`
service and a `mobile` service. Neither serves real traffic — the widget is built into and served
by the **web** service (`apps/web/public/widget.js`, copied there by `pnpm build:widget` — see §3),
and mobile is a native app shipped through app stores, not something hosted. Delete them if you
created them; they only cost resources.

Each Railway service reads the repo's own `package.json` → `engines` field to pick a Node version
(Railpack). See §3 for why this matters more than it looks.

## 1. Prerequisites

1. **Supabase project** with the extensions enabled (PostGIS, vector, uuid-ossp, pg_trgm, unaccent —
   migration `001` does this) and **all migrations applied in order** (`supabase/migrations/001…065`
   at the time of writing — check `supabase/migrations/` for the current highest number). Apply via
   the Supabase SQL editor or CLI. Verify the RPCs exist (e.g. `find_labs_near`, `reserve_slot`,
   `next_clinical_document_number`, `tenant_list_stats`).
2. **Seed** the knowledge base so triage retrieval works: `pnpm seed:kb && pnpm embed:kb`
   (`COHERE_API_KEY` required). Optionally `pnpm seed:doctors && pnpm seed:slots` for demo data.
3. **Supabase keys:** use the current `sb_publishable_…` / `sb_secret_…` keys. **Legacy keys are
   disabled and will 401** — any older deployment on them must be re-keyed.
4. **Supabase Auth → URL Configuration:** set **Site URL** to your production web URL
   (`https://doctortrio.online`), and add `https://<admin-host>/set-password` to **Redirect URLs**
   — this is where the admin invite-flow's magic links land (see the Users section in
   [user-guide.md](user-guide.md)). A stale Site URL silently sends invite links to the wrong
   domain instead of erroring.
5. A **platform admin** user in `admin_users` (role `platform_admin`) to bootstrap the admin panel
   and verify doctors. `PLATFORM_ADMIN_SECRET` gates admin bootstrap. Once one platform admin
   exists, every subsequent admin user (any role/tenant) can be created from the panel itself —
   Admin → Users → Invite User — no more manual Supabase-dashboard steps.
6. **Anthropic API credit.** The account behind `ANTHROPIC_API_KEY` needs a positive balance or
   every AI triage call (chat, widget, health assistant, phone) 500s with a billing error — the
   app degrades to a graceful Arabic fallback message, so this fails silently from the outside.
   Check with a minimal `POST /v1/messages` call if triage replies look wrong after a deploy.

## 2. Environment variables

Set the full production env on **both** the web and admin services (they share the same variables).
Copy from `.env.example` — grouped in [getting-started.md](getting-started.md#environment-variables-grouped).
Minimum to boot: the three **Supabase** vars + `ANTHROPIC_API_KEY` + `COHERE_API_KEY` +
`NEXT_PUBLIC_APP_URL` (your public web URL). Add the rest as you enable each integration:

- **Messaging:** `WHATSAPP_*`, `SMS_GATEWAY_*`, `SMS_SENDER_NAME` (OTP + booking confirmations —
  the sender name/ID is registered with the SMS gateway separately from this env var; renaming it
  is a gateway-side request, not just a config change).
- **Payments:** `FAWRY_*`, `PAYMOB_*`, `VF_*`.
- **Telehealth:** `LIVEKIT_API_KEY/SECRET/URL`.
- **Phone:** `TWILIO_*`, `DEEPGRAM_API_KEY`, `ELEVENLABS_*`, `HUMAN_AGENT_PHONE`,
  `TWILIO_WEBHOOK_BASE_URL`.
- **Cache/push:** `UPSTASH_REDIS_REST_*`, `EXPO_ACCESS_TOKEN`.
- **HIS / lab chains:** `HIS_ENCRYPTION_KEY`, `ALBORG_*`, `ALMOKHTABAR_*`, `ALFA_*`.
- **Ops:** `CRON_SECRET` (protects `/api/cron/*`), `PLATFORM_ADMIN_SECRET`.

Most features **degrade gracefully** when a key is absent — deploy first with the core set, then
light up integrations.

> **`apps/web/.env.local` and `apps/admin/.env.local` are symlinks** to the repo-root `.env.local`
> for local dev — irrelevant on Railway, which reads service-level environment variables you set
> in its dashboard, not `.env.local` files (that file isn't committed and shouldn't be uploaded).

## 3. Build — three real failure modes we hit, and the fixes already in the repo

CI (`.github/workflows/ci.yml`) runs typecheck/lint/test/build on every push, but **CI green does
not guarantee a Railway build succeeds** — Railway's builder (Railpack) installs and builds in a
subtly different environment (no pre-populated `.env.local`, its own Node-version resolution, a
layered install that can hoist packages differently than a fresh local install). Three real
failures we hit shipping this app, and why the fixes matter if you touch these areas:

1. **A Supabase (or any external) client instantiated at module scope in an API route** crashes
   "Collecting page data" when the build environment has no env vars set — which Railway's build
   step legitimately doesn't. **Fix:** every Supabase client must be created lazily inside a
   function (`getServiceClient()` / `getAnonClient()` pattern — see any `apps/web/app/api/**/
   route.ts` for the convention), never as a top-level `const`.
2. **A server component that queries the database with no `dynamic` export** gets statically
   prerendered at build time instead of per-request — which either bakes in stale data or crashes
   the build outright if the DB call fails without env vars. **Fix:** any page/route that reads
   live data needs `export const dynamic = 'force-dynamic';`.
3. **`engines.node` in the root `package.json` matters more than it looks.** We had it as
   `>=18.17.0`; Railpack resolved that to literal Node **18.20.8**, which lacks the global `File`
   class (added in Node 20) — a dependency in the telehealth transcription path referenced it and
   crashed "Collecting page data" with a bare `ReferenceError`. **Fixed** by tightening
   `engines.node` to `>=20.0.0 <23` so Railpack installs Node 22.x (matching `.claude/launch.json`'s
   dev pin). If you ever see a Node-version-shaped build error, check this field first — a build
   that passes locally can still fail on Railway purely from Node-version drift.
4. **Two `@types/react` majors coexist in this workspace on purpose** (18.x for `apps/mobile` and
   `apps/widget`, 19.x for `apps/web` and `apps/admin` — a real, intentional split, not a bug to
   "fix" by unifying versions). Railway's install can occasionally hoist the 18.x copy into the
   19.x app's type-check, producing a nonsensical `ReactNode is not assignable to ReactNode` error
   on code that hasn't changed. **Fixed** by pinning `react`/`react-dom` type resolution to each
   app's own `node_modules/@types/react` via `paths` in `apps/web/tsconfig.json` and
   `apps/admin/tsconfig.json` — don't remove that pin.

If a Railway build fails and the log doesn't obviously match one of the above, reproduce it in a
**clean-room local install** before debugging further — a fresh `git archive` extract, delete
`node_modules`, `pnpm install --frozen-lockfile` with the same pnpm/Node versions Railway used
(shown at the top of its build log) — rather than debugging against your existing `node_modules`,
which has state a fresh Railway build never has.

For a release, build from a green commit:

```bash
pnpm install --frozen-lockfile
pnpm typecheck && pnpm lint && pnpm test     # gate (matches CI)
pnpm build                                    # widget → web → admin
```

`pnpm build` builds the widget first and copies it into `apps/web/public` (`pnpm build:widget`,
which runs `vite build` then `cp dist/widget.js ../web/public/widget.js`), then builds web, then
admin. **This ordering is why the widget doesn't need — and shouldn't get — its own hosted service**:
it ships as a static asset inside the web app's build output. If you configure Railway to build the
web service directly (rather than via the root `pnpm build`), make sure the widget step still runs
first, or the deployed web service will serve a stale `widget.js`.

## 4. Deploy the web service

1. Provision a **persistent Node** service on Railway (or equivalent). Build:
   `pnpm install --frozen-lockfile && pnpm --filter @triaji/web build` (ensure the widget step ran
   first — see §3). Start: `pnpm --filter @triaji/web start`. Expose `PORT` (Railway sets this
   automatically; `server.js` reads `PORT` and binds `0.0.0.0`).
2. Set the full env (§2). Set `NEXT_PUBLIC_APP_URL` to the public URL.
3. **Custom domains** (Railway service → Settings → Networking → Custom Domain): add the apex
   domain, `app.<domain>`, and `www.<domain>` — all three on this **one** service. Railway shows a
   CNAME target per hostname (the apex needs an **ALIAS** record at your DNS provider, not CNAME,
   since CNAME isn't valid at a zone apex — Namecheap calls this record type "ALIAS"; other
   registrars may need a 301 redirect to `app.<domain>` instead if they lack ALIAS support).
   Certificates issue automatically once DNS resolves (a few minutes after the CNAME/ALIAS
   propagates).
4. Ensure **WebSocket upgrades** pass through the proxy/load balancer (needed for
   `/api/phone/stream`) — Railway's default proxy handles this correctly; verify if you're behind
   an additional CDN/WAF.

## 5. Deploy the admin service

Separate Railway service. Build: `pnpm install --frozen-lockfile && pnpm --filter @triaji/admin
build`. Start: `pnpm --filter @triaji/admin start`. Same env as web. Custom domain:
`admin.<domain>` (one CNAME record — the admin service never needs the apex). Remember the
Supabase redirect-URL entry from §1.4 once this domain is live.

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
- **Widget embed:** the snippet on the landing page reads `https://<web-host>/widget.js` — the
  widget derives its own API base from the `<script src>` origin at load time, so it always talks
  back to whichever host served it. No separate widget domain or config needed (see §3's note on
  why the `widget` Railway service is redundant).

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
credit) → book a doctor; doctor registration (all three clinic-affiliation modes — see
[user-guide.md](user-guide.md)) → admin approval provisions what it should; admin login → a
dashboard loads; admin → Users → invite a test user → the link lands on `/set-password` and signs
in afterward; embed the widget on an unrelated test page and confirm it mounts and calls the right
API origin; if configured, place a real **test phone call** and a **test payment**.

## 9. Rollback & operational notes

- **Rollback:** redeploy the previous green commit (on Railway: re-run/roll back to a prior
  successful deployment from the service's Deployments tab). App code carries no destructive
  migrations at deploy time — **DB migrations are applied manually and are forward-only**, so a
  code rollback is safe as long as the newer migrations are additive (all migrations so far are).
  Never auto-run migrations on boot.
- **Migrations:** apply new `NNN_*.sql` files to Supabase **before** (or with) the deploy that needs
  them. Routes that depend on a new RPC (e.g. `find_labs_near`, `next_clinical_document_number`) have
  a **legacy fallback** and log a warning until the migration is applied — check logs for
  `"legacy path"` / `"RPC unavailable"` after a deploy to confirm the migration landed. The doctor
  clinic-registration API routes degrade the same way: they work before migration 064/065 are
  applied, just without persisting the clinic-affiliation intent.
- **Monitoring:** point an uptime monitor at `/api/health`; add error tracking (e.g. Sentry). Watch
  the phone WS by confirming a test call connects.
- **Secrets:** rotate the Supabase service-role key, `CRON_SECRET`, and provider secrets via the host's
  secret store; never commit them. `.env.local` is git-ignored.
- **Scaling:** the web service is stateful only via the phone WS during a live call — scale
  horizontally behind a WS-aware load balancer; Redis (Upstash) holds OTP/session cache across
  instances.

## Deploy checklist (quick)

- [ ] Supabase reachable, all migrations applied through the current highest number, KB seeded + embedded
- [ ] Current `sb_publishable_`/`sb_secret_` keys (not legacy)
- [ ] Supabase Auth Site URL + `/set-password` redirect URL configured
- [ ] Web on a persistent Node host, `node server.js`, custom domains (apex + `www` + `app`), WS upgrades allowed, full env set
- [ ] Admin deployed as its own service, custom domain (`admin`), same env
- [ ] `widget` / `mobile` Railway services (if any) deleted — not needed
- [ ] Cron scheduler hitting `/api/cron/*` with `CRON_SECRET`
- [ ] Provider webhooks pointed at the web host (Twilio, payments, lab chains)
- [ ] `curl /api/health` = 200, `SMOKE_BASE_URL=… pnpm test:smoke` = 14 passing, drift = 0/0
- [ ] Manual spot-check: patient login + triage, doctor registration + clinic provisioning, admin login + user invite, widget embed, (if configured) test call + payment
