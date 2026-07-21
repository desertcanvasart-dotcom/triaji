# Architecture

## The monorepo

Triaji is a **pnpm workspace** monorepo. Four apps sit on top of eight shared packages, all over a
single Supabase backend.

```
triaji/
├── apps/
│   ├── web      — patient app + doctor portal   (Next.js 15 / React 19, :3000)
│   ├── admin    — provider/platform panel        (Next.js, English-only, :3001)
│   ├── mobile   — patient + doctor               (Expo / React Native)
│   └── widget   — embeddable triage widget        (Vite build → copied into web/public)
├── packages/
│   ├── shared                — types, i18n, constants, Supabase clients, prompts
│   ├── rules-engine          — emergency detection + risk scoring (pure, tested)
│   ├── normalization         — Egyptian-Arabic symptom normalization (tested)
│   ├── his-adapters          — Hospital Information System connectors
│   ├── insurance-adapters    — insurer connectors
│   ├── payment-adapters      — Fawry / Paymob / Vodafone Cash
│   ├── lab-chain-adapters    — Al-Borg / Al-Mokhtabar / Alfa
│   └── stt-bench             — speech-to-text benchmark harness (standalone tool)
└── supabase/
    ├── migrations/           — 63 ordered SQL migrations
    └── seed/                 — KB, doctors, availability seeders
```

See [modules.md](modules.md) for the detail of each app and package.

## The apps

- **`web`** — the core product (~102 pages, ~144 API routes). It is **both** the patient app **and**
  the doctor portal. Bilingual: Arabic is the default and RTL (Egyptian colloquial copy), English is
  LTR. Locale is a path prefix — parallel `app/ar/...` and `app/en/...` trees. The doctor portal
  lives under `/{locale}/doctor`, with authenticated pages in an `(authenticated)` route group. Runs
  on a **custom Node server** (`server.js`) that adds the phone-call WebSocket.
- **`admin`** — the provider and platform panel (~70 pages, ~96 API routes), English-only. Route
  groups `(platform)` (platform-admin pages) and `(tenant)` (per-tenant provider pages), plus
  top-level sections per tenant type: `clinic`, `lab`, `pharmacy`, `insurance`, `icu`, `chain`,
  `dashboard`.
- **`mobile`** — Expo Router app (~42 screens) for patients and doctors: `(auth)`, `(patient)`,
  `(doctor)`, `(shared)`, `(tabs)`, plus `booking` and `telehealth`. Talks to the `web` API over
  HTTPS. Uses LiveKit for video, react-native-maps for geo, MMKV for storage.
- **`widget`** — a self-contained Vite bundle that hospitals embed on their own sites; it drives the
  triage flow against the web app's `/api/embed*` routes and logs an engagement funnel to
  `widget_events`.

## The backend

**Supabase** — Postgres with three critical extensions:

- **PostGIS** — geospatial: `doctors.location`, `governorates` centroids/boundaries,
  `lab_chain_branches.location`, and the proximity RPCs (`find_doctors_near`, `find_icu_beds_near`,
  `find_labs_near`, `find_nearest_chain_branches`).
- **pgvector** — `kb_embeddings.embedding VECTOR(1024)` with an ivfflat cosine index, powering RAG
  triage retrieval (`match_kb_documents`) over Cohere `embed-multilingual-v3` embeddings.
- **pg_trgm / unaccent / uuid-ossp** — fuzzy Arabic text matching and UUID PKs.

Everything is **multi-tenant** (most tables carry `tenant_id`) and **RLS-gated**. See
[data-model.md](data-model.md) for the full schema and the access model.

## Auth & access model

There are **four distinct auth identities**, each with its own scheme:

| Identity | How they log in | How requests are authed | Backing table |
|----------|-----------------|------------------------|---------------|
| **Patient** | Phone + OTP (WhatsApp→SMS) | HMAC-signed `patient-token` cookie, verified per request | `patients` |
| **Doctor** | Email + password (Supabase auth) | `Authorization: Bearer` (or cookie) → `doctor_accounts`, must be `verified` | `doctor_accounts` (PK = `auth.users.id`) |
| **Provider / platform admin** | Email + password (Supabase auth) | `authenticateAdmin` — httpOnly session cookie, role-checked | `admin_users` (PK = `auth.users.id`) |
| **Machine** | — | Webhook signature (payments/labs/Twilio) or `CRON_SECRET` header | — |

**Server-side data access** uses the Supabase **service-role key** (which bypasses RLS) inside API
routes; the **anon/publishable key** shipped to the browser is default-deny on sensitive tables and
only sees public reference data (specialties, doctors directory, KB, catalogs). Migration `058`
hardened RLS by removing anon-facing `tenant_id IS NULL` leaks.

Two notable auth details from recent work:
- **Admin** session tokens are set as **httpOnly** cookies server-side (`/api/admin/auth/session`)
  and kept fresh on refresh by a `SessionSync` client component; the middleware also caches the
  verified admin in a short-lived signed cookie to skip repeat Supabase round-trips.
- **Doctor** accounts must be `verification_status = 'verified'` (approved by a platform admin) to
  reach the authenticated portal.

## How a triage request flows (end to end)

1. **Input** — a patient submits symptoms via the web chat (`POST /api/chat`), the mobile app, the
   embeddable widget (`/api/embed`), or a phone call (`/api/phone/*`, transcribed live via Deepgram).
2. **Normalization** — [`@triaji/normalization`](modules.md#triajinormalization) maps Egyptian-Arabic
   dialect text to structured symptom codes, body parts, and severity.
3. **Rules screen** — [`@triaji/rules-engine`](modules.md#triajirules-engine) runs **deterministically**:
   emergency detection first (red-flag rules, incl. paediatric), then the Baseline Risk Score (BRS),
   then an urgency level. Emergencies short-circuit the flow with an escalation.
4. **RAG retrieval** — the message is embedded (Cohere) and `match_kb_documents` pulls relevant
   knowledge-base chunks via pgvector.
5. **LLM turn** — the triage orchestrator (`apps/web/lib/triage/orchestrator.ts`) builds a
   language-aware system prompt (profile + BRS + retrieved docs + recent health records) and calls
   **Claude**; the reply is parsed for the determined specialty and whether the session is complete.
6. **Matching & booking** — on completion, the determined specialty + patient location drive
   `find_doctors_near` (PostGIS) to recommend doctors; the patient books a slot via `POST /api/booking`,
   which calls `reserve_slot` (atomic, prevents double-booking) and sends a WhatsApp/SMS confirmation.
7. **Onward care** — the encounter can branch to telehealth (LiveKit), clinical documents
   (prescriptions/lab/imaging orders → labs & pharmacies), insurance (pre-auth + claims), or ICU
   transfer.

The orchestrator parallelizes the independent steps (RAG, recent records, history) and the rules
engine is synchronous and sub-5ms, so a turn is dominated by the Cohere + Claude round-trips.

## External services

Anthropic (triage + health assistant), Cohere (embeddings), Deepgram + OpenAI Whisper (STT),
ElevenLabs (TTS for phone), Twilio (phone), LiveKit (telehealth video), WhatsApp + an SMS gateway
(OTP + confirmations), Upstash Redis (OTP/session cache), Expo Push, Fawry/Paymob/Vodafone
(payments), and three lab chains. **Most features degrade gracefully when a given key is absent.**

## Conventions

- **Deterministic clinical logic** (risk scoring, emergency detection) lives in
  `packages/rules-engine`, never in app code, and has tests that must stay green.
- **`@triaji/shared`** is the single source of truth for cross-app types.
- **Locale mirroring:** a change under `app/ar/...` almost always needs the mirror under `app/en/...`.
- **Server-only** code uses the service-role key and must never expose it to the client.
</content>
