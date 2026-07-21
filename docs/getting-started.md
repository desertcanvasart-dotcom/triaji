# Getting Started

How to install, configure, and run Triaji locally. See [architecture.md](architecture.md) for
what you're running.

## Prerequisites

- **Node.js** — the dev servers are pinned to **v22.21.1** via nvm in `.claude/launch.json`; a plain
  shell may default to v20. Both satisfy `engines` (`>=18.17`), but match the launch config when
  reproducing dev-server behavior.
- **pnpm v9+** — the workspace package manager. `corepack enable` or install pnpm directly.
- A **Supabase** project (Postgres + PostGIS + pgvector) — the migrations in
  [`supabase/migrations/`](../supabase/migrations/) must be applied to it.
- API keys for the external services you want to exercise (see **Environment** below). Most
  features **degrade gracefully** when a key is absent, so you can start with just Supabase +
  Anthropic + Cohere.

## Install

```bash
pnpm install          # installs all workspace packages
```

## Environment

- Real secrets live in the **repo-root `.env.local`** (never committed). `.env.example` documents
  every variable.
- `apps/web/.env.local` and `apps/admin/.env.local` are **symlinks** to the root `.env.local`. If
  the apps can't see env vars, these symlinks are probably broken — re-create them:
  ```bash
  ln -sf "$PWD/.env.local" apps/web/.env.local
  ln -sf "$PWD/.env.local" apps/admin/.env.local
  ```
- The **mobile** app has its own env at `apps/mobile/.env` (see `apps/mobile/.env.example`) using
  `EXPO_PUBLIC_*` variables, including `EXPO_PUBLIC_API_URL` (the web API base) and the Supabase
  public keys.

### Environment variables (grouped)

Copy `.env.example` → `.env.local` and fill what you need.

| Group | Variables | Needed for |
|-------|-----------|-----------|
| **Supabase** | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Everything (required) |
| **AI** | `ANTHROPIC_API_KEY` | Triage chat + health assistant (required for AI) |
| **Embeddings** | `COHERE_API_KEY` | RAG knowledge-base seeding/search |
| **App** | `NEXT_PUBLIC_APP_URL`, `PLATFORM_ADMIN_SECRET`, `CRON_SECRET` | URLs, admin bootstrap, cron auth |
| **Messaging** | `WHATSAPP_*`, `SMS_GATEWAY_*` | OTP + booking confirmations (WhatsApp primary, SMS fallback) |
| **Voice input** | `OPENAI_API_KEY` | Whisper transcription of voice triage |
| **Telehealth** | `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_URL` | Video consultations |
| **Phone / call center** | `TWILIO_*`, `DEEPGRAM_API_KEY`, `ELEVENLABS_*`, `HUMAN_AGENT_PHONE` | Inbound phone triage IVR (needs a custom server, see below) |
| **Cache** | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | OTP storage + session caching |
| **Push** | `EXPO_ACCESS_TOKEN` | Mobile push notifications |
| **Payments** | `FAWRY_*`, `PAYMOB_*`, `VF_*` | Fawry / Paymob / Vodafone Cash |
| **Lab chains** | `ALBORG_*`, `ALMOKHTABAR_*`, `ALFA_*` | External lab-chain integrations |
| **HIS** | `HIS_ENCRYPTION_KEY` | Encrypting hospital-system credentials |

## Running the apps

```bash
pnpm dev            # patient + doctor web app  → http://localhost:3000
pnpm dev:admin      # provider/admin panel      → http://localhost:3001
pnpm dev:widget     # embeddable widget dev
```

- **Web** (`:3000`) — patient app and doctor portal. Patient login is at `/ar/login` (phone + OTP);
  doctor login at `/ar/doctor/login` (email + password).
- **Admin** (`:3001`) — provider/platform panel. Login at `/login` (email + password), then
  role-based redirect.
- **Mobile** — `cd apps/mobile && pnpm start` (Expo). It talks to the web API via
  `EXPO_PUBLIC_API_URL`. Needs an EAS dev build for native modules (LiveKit, maps); see
  [NEXT-SESSION.md](NEXT-SESSION.md) for the mobile build checklist.

### The phone call-center server

The inbound-phone pipeline uses a **custom Node server** with a WebSocket upgrade
(`apps/web/server.js`). It only runs when the web app is launched via `node server.js`
(production `pnpm --filter @triaji/web start`) or `pnpm --filter @triaji/web dev:phone` — a plain
`next dev`/`next start` skips the `/api/phone/stream` upgrade. Deploy the web app on a **persistent
Node host, not serverless/edge**, for the phone features to work.

## Database & seeding

Migrations live in [`supabase/migrations/`](../supabase/migrations/) and run in **numeric order**
(`001` … `063`). Apply them to your Supabase project (SQL editor or CLI). Seeds live in
[`supabase/seed/`](../supabase/seed/).

```bash
pnpm seed:kb          # seed knowledge-base documents
pnpm embed:kb         # generate Cohere embeddings for the KB
pnpm test:search      # sanity-check semantic search
pnpm seed:doctors     # seed doctors for specialties that have none
pnpm seed:slots       # give doctors availability slots
```

> **Schema drift:** many routes reference the live DB. When something looks wrong, verify against
> the **live Supabase**, not just the migrations or code (some columns/tables have drifted). The
> `scan-drift.py` scanner and the nightly CI job check this.

## Common commands

```bash
pnpm typecheck        # tsc --noEmit across the whole workspace
pnpm lint             # ESLint across all packages
pnpm test             # all package unit tests (vitest)
pnpm test:rules       # rules-engine tests only
pnpm test:normalization
pnpm test:smoke       # web API smoke tests (needs dev server on :3000 + root .env.local)
pnpm build            # builds widget → web → admin

# per-package
pnpm --filter @triaji/<name> <script>     # e.g. pnpm --filter @triaji/web typecheck
```

Point the smoke suite at a deployed host with `SMOKE_BASE_URL=https://<host> pnpm test:smoke`.

## Toolchain gotchas

- `.claude/launch.json` pins Node **v22.21.1** for dev servers; a plain shell may be v20. Prefer
  the preview tooling / `pnpm dev` over ad-hoc `node`.
- The apps share a `.next` build dir per app — stop the dev server before running a production
  build of the same app.
- Locale is a **path prefix**: parallel route trees `app/ar/...` and `app/en/...`. A change to one
  locale almost always needs the mirror change in the other.
</content>
