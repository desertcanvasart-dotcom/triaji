# Demo mode — plan (not built yet)

Goal: a doctor can try the whole doctor portal with realistic sample data in one
click, with no sign-up, then turn it into a real account. Competitor reference:
mostashfaon.com's demo (timer bar, "Reset demo", "Create your real account").

## Defaults chosen (change any of these before building)

| Decision | Default | Alternatives |
|---|---|---|
| What the demo covers | **Doctor portal only** (Today, calendar, exams, prescriptions, billing, reports, assistants view) | + clinic admin panel later |
| How long a demo lasts | **60 minutes**, then it is deleted | 30 min / 24 h |
| AI inside the demo | **On, capped at 5 AI calls per demo** | Off (canned results) / no cap |
| Where to start it | **Doctor login page button + shareable link** `/ar/doctor/demo` | Also the "for doctors" landing section |

## How it works

1. **Start.** "جرّب النسخة التجريبية" → `POST /api/doctor/demo/start`.
   - Rate-limited per IP (Upstash Redis, ~5 demos / hour / IP) so nobody can flood the DB.
   - Creates a **private sandbox**: its own clinic (tenant), doctor, verified
     doctor account (auth user `demo-<id>@demo.doctortrio.online`, random password),
     signs the visitor in (same cookies as a normal login) and opens **Today**.
2. **Sample data** (Egyptian Arabic, clearly fake; phones like `0100000xxxx`):
   - 3 visit types with prices, slots for this week, 1 day off on the calendar.
   - Today: ~8 patients — one in the room, three waiting, expected bookings, a walk-in,
     one no-show; a couple already billed (paid / unpaid / insurance).
   - Last 60 days of visits + invoices so **Reports** has real-looking charts.
   - A few past exam summaries, prescription templates, custom exam fields.
3. **While in the demo.**
   - Top bar: "نسخة تجريبية — باقي 42 دقيقة" · **إعادة الديمو** · **أنشئ حسابك الحقيقي**.
   - "Reset demo" wipes this sandbox and re-seeds it (same login).
   - "Create your real account" signs out of the demo and opens registration.
4. **End.** After 60 minutes the session stops working and the sandbox is deleted.

## Keeping demo data away from real data (most important part)

- Migration **080**: `is_demo` flag on `tenants`, `doctors`, `doctor_accounts`, `patients`,
  plus a `demo_sessions` table (account, tenant, expires_at, ai_calls_used).
- Demo doctors are created with `is_active = false`, so they never show up in patient search,
  triage doctor matching or the public booking flow (all already filter on `is_active`).
- **No messages leave the system for a demo clinic**: one guard in the WhatsApp / SMS / email /
  push senders skips anything for an `is_demo` tenant. Online payments disabled in demo.
- Clinic-panel platform lists (doctors, clinics, analytics) hide `is_demo` rows.
- Deletion through one database function `purge_demo_tenant(tenant_id)` that removes rows in
  the right order (invoices → queue → bookings → slots → patients → doctor → tenant), then the
  auth user. Expired sandboxes are purged every time a new demo starts, and by an optional
  cron URL (`/api/cron/demo-cleanup`, protected by `CRON_SECRET`) for Railway.

## Build phases

| Phase | What | Needs SQL? |
|---|---|---|
| 1 | Migration 080, `start` endpoint, seeder, demo guards, timer bar | Yes (080) |
| 2 | Reset demo, "create real account", purge function + cleanup | In 080 |
| 3 | Entry buttons (login page, shareable link), AI cap, polish, live test | No |

Estimated size: large — about the effort of Today + billing together.

## Risks / things to verify while building

- Every table that references a doctor/tenant must be covered by the purge function, or
  deletes will fail on foreign keys — audit all migrations first.
- Any background job (reminders, queue "almost your turn") must skip demo tenants.
- Railway env: needs Upstash Redis keys (already used for OTP) for the rate limit.
