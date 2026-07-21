# API Reference

The complete API route catalog — **144 web routes** + **96 admin routes**, grouped by domain. Each
entry is `METHOD /api/path — purpose`. Some routes expose multiple verbs on one path.

## Auth styles

| Style | Where | How |
|-------|-------|-----|
| **Patient HMAC token** | `patient/*`, `child/*`, patient-side `booking`, medical-record/consent | Signed `patient-token` cookie (from OTP login), verified per request |
| **Doctor Bearer** | `doctor/*`, `icu/*`, `telehealth/gp-*`, `lab/chains/*` booking | `Authorization: Bearer` (or doctor cookie) → `doctor_accounts`, must be `verified` |
| **Admin** | all `admin/*` (94/96), web `provider/*` | `authenticateAdmin` — httpOnly Supabase session, role-checked |
| **Public / webhook / cron** | public reads, `webhooks/*`, `phone/*`, `cron/*` | None, or signature-verified, or `CRON_SECRET` header |

---

# Web app — `/api/*`

## patient/* — Patient self-service (patient token)
- `POST /api/patient/auth/request-otp` — request OTP for Egyptian phone login
- `POST /api/patient/auth/verify-otp` — verify OTP, issue patient token
- `GET /api/patient/home` — patient home dashboard (meds, upcoming, alerts)
- `GET,POST /api/patient/onboarding` — fetch / complete onboarding
- `GET,POST /api/patient/children` — list / add guardian's children
- `GET /api/patient/adherence` — medication adherence summary
- `POST /api/patient/vitals` — self-report a vital reading
- `GET /api/patient/vitals/trend` — vitals trend vs reference ranges
- `GET /api/patient/history` — session summaries + doctor-authored documents
- `GET,PUT /api/patient/history/[sessionId]` — session detail / update
- `GET,POST /api/patient/records` — list / upload medical file records
- `GET,DELETE /api/patient/records/[id]` — fetch / delete a record
- `POST /api/patient/records/[id]/analyse` — AI-analyse an uploaded record
- `GET /api/patient/medical-record` — unified medical record (optional child_id)
- `GET /api/patient/medical-record/pdf` — export medical record as PDF
- `GET /api/patient/medical-record/timeline` — timeline events
- `POST /api/patient/medical-record/share` — create shareable record link
- `GET /api/patient/medical-record/shared/[token]` — view record via share token (public)
- `POST /api/patient/medical-record/send-to-pharmacy` — route record/prescription to pharmacy
- `GET,POST /api/patient/consent` — list / create data-sharing consents
- `POST /api/patient/consent/grant` — grant consent to a provider
- `DELETE /api/patient/consent/[id]` — revoke a consent
- `POST /api/patient/interactions/check` — drug-interaction check for patient meds
- `GET,POST /api/patient/insurance/policy` — get / add insurance policy
- `GET /api/patient/insurance/status` — policy verification status
- `POST /api/patient/insurance/verify-request` — request insurance verification
- `PUT /api/patient/profile/insurance` — update insurance preference
- `GET,DELETE /api/patient/gp` — get / remove assigned GP
- `POST /api/patient/gp/request` — request a GP assignment
- `GET /api/patient/referrals` — patient's referrals
- `GET /api/patient/school-health` — school-health record for a child
- `POST /api/patient/push-token` — register device push token

## child/* — Paediatrics (patient token, guardian-gated)
- `GET,POST /api/child/[id]/growth` — get / add growth measurements
- `GET /api/child/[id]/milestones` — list developmental milestones
- `PUT /api/child/[id]/milestones/[mId]` — update a milestone status
- `GET /api/child/[id]/vaccines` — list vaccination schedule/status
- `PUT /api/child/[id]/vaccines/[vaccId]` — update a vaccine dose
- `GET /api/child/[id]/vaccines/certificate` — vaccination certificate

## doctor/* — Doctor portal (doctor Bearer)
- `POST /api/doctor/auth/login` · `POST /api/doctor/auth/logout` · `GET /api/doctor/auth/me` · `POST /api/doctor/auth/register`
- `GET /api/doctor/dashboard/appointments` — appointment list
- `GET /api/doctor/consultation/[bookingId]` — consultation detail (ownership-checked)
- `PUT /api/doctor/consultation/[bookingId]/notes` — save notes
- `POST /api/doctor/consultation/[bookingId]/complete` — complete consultation
- `GET /api/doctor/patients` · `GET /api/doctor/patients/[id]` — patient list / detail
- `GET,POST /api/doctor/patients/[id]/notes` — get / add patient notes
- `GET /api/doctor/patients/[id]/alerts` — patient clinical alerts
- `POST /api/doctor/clinical-document` — create a clinical document (prescription/lab/imaging/summary)
- `POST /api/doctor/quick-intake` — quick patient intake
- `POST /api/doctor/follow-up` — schedule a follow-up
- `GET /api/doctor/follow-ups/overdue` — overdue follow-ups
- `POST /api/doctor/follow-ups/[id]/contact` — log follow-up contact
- `POST /api/doctor/referral` — create a referral
- `PUT /api/doctor/referral/[id]/accept|decline|outcome` — referral lifecycle
- `GET /api/doctor/gp-availability` — GP availability config (patient-facing read)
- `POST /api/doctor/gp-call-settings` — update own GP call settings
- `GET /api/doctor/gp/interaction-alerts` — GP drug-interaction alerts
- `POST /api/doctor/gp/request` — handle a GP consult request
- `GET /api/doctor/paediatric-dose` — paediatric dose calculator
- `GET,POST /api/doctor/school-health` — list / create school-health assessments
- `POST /api/doctor/school-health/certificate` — issue school-health certificate
- `GET,PUT /api/doctor/settings` — get / update doctor settings
- `POST /api/doctor/settings/upload` — upload signature/stamp asset

## booking / doctors / chain — Public booking
- `POST /api/booking` — create a booking
- `GET /api/booking/[bookingId]` — booking detail
- `GET /api/doctors/[doctorId]/slots` — available slots for a doctor
- `GET /api/chain/[slug]` — fetch clinic chain by slug (public)

## triage / session / chat — AI triage engine
- `GET,POST,PATCH /api/session` — create / fetch / update a triage session
- `POST /api/chat` — triage chat turn (Claude)
- `POST /api/voice/transcribe` — transcribe voice input

## health-assistant/* — AI health assistant (patient token)
- `POST /api/health-assistant/chat` — chat turn (Claude)
- `GET /api/health-assistant/eligibility` — eligibility check (meds/conditions)
- `GET /api/health-assistant/sessions` · `GET /api/health-assistant/sessions/[id]` — list / detail
- `GET /api/health-assistant/suggestions` — suggested prompts (lang-aware)

## telehealth/* — Video consultations (LiveKit)
- `POST /api/telehealth/room` — create room for a booking
- `GET /api/telehealth/token` — issue token (role patient|doctor)
- `POST /api/telehealth/consent` — log recording consent
- `POST /api/telehealth/call-events` — update call start/end times
- `POST /api/telehealth/gp-room` · `POST /api/telehealth/gp-token` — GP-call room / token
- `PUT /api/telehealth/gp-call/[id]` — update GP call state
- `GET /api/telehealth/gp-call/[id]/transcription` — fetch transcription
- `POST /api/telehealth/gp-recording/start|stop` — recording control
- `POST /api/telehealth/gp-transcribe/[id]` — transcribe a recording
- `PUT /api/gp/confirm/[id]` — confirm a GP consult request

## phone/* — Twilio telephony (signature-verified)
- `POST /api/phone/incoming` — inbound call (TwiML) · `POST /api/phone/dtmf` — keypad input
- `GET /api/phone/stream` — media stream (WebSocket) · `POST /api/phone/status` — call status
- `POST /api/phone/recording-status` · `POST /api/phone/callback-answer` · `POST /api/phone/callback-status`

## payments/* & webhooks/* — Payments (public + signature)
- `POST /api/payments/initiate` — initiate a payment · `GET /api/payments/[reference]` — status
- `POST /api/webhooks/fawry|paymob|vodafone` — payment provider callbacks
- `POST /api/webhooks/lab-chain/alborg|alfa|almokhtabar` — lab results webhooks

## lab/* & pharmacy/* — Discovery & routing
- `GET /api/lab/nearby` — nearby labs (PostGIS) · `GET /api/lab/chains` — list chains
- `GET /api/lab/chains/[code]/branches|slots` · `POST /api/lab/chains/[code]/book`
- `POST /api/lab/route-order` — route a lab order
- `GET /api/pharmacy/nearby` — nearby pharmacies · `POST /api/pharmacy/route-prescription`
- `GET /api/pharmacy/prescription/[id]/status` — prescription status timeline

## insurance / provider/* — Claims & pre-auth (admin auth)
- `GET /api/insurance/providers` — list active insurers (public)
- `POST /api/provider/claims` · `POST /api/provider/claims/bulk` · `PUT /api/provider/claims/[id]/appeal`
- `POST /api/provider/preauth/submit` · `GET /api/provider/preauth/[id]`

## icu/* — ICU transfers (doctor Bearer)
- `GET /api/icu/search` — search available ICU beds
- `POST /api/icu/transfer` · `GET,PUT /api/icu/transfer/[id]` — create / detail / update transfer

## clinical-document / interactions / embed / misc
- `GET /api/clinical-document/[id]/pdf` — authorize + redirect to document PDF
- `POST /api/interactions/check` — general drug-interaction check
- `POST /api/embed` — widget triage entrypoint · `GET /api/embed/config` · `POST /api/embed/event`
- `POST /api/contact` — contact form · `GET /api/health` — liveness + dependency check
- `GET /api/admin/bookings/[id]/patient-history` — doctor view of patient history (consent-gated)
- `GET,POST /api/admin/doctors/[id]/insurance` — get / set a doctor's accepted insurers

## cron/* — Scheduled jobs (`CRON_SECRET`)
- `GET /api/cron/callbacks` · `claims-deadline` · `followup-reminders` · `his-sync` · `icu-his-sync`
- `GET /api/cron/lab-chain-sync` · `lab-chain-results` · `protocol-check` · `vaccination-reminders`
- `GET,POST /api/cron/payment-expiry` — expire stale pending payments

---

# Admin app — `/api/admin/*`

All require `authenticateAdmin` except the auth endpoints.

## auth
- `POST,DELETE /api/admin/auth/session` — set / clear httpOnly session cookies
- `GET /api/admin/auth/verify` — verify current admin session

## analytics & stats
- `GET /api/admin/analytics` — platform analytics (SQL aggregation)
- `GET /api/admin/clinic/stats` · `GET /api/admin/lab/stats` · `GET /api/admin/pharmacy/stats` · `GET /api/admin/insurance/stats`
- `GET /api/admin/payments/summary` · `POST /api/admin/payments/reminder`

## bookings & queue
- `GET /api/admin/bookings` · `GET /api/admin/bookings/[id]` · `PUT /api/admin/bookings/[id]/status`
- `GET,POST /api/admin/queue` · `PUT /api/admin/queue/[id]` · `POST /api/admin/queue/call-next`
- `POST /api/admin/queue/check-in` · `GET /api/admin/queue/position` · `POST /api/admin/callbacks/cancel`

## doctors & verification & slots
- `GET,POST /api/admin/doctors` · `GET,PUT,DELETE /api/admin/doctors/[id]`
- `GET,POST /api/admin/doctors/[id]/slots` · `POST /api/admin/doctors/[id]/slots/bulk`
- `POST /api/admin/doctors/bulk-upload` · `GET /api/admin/doctors/csv-template` · `DELETE /api/admin/slots/[slotId]`
- `GET /api/admin/doctor-verification` · `POST /api/admin/doctor-verification/[id]/approve|reject`

## chain & chains
- `POST /api/admin/chain` · `GET,PUT /api/admin/chain/[id]`
- `GET,POST /api/admin/chain/[id]/branches` · `GET /api/admin/chain/[id]/doctors` · `POST /api/admin/chain/[id]/doctors/assign`
- `PUT /api/admin/chain/[id]/doctors/[doctorId]/schedule` · `GET /api/admin/chain/[id]/patients`
- `GET,POST /api/admin/chain/[id]/pricing` · `PUT /api/admin/chain/[id]/pricing/[priceId]` · `GET /api/admin/chain/price`
- `GET /api/admin/chain/[id]/analytics` · `GET /api/admin/chain/[id]/analytics/compare`
- `GET,PUT /api/admin/chains` · `POST /api/admin/chains/[code]/test|import-branches|import-tests`

## lab
- `GET /api/admin/lab/catalog` · `GET,POST /api/admin/lab/services` · `PUT,DELETE /api/admin/lab/services/[id]`
- `GET /api/admin/lab/orders` · `GET,PUT /api/admin/lab/orders/[id]`
- `GET,POST /api/admin/lab/appointments` · `PUT /api/admin/lab/appointments/[id]` · `POST /api/admin/lab/results`

## pharmacy
- `GET /api/admin/pharmacy/catalog` · `GET,POST /api/admin/pharmacy/medications` · `PUT,DELETE /api/admin/pharmacy/medications/[id]`
- `GET /api/admin/pharmacy/prescriptions` · `GET /api/admin/pharmacy/prescriptions/[id]`
- `POST /api/admin/pharmacy/prescriptions/[id]/confirm|stock|ready|collect`
- `GET,POST /api/admin/pharmacy/invoices` · `GET,PUT /api/admin/pharmacy/invoices/[id]`

## insurance
- `PUT /api/admin/insurance/claims/[id]/decide` · `PUT /api/admin/insurance/preauth/[id]/decide`
- `PUT /api/admin/insurance/verifications/[id]` · `GET,POST /api/admin/insurance/remittance`

## icu
- `GET /api/admin/icu/overview` · `GET,POST /api/admin/icu/units` · `PUT,DELETE /api/admin/icu/units/[id]`
- `PUT /api/admin/icu/units/[id]/beds` · `GET /api/admin/icu/transfers` · `PUT /api/admin/icu/transfers/[id]`

## his (Hospital Information System)
- `POST /api/admin/his/connect|disconnect|test|sync` · `GET /api/admin/his/sync-logs`
- `GET /api/admin/his/doctors` · `POST /api/admin/his/map-doctors`

## kb (knowledge base / RAG)
- `GET,POST /api/admin/kb` · `GET,PUT,DELETE /api/admin/kb/[id]`
- `POST /api/admin/kb/[id]/embed` · `POST /api/admin/kb/embed-all` · `POST /api/admin/kb/test-query`

## emergency-rules
- `GET,POST /api/admin/emergency-rules` · `GET,PUT,DELETE /api/admin/emergency-rules/[id]`
- `PUT /api/admin/emergency-rules/priority` · `POST /api/admin/emergency-rules/test`

## invoices & tenants & misc
- `GET,POST /api/admin/invoices` · `GET,PUT /api/admin/invoices/[id]` · `GET /api/admin/invoices/daily-summary`
- `GET,POST /api/admin/tenants` · `GET,PUT /api/admin/tenants/[id]`
- `GET /api/admin/clinical-documents` — list clinical docs (filterable by doctor)
- `POST /api/admin/phone/english-toggle` — toggle English phone IVR for a tenant

---

> Route header comments were sparse in `doctor/*` and most `admin/*` files, so those purposes are
> inferred from path + handler logic; `patient/*`, `provider/*`, `telehealth/*`, and
> `admin/insurance/*` had explicit header comments used directly. Always confirm the exact
> request/response shape against the route source.
</content>
