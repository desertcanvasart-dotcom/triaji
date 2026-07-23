# User Guide

How to use DoctorTrio, organized by who you are. For an exhaustive screen-by-screen tour see
[triaji-full-walkthrough.md](triaji-full-walkthrough.md); this is the practical "how do I…" guide.

## Login at a glance

| Role | Login | Where | URL (local) | URL (production) |
|------|-------|-------|-------------|-------------------|
| **Patient** | Phone + OTP (WhatsApp → SMS) | Web + mobile | `:3000/ar/login` | `app.doctortrio.online/ar/login` |
| **Doctor** | Email + password | Doctor portal (web + mobile) | `:3000/ar/doctor/login` | `app.doctortrio.online/ar/doctor/login` |
| **Platform Admin** | Email + password | Admin panel | `:3001/login` | `admin.doctortrio.online/login` |
| **Clinic Owner / Receptionist / Billing** | Email + password | Admin → clinic section | `:3001/login` | `admin.doctortrio.online/login` |
| **Lab Owner / Technician** | Email + password | Admin → lab section | `:3001/login` | `admin.doctortrio.online/login` |
| **Pharmacy Owner / Staff** | Email + password | Admin → pharmacy section | `:3001/login` | `admin.doctortrio.online/login` |
| **Insurance Admin / Reviewer / Finance** | Email + password | Admin → insurance section | `:3001/login` | `admin.doctortrio.online/login` |
| **ICU Coordinator** | Email + password | Admin → ICU section | `:3001/login` | `admin.doctortrio.online/login` |
| **Chain Owner / Branch Manager** | Email + password | Admin → chain / branch section | `:3001/login` | `admin.doctortrio.online/login` |

The admin panel redirects each role to its own dashboard after login. Patients can also **start a
triage chat without logging in** (guest mode) from the chat screen. Everyone in the second table
shares one login page — the app tells them apart by role and redirects to the right dashboard;
there is no separate URL per provider type.

---

## Patients

The patient experience lives in the **web app** (`/ar` default, `/en` for English) and the **mobile
app**.

### Get triaged
1. Open the app and start a chat (`/ar/chat`) — no login required to begin.
2. Describe your symptoms in Arabic (type, **record your voice**, or **attach a photo** of a visible
   symptom). The assistant asks follow-up questions.
3. If your description contains a **red flag**, the app escalates immediately with emergency guidance
   instead of continuing.
4. Otherwise the assistant determines the right **specialty** and, using your location, suggests
   nearby doctors.

### Book a doctor
1. From the triage result, pick a recommended doctor and an available slot.
2. Choose **in-person** or **telehealth** (video). Confirm.
3. You get a **WhatsApp** (or SMS) confirmation. Paid bookings route you through Fawry/Paymob/
   Vodafone Cash first; the booking confirms when payment succeeds.

### Your medical record
- **Records** — upload prescriptions, lab results, and scans; the app AI-extracts medications and
  lab values. Export your unified record as a **PDF**, or create a time-limited **share link**
  ("medical passport") for a doctor.
- **History** — past triage sessions and doctor-authored documents.
- **Consent** — grant or revoke a specific doctor's access to your history.
- **Insurance** — add a policy and request verification.
- **Vitals & adherence** — self-report readings and track medication adherence.

### Other patient features
- **Telehealth** — join your video visit at the scheduled time.
- **GP** — request a primary-care doctor for ongoing video consults.
- **Labs & pharmacies** — find nearby providers; route a prescription to a pharmacy or an order to a
  lab.
- **Children** (paediatrics) — as a guardian, add a child and track **growth**, **milestones**, and
  **vaccinations** (with a vaccination certificate). School-health records too.
- **Health assistant** ("تريجي يسألك") — a general Arabic health Q&A chat, separate from triage.
- **Phone** — patients can also triage entirely by **phone call** (Arabic IVR with live
  transcription), no app needed.

---

## Doctors

The doctor portal is inside the web app at `/{locale}/doctor` (and in the mobile app). You register
at `/ar/doctor/register`, then a **platform admin verifies** your account before you can use it
(pending accounts see a waiting screen).

### Registering — three ways to describe your practice

Registration asks **where you practice**, not just your name and specialty. This decides what the
platform admin's approval provisions for you:

1. **Independent doctor (no clinic)** — the default. You get the doctor portal only; nothing else
   is created.
2. **I have my own clinic** — give your clinic's name (Arabic, optional English) and address. When
   the admin approves your registration, DoctorTrio **provisions a real clinic tenant for you**: a
   public clinic page, the booking widget, and — using this same login — **admin-panel access as
   the clinic's owner** (reception, appointments, billing, staff).
3. **I work at a clinic or hospital already on DoctorTrio** — pick the facility from a list of
   active clinics/hospitals. Approval links your doctor profile to that facility; you get the
   doctor portal, not admin access (you're staff there, not the owner).

Changed your mind, or work at more than one place? A doctor can be affiliated with **several
facilities at once** (e.g. employed at a hospital and also running a private clinic) — see
"Settings → My facilities" below; the "own clinic" path is always available there even if you
registered as independent or already work somewhere else.

### Daily use
- **Dashboard** — your upcoming appointments.
- **Consultation** (`/consultation/[bookingId]`) — open a booking to see the patient's triage
  summary, profile, prior records (if consented), and attached images. Take notes (auto-saved), then:
  - **Documents tab** — issue a **prescription**, **lab order**, **imaging order**, or a
    **consultation summary**. Each generates a numbered PDF (`TRJ-YYYY-NNNNN`) with your signature and
    stamp, and can be sent to the patient. Prescriptions run a **drug-interaction check** first.
  - **Complete** the consultation when done.
- **Patients** — your followed patients, their notes, and clinical alerts.
- **Follow-ups** — schedule follow-ups and see overdue ones.
- **Referrals** — refer to a specialty (tier-1) or a specific doctor (tier-2); accept/decline
  incoming referrals and record outcomes.
- **Quick intake** — capture a walk-in patient quickly.
- **GP video calls** — configure availability and fees, take incoming primary-care video calls
  (recorded + transcribed, producing a post-call record).
- **ICU** — search for available ICU beds nearby and request an **emergency transfer**.
- **Settings** — upload your signature and stamp (used on documents), set clinic details.
  - **My facilities** — see every facility your login is affiliated with (with the primary one
    badged). If you don't already own a clinic, a form here lets you create one on the spot — this
    is the self-serve equivalent of choosing "I have my own clinic" at registration, available any
    time after you're verified, even if you're already affiliated with a hospital or another
    clinic.

---

## Providers & platform staff (admin panel, :3001)

After login, each role lands on its section's dashboard. Common tasks by section:

### Platform Admin
Runs the whole platform. **Tenants** (create/configure clinics, labs, pharmacies, insurers),
**doctor verification** (approve/reject registrations — the queue badges each pending doctor as
*Independent*, *+ New clinic*, or *Joins: <facility>* so you see what approving will provision),
the **knowledge base** (RAG documents + embeddings that ground the triage AI), and **emergency
rules** (the red-flag triage rules and their priority). Also sees cross-tenant analytics.

**Users** (`/users`) — onboard any provider staff account (clinic/lab/pharmacy/insurance/ICU/chain
roles, or another platform admin) without touching Supabase directly: pick a role and the matching
tenant/chain, and DoctorTrio creates the login and hands you a **one-time set-password link** to
send the person however you like (WhatsApp, email). Existing users can be deactivated, or issued a
fresh link if they lose the original. This is the only account-creation path for provider staff —
doctors and patients register themselves through their own flows above.

### Clinic (Owner / Receptionist / Billing)
- **Dashboard** — queue + revenue stats.
- **Doctors & slots** — manage the clinic's doctors and their availability (incl. bulk CSV upload
  and recurring slots).
- **Queue / reception** — the live walk-in queue: check patients in, call the next patient.
- **Bookings** — manage appointments and their status.
- **Billing / invoices** — create invoices, daily reconciliation, take payments.
- **HIS** — connect the clinic's Hospital Information System (Shifa/Neuron/generic REST) to sync
  doctors and availability.

### Lab (Owner / Technician / Billing)
- **Catalog & services** — the test/radiology catalog and per-lab pricing.
- **Orders & appointments** — incoming lab orders and scheduled/walk-in/home-collection visits.
- **Results** — upload results (which flow back to the ordering doctor and patient).
- **Chains** — connect and import from external lab chains (Al-Borg, Al-Mokhtabar, Alfa).

### Pharmacy (Owner / Staff / Billing)
- **Medications** — inventory + the platform drug catalog.
- **Prescriptions** — the dispensing workflow: confirm → check stock → mark ready → collected.
- **Invoices** — pharmacy billing.

### Insurance (Admin / Reviewer / Finance)
- **Verifications** — resolve patient policy-verification requests.
- **Pre-authorizations** — decide pre-auth requests.
- **Claims** — adjudicate claims (approve/partial/reject, handle appeals).
- **Remittance** — post insurer→provider payment batches. Plus insurance stats.

### ICU Coordinator
- **Units & beds** — maintain the ICU bed registry and live bed counts.
- **Transfers** — review and approve incoming cross-hospital transfer requests. (ICU coordinators are
  scoped to ICU beds/transfers only.)

### Chain (Owner / Branch Manager)
- **Chain Owner** — manage all branches, assign doctors to branches and schedules, set **shared
  pricing** (with per-branch exceptions), see the cross-branch patient registry and comparative
  analytics.
- **Branch Manager** — scoped to a single branch's admin (clinic/lab/pharmacy view for that branch).

---

## Notes for operators

- **Bilingual:** the patient/doctor web app is Arabic-first (RTL) with an English mirror; the admin
  panel is English-only. The phone IVR can be toggled to English per tenant.
- **Graceful degradation:** most integrations (payments, telehealth, phone, lab chains, HIS) are
  optional — the app works without them, and features light up as their credentials are configured.
- **Verification gate:** doctors can't use the portal until a platform admin verifies them.
- **Multi-facility doctors:** a doctor's `doctors.tenant_id` is their primary affiliation, but they
  can belong to several facilities — see [data-model.md](data-model.md#doctors--bookings) for the
  schema (`doctor_tenants`).
- For deployment/runtime specifics (the phone custom server, env vars, seeding), see
  [getting-started.md](getting-started.md) and [NEXT-SESSION.md](NEXT-SESSION.md).
</content>
