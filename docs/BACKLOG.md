# DoctorTrio — open backlog

_Last updated: 15 Oct 2026. Items still to do after the competitor-comparison work
(Today screen, prescription templates, calendar & days off, waiting-room screen,
assistants, billing on Today, custom exam fields — all live)._

## 1. Blocked on an outside service

| Item | Why it's blocked | Notes |
|---|---|---|
| **WhatsApp / SMS not sending** | Provider issue — owner checking | Blocks everything below that needs a code or a message. |
| Patient sign-in (`/ar/login`) | Uses a WhatsApp/SMS code | Works once messaging is back. |
| Booking confirmations, queue "your turn / almost next" messages | WhatsApp/SMS | Code is in place; nothing goes out until messaging works. |
| Doctor password reset by phone | WhatsApp/SMS | Doctors also get the code by email now, so this isn't stuck. |

## 2. Features not built yet

| # | Feature | Size | Notes |
|---|---|---|---|
| 1 | **Demo mode** — try the full product with sample data, timer bar, "Reset demo", "Create your real account" | Large | Use a separate demo clinic/doctor that is wiped and re-seeded, never real data. Write a plan first. |
| 3 | **Notify waiting patients** ("تنبيه المرضى") — e.g. "the doctor is running 30 min late" to everyone in today's queue | Small–medium | Needs WhatsApp/SMS working. |
| 6 | **Patient sign-in button in the main header** + **book a doctor without triage** for signed-in patients | Medium | Postponed until WhatsApp/SMS work. Can reuse the direct-booking path built for clinic pages. |
| 7 | **Files in custom exam fields** | Medium | Needs file storage (Supabase Storage bucket). |
| 8 | **Show custom exam field values on printed documents / PDFs** | Small–medium | Values are saved per visit but not printed yet. |
| 9 | **Invoice printing / PDF** | Medium | The clinic panel linked to a PDF route that never existed — link removed. |
| 10 | **Walk-in "you're registered, your number is…" WhatsApp message** from the Today screen | Small | Clinic panel sends it; the doctor portal doesn't yet. Needs messaging. |
| 11 | **Structured lab results** shown on the exam page (web + mobile) | Large | No table for lab results yet; the mobile screen shows an empty state. |

## 3. Loose ends and known gaps

- **Mobile app needs a new build (Expo / EAS)** so the exam-screen fix reaches phones.
- **"Today" date mismatch around midnight** — the doctor portal uses the Cairo date, the clinic panel's queue uses the UTC date, so between 00:00 and 03:00 Cairo time they disagree. Only matters for clinics open past midnight.
- **English doctor pages missing from middleware protection** (dashboard, settings, etc.). Data is still protected by the APIs; pages just don't redirect to login early.
- **Things only tested with sample data** — check on the live site: clinic public booking page (`/ar/clinic/<name>`), Today billing, assistants, exam fields, waiting-room screen chime.
- **`DISPLAY_TOKEN_SECRET`** (optional) — set on Railway if you want to be able to revoke all waiting-room screen links later.

## 4. Done in this round (for reference)

Today screen · call next / check-in / walk-ins · billing on Today + clinic-panel billing fix ·
prescription templates · drug-interaction check actually running · exam page crash fix ·
mobile exam data fix · month calendar + days off enforced everywhere · waiting-room TV screen ·
clinic public booking fix · doctor assistants · custom exam fields · admin + doctor password
reset by email · "view as assistant" toggle · visit types with their own price (migration 079) · doctor reports (visits, no-shows, income by
day/month, visit type and payment method, CSV + print).
