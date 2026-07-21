# Modules

Every module in the monorepo — the four apps (+ widget) and the eight shared packages — with its
purpose, structure, and key files.

---

## Apps

### `apps/web` — Patient app + Doctor portal

The core product. Next.js 15 / React 19 / Tailwind, bilingual (AR-RTL default, EN-LTR). ~102 pages,
~144 API routes. Runs on **:3000** via a custom Node server (`server.js`) that adds the phone
WebSocket.

- **Routing:** locale path-prefix trees `app/ar/...` and `app/en/...` (mirror each other). The
  **doctor portal** is under `app/{locale}/doctor`, with authenticated pages in an `(authenticated)`
  route group and its own auth layout.
- **Patient sections:** `chat` (triage), `booking`, `medical-record`, `records`, `history`,
  `health-assistant`, `gp`, `lab`, `pharmacy`, `icu`, `child` (paediatrics), `telehealth`, `pay`,
  `login`, `onboarding`, `share`.
- **Doctor sections:** `dashboard` (appointments), `consultation/[bookingId]`, `patients`,
  `quick-intake`, `settings`, `results`, plus `login`/`register`/`pending`.
- **Key `lib/` modules:** `lib/triage/orchestrator.ts` (the triage brain), `lib/booking/engine.ts`
  (validate → reserve → notify → confirm; native or HIS-backed), `lib/payments/initiate.ts` (shared
  payment core), `lib/pdf/*` (server-side clinical-document PDFs), `lib/embeddings/retriever.ts`
  (RAG), `lib/auth/*` (patient token + api-auth helpers), `lib/his/sync.ts`, `lib/lab/*`.
- **API:** see [api-reference.md](api-reference.md#web-app). Auth: patient HMAC token, doctor Bearer,
  webhook signatures, `CRON_SECRET`.

### `apps/admin` — Provider / platform panel

Next.js, English-only, ~70 pages, ~96 API routes. Runs on **:3001**.

- **Route groups:** `(platform)` (platform-admin pages: tenants, KB, emergency rules) and `(tenant)`
  (per-tenant provider pages), color-coded per tenant type. Top-level sections: `clinic`, `lab`,
  `pharmacy`, `insurance`, `icu`, `chain`, `dashboard`.
- **Auth:** every data route calls `authenticateAdmin` (Supabase session in **httpOnly** cookies,
  role-checked). Login at `/login` → role-based redirect. `middleware.ts` enforces per-role route
  access and caches the verified admin in a signed cookie; `components/auth/SessionSync.tsx` keeps
  the session cookie fresh on token refresh.
- **Key components:** dashboards per tenant type (`components/{clinic,lab,pharmacy,insurance,chain}`),
  the shared `components/charts/` (recharts, dynamically imported), `components/icu/*`,
  `components/layout/*`.

### `apps/mobile` — Patient + Doctor (Expo / React Native)

Expo Router app, ~42 screens. Route groups `(auth)`, `(patient)`, `(doctor)`, `(shared)`, `(tabs)`,
plus `booking` and `telehealth`.

- **Talks to** the web API via `EXPO_PUBLIC_API_URL` (canonical base URL in `lib/config.ts`).
- **Native modules:** `@livekit/react-native` (video calls), `react-native-maps` (ICU/lab maps),
  `react-native-mmkv` (storage), `victory-native` (charts), `expo-local-authentication` (biometric
  gate), `expo-notifications` (push, incl. a high-priority `video-call` Android channel).
- **Key `lib/`:** `lib/api.ts` (shared client wrapper), `lib/storage.ts` (MMKV token store),
  `lib/config.ts` (API base URL), `lib/notifications.ts`, `lib/livekit/*`, `lib/interactions/*`,
  `lib/auth/biometric.ts`. `app/_layout.tsx` is the root shell (biometric gate + incoming-call
  listener + push registration).
- Requires an **EAS dev build** for the native modules; see [NEXT-SESSION.md](NEXT-SESSION.md) for
  the build/store checklist.

### `apps/widget` — Embeddable triage widget

A self-contained **Vite** bundle hospitals embed on their own sites. Built and **copied into the web
app's `public/`** (`pnpm build:widget`). Drives the triage flow against `/api/embed`,
`/api/embed/config`, and `/api/embed/event`, and logs an engagement funnel to `widget_events`
(impression → button_click → session_start → session_complete → booking_started → booking_confirmed).

---

## Packages

All under the `@triaji/*` scope. The four `*-adapters` packages share the same shape: an
`interface.ts` contract, a `factory.ts` selector, and one class per provider under `adapters/`.

### `@triaji/shared`

The foundational library — used by ~200+ files across all apps. Exports (via subpath exports):

- **Types** (`@triaji/shared/types`) — the cross-app domain model: enums (`RiskLevel`, `TenantTier`,
  `SessionStatus`, `BookingStatus`, `HisVendor`, …), and models (`Patient`, `PatientProfile`,
  `TriageSession`, `Doctor`, `Booking`, `Tenant`, `TenantConfig`, `KBDocument`, …).
- **Supabase clients** (`@triaji/shared/supabase`) — `createBrowserClient`, `createServerClient`.
- **Constants** (`@triaji/shared/constants`) — `GOVERNORATES` + lookups, `SPECIALTIES` + lookups, and
  the LLM system prompts `TRIAGE_SYSTEM_PROMPT` / `SUMMARY_SYSTEM_PROMPT`.
- **i18n** (`@triaji/shared/i18n`) — bilingual string tables (`s`, `t`, `Lang`).
- **API client** (`@triaji/shared/api`) — `TriajjiApiClient`.
- **WhatsApp** (`@triaji/shared/lib/whatsapp/client`) — `sendWhatsAppMessage`.

Tests: none. Dependency: `@supabase/supabase-js`.

### `@triaji/rules-engine`

Deterministic, synchronous, pure clinical triage rules — runs in <5ms with no external deps.

- **`evaluate(input)`** — orchestrator: emergency check → BRS → urgency.
- **`checkEmergency` / `EMERGENCY_RULES`** — red-flag matcher + rule table; **`checkEmergencyWithICU`**
  augments it with nearby ICU bed info.
- **`calculateBRS`** — Baseline Risk Score (age/smoking/BP/diabetes/family-history).
- **`determineUrgency`** — `'routine' | 'urgent' | 'emergency'`.

Consumers: the web triage orchestrator + onboarding. **Tests: yes** (BRS, emergency, urgency).
This is where all deterministic clinical logic must live.

### `@triaji/normalization`

Turns Egyptian-Arabic dialect text into structured symptoms — strips diacritics, normalizes
alef/taa-marbuta variants.

- **`normalize(input): NormalizedResult`** — the single export → `{ symptoms, bodyParts, severity,
  confidence, originalText }`, `SeverityLevel = mild|moderate|severe|worst_ever`.

Consumers: the web triage orchestrator; the STT bench seeder. **Tests: yes** (dialect variants).

### `@triaji/his-adapters`

Unified Hospital Information System layer — connection test, doctor sync, availability,
booking/cancellation, optional ICU availability. Includes a **mock HIS server**.

- **`getAdapter(config)`** → `ShifaAdapter | NeuronAdapter | GenericRestAdapter | MockHisAdapter`.
- **Vendors** (`HisVendor`): `shifa`, `neuron`, `generic_rest` (config-driven REST + field mapping),
  `mock`.

Consumers: admin HIS routes + `lib/his/sync.ts`, web HIS/ICU cron + booking engine. **Tests: yes**
(the most thorough adapter suite — credential crypto, factory conformance, mock/neuron schedules,
tenant-isolated token cache).

### `@triaji/insurance-adapters`

Unified insurer layer — policy verification, pre-auth submit/status, claim submit/status.

- **`getAdapter(insurerCode)`** → `axa_egypt`, `metlife_egypt`, `allianz_egypt`, `globemed_egypt`,
  `medmark`.
- **`InsuranceAdapter`**: `verifyPolicy`, `submitPreAuth`, `checkPreAuthStatus`, `submitClaim`,
  `checkClaimStatus`.

> **Note:** this package is currently **not imported by any app code** — the admin insurance UI
> works off `@triaji/shared` and DB tables directly. The adapters are built and typed but unwired;
> confirm intent before relying on them. **Tests: none.**

### `@triaji/payment-adapters`

Unified payment-gateway abstraction — create/verify/refund + webhook signature verification.

- **`getPaymentAdapter(provider)`** → `FawryAdapter | PaymobAdapter | VodafoneCashAdapter`.
- **Providers** (`PaymentProvider`): `fawry`, `paymob`, `vodafone_cash`.
- **`PaymentAdapter`**: `createPayment`, `verifyPayment`, `refund` (+ static `verifyWebhookSignature`).

Consumers: web `payments/initiate`, `webhooks/{fawry,paymob,vodafone}`, booking engine. **Tests: yes**
(security-focused webhook-signature + createPayment mapping — 30 cases). Note: Fawry uses **plain
SHA-256** signatures (not HMAC) — see the tests and the adapter docstrings.

### `@triaji/lab-chain-adapters`

Unified lab-chain layer — order submission, slots, booking, results, payment, webhook verification.

- **`getLabChainAdapter(chainCode)`** → `AlBorgAdapter | AlMokhtabarAdapter | AlfaAdapter`;
  **`isChainApiAvailable(chainCode)`** checks env config.
- **Chains** (`LabChainCode`): `alborg`, `almokhtabar`, `alfa`.

Consumers: admin chain-test route, web lab-chain cron + booking + webhooks + `lib/lab/*`. **Tests:
none.** See [lab-chain-activation.md](lab-chain-activation.md) to activate a chain.

### `@triaji/stt-bench`

Standalone Arabic speech-to-text benchmark harness (not consumed by apps — run via CLI). Measures
WER/CER/latency/cost across providers and emits a markdown report.

- **CLI:** `bin/bench.ts` (`bench`, `bench:batch`, `bench:stream`), `bin/seed-tts.ts` (`seed:tts`).
- **Providers** (loaded only when their key is set): Deepgram Nova-2/Nova-3, OpenAI
  gpt-4o-transcribe / gpt-4o-mini-transcribe / whisper-1, Groq whisper-large-v3, ElevenLabs Scribe.

Runtime deps: `@deepgram/sdk`, `openai`, `ws`, `dotenv`. **Tests: none.**

---

## Test coverage at a glance

| Package | Tests |
|---------|-------|
| `rules-engine` | ✅ BRS, emergency, urgency |
| `normalization` | ✅ dialect variants |
| `his-adapters` | ✅ crypto, factory, mock/neuron, token cache |
| `payment-adapters` | ✅ webhook signatures + createPayment (30 cases) |
| `shared`, `insurance-adapters`, `lab-chain-adapters`, `stt-bench` | ❌ none |

The web app also has a **14-test API smoke suite** (`pnpm test:smoke`).
</content>
