# Triaji — Documentation

**Triaji** (ترياچي) is an Arabic-first, bilingual (Arabic-RTL / English-LTR) AI medical **triage
& booking** SaaS for the Egyptian healthcare market. It connects patients, doctors, clinics,
labs, pharmacies, insurers, and ICU registries in one platform. AI triage runs on Claude with a
Cohere-embedded RAG knowledge base, and the whole system is multi-tenant over Supabase (Postgres
+ PostGIS + pgvector, RLS-gated).

This folder is the developer documentation. For the **page-by-page product tour** (every screen
and flow, written from the user's perspective) see
[triaji-full-walkthrough.md](triaji-full-walkthrough.md).

## Documentation map

| Doc | What's in it |
|-----|--------------|
| [getting-started.md](getting-started.md) | Prerequisites, install, environment, running each app, seeding, common commands. **Start here to run it locally.** |
| [architecture.md](architecture.md) | The monorepo, the four apps, the backend, the request/auth model, external services, and how a triage request flows end-to-end. |
| [modules.md](modules.md) | Every module — the 4 apps + widget and the 8 shared packages — with purpose, structure, and key files. |
| [data-model.md](data-model.md) | The Postgres schema by domain, key relationships, the RLS access model, the PostGIS/pgvector RPCs, and migrations. |
| [api-reference.md](api-reference.md) | The full API route catalog (240 routes) grouped by domain, with methods, purposes, and auth style. |
| [user-guide.md](user-guide.md) | How to use the app for each role — patient, doctor, and the provider/admin roles (clinic, lab, pharmacy, insurance, ICU, chain, platform). |
| [triaji-full-walkthrough.md](triaji-full-walkthrough.md) | The exhaustive product walkthrough (154 sections). |

## Operational / project docs

| Doc | What's in it |
|-----|--------------|
| [NEXT-SESSION.md](NEXT-SESSION.md) | The living "start here" for the next work session — current state, delivery checklist, recent changes. |
| [remaining-work.md](remaining-work.md) | Detailed backlog / remaining-work notes. |
| [lab-chain-activation.md](lab-chain-activation.md) | How to activate a lab-chain integration. |
| `scan-drift.py` / `scan-embeds.py` | Live-schema drift and embedding scanners (run against the deployed Supabase). |

## The 30-second overview

- **What it does:** a patient describes symptoms in Egyptian-Arabic (typed, spoken, or by phone);
  a deterministic rules engine screens for emergencies and scores baseline risk; Claude — grounded
  in a RAG medical knowledge base — runs the triage conversation and determines the right
  specialty; the patient is then booked with a matched doctor (in-person or telehealth), and the
  encounter can flow onward to labs, pharmacies, and insurance.
- **Who uses it:** patients and doctors (the `web` app + `mobile` app), and provider/platform
  staff — clinics, labs, pharmacies, insurers, ICU coordinators, chains (the `admin` app).
- **How it's built:** a pnpm monorepo — `web` (patient + doctor, Next.js, :3000), `admin`
  (providers, Next.js, :3001), `mobile` (Expo/React Native), `widget` (embeddable triage widget) —
  over Supabase, with clinical logic isolated in tested `packages/`.

See [architecture.md](architecture.md) for the full picture.
</content>
