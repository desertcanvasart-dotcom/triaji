# CLAUDE.md

Guidance for working in this repository.

## What this is

**DoctorTrio** (دكتور تريو) — an Arabic-first, bilingual (Arabic-RTL / English-LTR) AI medical
triage & booking SaaS for the Egyptian healthcare market, live at **doctortrio.online**
(app.doctortrio.online = web app, admin.doctortrio.online = provider panel). Formerly branded
"Triaji/Triajji (ترياچي)" — internal identifiers (the `@triaji/*` package namespace, `triaji-`
CSS prefixes, repo paths) intentionally keep the old name; user-facing strings use DoctorTrio. It connects patients, doctors,
clinics, labs, pharmacies, insurers, and ICU registries in one platform. AI triage runs on
Claude with a Cohere-embedded RAG knowledge base.

The single best reference for product behavior is
[docs/triaji-full-walkthrough.md](docs/triaji-full-walkthrough.md) — a page-by-page tour of
every screen, flow, and API route. Read it before building a feature. Phase design docs live
in [.claude/plans/](.claude/plans/) (phases 22–30).

## Monorepo layout (pnpm workspaces)

**Apps** (`apps/`):
- `web` — patient web app **and** doctor portal. Next.js 15 / React 19 / Tailwind. The core
  product (~100 pages, ~130 API routes). Runs on **:3000**.
- `admin` — provider/admin panel (clinics, labs, pharmacies, insurers, ICU, chains).
  Next.js, English-only. Runs on **:3001**.
- `mobile` — Expo / React Native (patient + doctor).
- `widget` — embeddable triage widget (Vite build, copied into web's public dir).

**Packages** (`packages/`):
- `shared` — types, i18n strings, constants. Imported as `@triaji/shared`.
- `rules-engine` — BRS (Background Risk Score) calculator + emergency-detection rules
  (incl. paediatric rules). Has vitest tests.
- `normalization` — symptom/severity normalization. Has vitest tests.
- `his-adapters` — Hospital Information System adapters (Neuron, Shifa, Generic, Mock).
- `insurance-adapters` — AXA, MetLife, Allianz, GlobeMed, Medmark.
- `payment-adapters` — Fawry, Paymob, Vodafone Cash.
- `lab-chain-adapters` — Al-Borg, Al-Mokhtabar, Alfa.
- `stt-bench` — speech-to-text benchmarking.

**Backend**: Supabase (Postgres + PostGIS + Row-Level Security). Migrations are in
[supabase/migrations/](supabase/migrations/) (run in numeric order), seeds in
[supabase/seed/](supabase/seed/).

## Routing & i18n conventions (web app)

- Locale is a path prefix: parallel route trees `app/ar/...` and `app/en/...`. A change to one
  locale almost always needs the mirror change in the other.
- Arabic is the default and is RTL; uses Egyptian colloquial copy. Tailwind RTL via
  `tailwindcss-rtl`.
- Doctor portal lives inside the web app under `/{locale}/doctor`, with authenticated pages in
  a `(authenticated)` route group.
- Admin app uses route groups `(platform)` (platform-admin pages) and `(tenant)` (per-tenant
  provider pages), color-coded per tenant type.

## Commands

Use **pnpm** (v9+). Node: see "Toolchain gotcha" below.

```bash
pnpm dev            # web app  → :3000
pnpm dev:admin      # admin    → :3001
pnpm dev:widget     # widget dev
pnpm build          # builds widget, then web, then admin
pnpm lint           # all packages
pnpm typecheck      # tsc --noEmit across the workspace
pnpm test           # all package tests
pnpm test:rules     # rules-engine tests only
pnpm test:normalization

# Knowledge base (RAG) pipeline
pnpm seed:kb        # seed KB documents
pnpm embed:kb       # generate Cohere embeddings
pnpm test:search    # test semantic search
```

Per-package work: `pnpm --filter @triaji/<name> <script>` (e.g.
`pnpm --filter @triaji/web typecheck`).

## Environment

- The real secrets live in the repo-root **`.env.local`** (not committed).
  `.env.example` documents every variable.
- `apps/web/.env.local` and `apps/admin/.env.local` are **symlinks** to the root `.env.local`.
  If the apps can't see env vars, these symlinks are probably broken (they previously pointed at
  a stale path) — re-create them:
  ```bash
  ln -sf "$PWD/.env.local" apps/web/.env.local
  ln -sf "$PWD/.env.local" apps/admin/.env.local
  ```
- External services wired up: Anthropic, Cohere (embeddings), Deepgram + OpenAI Whisper (STT),
  ElevenLabs (TTS), Twilio (phone), LiveKit (telehealth video), WhatsApp + SMS gateway,
  Upstash Redis (OTP/session cache), Expo Push, Fawry/Paymob/Vodafone (payments), and three lab
  chains. Most features degrade gracefully when a given key is absent.

## Toolchain gotcha

`.claude/launch.json` pins Node **v22.21.1** (via nvm) for the dev servers, while a plain shell
here may default to Node v20. Both satisfy `engines` (>=18.17), but match the launch config when
reproducing dev-server behavior. Prefer the preview tooling / `pnpm dev` over ad-hoc `node`.

## State of the repo (important)

Git history currently ends at **"Phase 6"**, but the working tree contains a large amount of
**uncommitted** work — essentially phases 7–30 (the admin panel, the mobile app, most web pages
and API routes, and migrations beyond 010). `git log` therefore badly understates what exists;
trust the files on disk. Commit/branch deliberately and only when asked.

## Conventions

- Match the surrounding code's style, naming, and comment density per file.
- Keep `@triaji/shared` types as the single source of truth for cross-app types.
- Triage/clinical logic that must be deterministic (risk scoring, emergency detection) belongs in
  `packages/rules-engine`, not in app code — and it has tests; keep them green.
- Supabase access is RLS-gated; server-only code uses the service-role key (never expose it to the
  client). Patient-facing queries must respect the locale and the selected profile (adult vs child).
