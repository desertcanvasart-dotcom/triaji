# Triaji (ترياچي)

An Arabic-first, bilingual AI **medical triage & booking** SaaS for the Egyptian healthcare market —
connecting patients, doctors, clinics, labs, pharmacies, insurers, and ICU registries. AI triage
runs on Claude with a Cohere-embedded RAG knowledge base, over a multi-tenant Supabase backend
(Postgres + PostGIS + pgvector).

pnpm monorepo: **web** (patient + doctor, Next.js, :3000) · **admin** (providers, Next.js, :3001) ·
**mobile** (Expo/React Native) · **widget** (embeddable triage widget), on eight shared
`packages/`.

## Documentation

Full docs are in **[`docs/`](docs/README.md)**:

- **[Getting started](docs/getting-started.md)** — install, environment, run it locally.
- **[Architecture](docs/architecture.md)** — the monorepo, apps, backend, auth, and triage flow.
- **[Modules](docs/modules.md)** — every app and package.
- **[Data model](docs/data-model.md)** — the schema, relationships, RLS, and RPCs.
- **[API reference](docs/api-reference.md)** — all 240 API routes.
- **[User guide](docs/user-guide.md)** — how to use the app per role.
- **[Deployment runbook](docs/deployment.md)** — ship it to production.
- **[Product walkthrough](docs/triaji-full-walkthrough.md)** — the exhaustive screen-by-screen tour.

## Quick start

```bash
pnpm install
# fill root .env.local (see .env.example); apps/{web,admin}/.env.local symlink to it
pnpm dev            # web  → http://localhost:3000
pnpm dev:admin      # admin → http://localhost:3001
```

See [docs/getting-started.md](docs/getting-started.md) for the full setup, seeding, and commands.
</content>
