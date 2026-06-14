# Triaji — Complete Application Walkthrough
# Every Page, Every Feature, Every Flow

---

## Table of Contents

1. [Platform Overview](#1-platform-overview)
2. [Patient Web App — Authentication & Onboarding](#2-patient-web-app--authentication--onboarding)
3. [Patient Web App — AI Triage](#3-patient-web-app--ai-triage)
4. [Patient Web App — Medical Records](#4-patient-web-app--medical-records)
5. [Patient Web App — Health AI Assistant](#5-patient-web-app--health-ai-assistant)
6. [Patient Web App — Lab Services](#6-patient-web-app--lab-services)
7. [Patient Web App — Pharmacy](#7-patient-web-app--pharmacy)
8. [Patient Web App — GP & Telehealth](#8-patient-web-app--gp--telehealth)
9. [Patient Web App — ICU Bed Search](#9-patient-web-app--icu-bed-search)
10. [Patient Web App — Insurance](#10-patient-web-app--insurance)
11. [Patient Web App — Payments](#11-patient-web-app--payments)
12. [Patient Web App — Paediatric Profiles](#12-patient-web-app--paediatric-profiles)
13. [Patient Web App — Clinic & Chain Booking](#13-patient-web-app--clinic--chain-booking)
14. [Doctor Portal — Web](#14-doctor-portal--web)
15. [Admin Panel — Platform Administration](#15-admin-panel--platform-administration)
16. [Admin Panel — Clinic Management](#16-admin-panel--clinic-management)
17. [Admin Panel — Lab Management](#17-admin-panel--lab-management)
18. [Admin Panel — Pharmacy Management](#18-admin-panel--pharmacy-management)
19. [Admin Panel — Insurance Management](#19-admin-panel--insurance-management)
20. [Admin Panel — ICU Management](#20-admin-panel--icu-management)
21. [Admin Panel — Chain Management](#21-admin-panel--chain-management)
22. [Mobile App — Patient](#22-mobile-app--patient)
23. [Mobile App — Doctor](#23-mobile-app--doctor)
24. [API Routes Reference](#24-api-routes-reference)
25. [Database Schema Summary](#25-database-schema-summary)

---

## 1. Platform Overview

### What is Triaji?

Triaji is Egypt's first comprehensive healthcare platform. It connects patients, doctors, clinics, laboratories, pharmacies, and insurance companies through a single integrated system. Built bilingual (Arabic/English) with Arabic-first design using Egyptian colloquial Arabic.

### Three Applications

| App | URL | Purpose | Language |
|-----|-----|---------|----------|
| Patient Web App | `localhost:3000` | Patient-facing + doctor portal | Arabic + English |
| Admin Panel | `localhost:3001` | Provider management | English only |
| Mobile App | Expo Go / EAS Build | Patients + doctors on mobile | Arabic + English |

### User Types

| User Type | Authentication | Access |
|-----------|---------------|--------|
| Patient | Phone number + OTP | Web app + mobile app |
| Doctor | Syndicate number + password | Doctor portal (web + mobile) |
| Platform Admin | Email + password | Full admin panel |
| Clinic Owner | Email + password | Clinic admin section |
| Clinic Receptionist | Email + password | Reception + queue |
| Clinic Billing | Email + password | Billing section |
| Lab Owner | Email + password | Lab admin section |
| Lab Technician | Email + password | Results upload |
| Pharmacy Owner | Email + password | Pharmacy admin section |
| Pharmacy Staff | Email + password | Prescription dispensing |
| Insurance Admin | Email + password | Insurance admin section |
| Insurance Reviewer | Email + password | Pre-auth + claims |
| Insurance Finance | Email + password | Remittance |
| ICU Coordinator | Email + password | ICU beds + transfers |
| Chain Owner | Email + password | Chain admin section |
| Branch Manager | Email + password | Single branch admin |

### Colour System (Admin Panel Sidebars)

| Tenant Type | Sidebar Accent | Hex |
|-------------|---------------|-----|
| Platform/Admin | teal-600 | #0D9488 |
| Clinic | indigo-700 | #4338CA |
| Lab | emerald-700 | #047857 |
| Pharmacy | purple-700 | #7E22CE |
| Insurance | amber-700 | #B45309 |
| Chain | violet-700 | #6D28D9 |

---

## 2. Patient Web App — Authentication & Onboarding

### `/` — Homepage
**What it shows:** Platform showcase landing page with 10 sections.
- Hero with "Your Complete Health Platform" headline and 3 CTAs (Patient triage, Doctor registration, Provider info)
- Trust strip: 27 governorates, 5 insurance partners, 3 lab chains, 8 provider types
- 3-step "How It Works" guide
- 6 platform pillars (Triage, Records, Labs, Doctors, Insurance, Health AI)
- For Patients section: 6 primary features + 6 secondary behind "Show more" toggle
- For Doctors section: 6 doctor features + registration CTA
- For Providers section: 5 colour-coded cards (Clinics, Labs, Pharmacies, Insurance, Chains)
- 8-step patient journey timeline
- Trust stats + security notice
- Split CTA for 3 audiences
- 4-column footer with emergency disclaimer

**Bilingual:** Arabic (RTL) by default, English (LTR) via language toggle.

### `/ar/login` & `/en/login` — Patient Login
**What it shows:** Phone number input field with Egyptian format (01XXXXXXXXX).
- Patient enters their mobile number
- System sends OTP via WhatsApp (primary) or SMS (fallback)
- OTP verification screen appears
- On success: redirect to `/ar/chat` (new user) or `/ar/medical-record` (returning user)
- Link: "Start a new conversation without signing in" for anonymous triage

**How it works:**
1. `POST /api/phone/send-otp` — sends OTP via Twilio/WhatsApp
2. `POST /api/phone/verify-otp` — verifies and creates Supabase auth session
3. Checks if `patient_profiles` record exists → if not, redirects to onboarding

### `/ar/onboarding` & `/en/onboarding` — Patient Profile Onboarding
**What it shows:** An 8-step structured form with progress bar at top.

**Step 1 — Basic Info:**
- Age stepper (1–120) with large +/- buttons
- Biological sex: two pill buttons (Male/Female) with selected state in teal
- Governorate: searchable dropdown with all 27 Egyptian governorates grouped by region

**Step 2 — Physical Measurements:**
- Height stepper (100–220cm)
- Weight stepper (20–250kg)
- Auto-calculated BMI displayed inline with Arabic category (underweight/normal/overweight/obese)

**Step 3 — Work & Lifestyle:**
- Work type: 12-card grid with emojis (office/manual/medical/education/transport/agriculture/retail/factory/home/student/retired/unemployed)
- Work schedule: 3 pill buttons (day/night/irregular)
- Physical activity: 3 cards (sedentary/moderate/active)

**Step 4 — Clinical Baseline:**
- Smoking: 3 buttons with conditional sub-questions (cigarettes/day, years)
- Blood pressure: 4 buttons with medication toggle
- Diabetes: 4 buttons with control level + treatment type
- Heart disease: 3 buttons with attack/surgery toggles
- Kidney disease: 3 buttons
- Liver disease: 3 buttons

**Step 5 — Medical History:**
- Allergies: toggle "none" or select from grouped chips (medications, food, environmental)
- Chronic conditions: toggle or select from 16 condition chips
- Current medications: add structured rows (name, dose, frequency, condition)
- Previous surgeries: select from 14 surgery chips with optional year

**Step 6 — Family History:**
- Toggle "no known family history" or fill matrix
- 8 conditions as rows (heart disease, heart attack, stroke, hypertension, diabetes, cancer, kidney, mental illness)
- 3 relations as columns (father, mother, sibling)
- Desktop: matrix table; Mobile: accordion layout

**Step 7 — Reproductive Health (females only):**
- Pregnancy status: 4 cards (not pregnant, pregnant, breastfeeding, trying to conceive)
- Previous pregnancies: stepper (0–10+)
- Menstrual regularity: 3 pills
- Menopause status: 4 pills

**Step 8 — Review & Confirm:**
- Complete summary of all entered data
- Each section has "edit" link to jump back
- BRS (Background Risk Score) calculated and displayed
- "Save and Start" button → saves all data → navigates to chat

**How it works:**
- All data saved to `patient_profiles` + junction tables (`patient_allergies`, `patient_chronic_conditions`, `patient_medications`, `patient_surgeries`, `patient_family_history`)
- BRS calculated by `packages/rules-engine/src/brs.ts`

### `/ar/privacy` & `/en/privacy` — Privacy & Data Sharing
**What it shows:** Who has access to the patient's records.
- List of active record access grants (doctor name, scope, expiry)
- "Grant access" button → modal to select doctor + scope (full/recent/specific conditions) + expiry
- "Revoke" button per grant
- Data sharing preferences (WhatsApp notifications toggle, language preference)

---

## 3. Patient Web App — AI Triage

### `/ar/chat` & `/en/chat` — Triage Conversation
**What it shows:** A chat interface where the patient describes symptoms and receives AI-powered medical assessment.

**The flow:**
1. Patient sees greeting: "مرحباً {name}، احكيلي عن اللي حاسس بيه" / "Hello {name}, tell me what you're feeling"
2. Patient types or speaks symptoms (voice input via Deepgram Arabic STT)
3. AI responds in Egyptian colloquial Arabic (or English), asking clarifying questions
4. After 3–5 exchanges, AI provides:
   - **Severity assessment:** Emergency (red) / Urgent (orange) / Moderate (yellow) / Low (green)
   - **Recommended specialty** based on symptoms + patient profile
   - **Doctor recommendations** filtered by governorate, insurance, availability
   - **Booking CTA** to schedule with recommended doctor

**Emergency detection:**
- If symptoms match emergency patterns (chest pain + arm numbness, severe breathing difficulty, etc.):
  - Conversation immediately halted
  - Red emergency banner: "اتصل بالإسعاف: 123" / "Call ambulance: 123"
  - Directions to nearest ER
  - No booking offered — pure emergency escalation

**Paediatric triage:**
- When a child profile is selected (via profile switcher):
  - System prompt includes child's age in months
  - Different urgency thresholds:
    - Fever >=38.0 in under 3 months = emergency
    - Fever >=38.5 in 3-36 months = urgent
    - Any seizure = emergency
    - Breathing difficulty = emergency
    - Rash + fever = urgent
  - Routes to paediatrician, not internist
  - Questions directed to parent, not child

**How it works:**
1. `POST /api/chat` — sends message to orchestrator
2. `apps/web/lib/triage/orchestrator.ts` — coordinates the full flow:
   - Loads patient profile via `profile-loader.ts`
   - Checks emergency rules via `packages/rules-engine`
   - Retrieves relevant RAG documents from knowledge base
   - Builds system prompt via `prompt-builder.ts`
   - Calls Claude API for response
   - Parses response for severity/specialty via `response-parser.ts`
   - Matches doctors via `doctor-matcher.ts`
3. Session saved to `triage_sessions` + `session_messages`

**Voice input:** Deepgram Arabic STT — patient taps microphone, speaks, transcription fills the input field.

**Image upload:** Patient can upload photos of symptoms or lab results. Processed by Claude's vision capabilities.

---

## 4. Patient Web App — Medical Records

### `/ar/medical-record` & `/en/medical-record` — Medical Record Dashboard
**What it shows:** A comprehensive dashboard of the patient's complete health data.

**Sections (adult patient):**
- **Header:** Patient name, age, sex, governorate, BRS level
- **Allergies banner:** Red alert if allergies exist
- **Vital trends:** Line charts (recharts) showing weight, blood pressure, blood glucose over time
- **Chronic conditions:** List with protocol compliance percentage
- **Current medications:** List with adherence indicators + interaction warnings
- **Recent lab results:** Last 3 results with normal/abnormal badges
- **Follow-up schedule:** Upcoming + overdue appointments
- **Protocol compliance:** For diabetes, hypertension, etc. — shows overdue tests
- **GP section:** Primary care doctor name + contact
- **Insurance:** Coverage status, remaining limit
- **"Ask Triaji" button:** Links to health AI assistant

**Sections (paediatric patient — when child profile selected):**
All adult sections PLUS:
- **Growth summary:** Latest weight/height with WHO percentile + link to growth charts
- **Vaccination progress:** X/Y completed, next due vaccine
- **Developmental milestones:** Current age group status, red flags
- **School health:** Latest exam, fitness status

**Medication interaction indicators:**
- If any of the patient's current medications have known interactions:
  - Small warning icon next to the interacting medication
  - Simplified patient-friendly note: "These two medications together may reduce the effectiveness of one. Talk to your doctor when possible."
  - NON-ALARMING language, always ends with "Talk to your doctor"

### `/ar/history` & `/en/history` — Visit History Timeline
**What it shows:** Chronological timeline of all patient interactions.

Each entry shows:
- Date, doctor name, specialty
- Type icon: 🩺 consultation, 🧪 lab results, 💊 prescription, 📹 video call, 🏫 school health
- Chief complaint summary
- Actions taken (prescription written, labs ordered, follow-up scheduled)
- Payment status badge: ✅ Paid / ⏳ Unpaid (with "Pay Online" button) / 💳 Processing
- "Download PDF" for invoices/prescriptions

### `/ar/records` & `/en/records` — Health Records Browser
**What it shows:** Searchable, filterable list of all health records.
- Filter by type: prescriptions, lab results, doctor notes, referrals, imaging
- Date range filter
- Each record expandable to show full details
- Download PDF per record

### `/ar/share/medical-record/[token]` & `/en/share/...` — Medical Passport
**What it shows:** A read-only shareable view of the patient's medical record.
- Generated via a time-limited token
- Shows: demographics, conditions, allergies, medications, recent labs, vaccination status
- Can be shared with any doctor (even outside Triaji) via link
- PDF download available

---

## 5. Patient Web App — Health AI Assistant

### `/ar/health-assistant` & `/en/health-assistant` — Ask Triaji
**What it shows:** Personal health AI companion grounded strictly in the patient's own records.

**Layout:**
- Greeting: "مرحباً {name} — أنا هنا أساعدك تفهم سجلك الطبي"
- Dynamic suggestion chips (max 3) based on patient data:
  - If abnormal lab: "What does it mean that my {test} is out of range?"
  - If overdue follow-up: "Why do I need to see the doctor?"
  - If recent prescription: "What are the effects of {drug}?"
- Chat bubbles: user (teal, right) / assistant (grey, left) — RTL-aware
- Streaming response (word by word via SSE)
- Voice input (Deepgram)
- Context banner: "Last labs: 15 Mar | Last visit: 15 Mar | 3 active meds"
- Conversation history sidebar (last 30 days)
- Disclaimer: "Ask Triaji is not a substitute for a doctor"

**The one rule:** Every answer anchored to patient's personal data.

**What it does:**
- Explains lab results in plain Arabic: "Your HbA1c improved from 8.2% to 7.1% — that's good progress"
- Explains medications: "You're taking Metformin for your type 2 diabetes — it works best with regular meals"
- Reminds what doctor said: "Dr. Ahmed said to avoid starches at night in your last visit"
- Answers chronic disease questions grounded in data

**What it refuses:**
- Generic health questions not grounded in records → "I don't have enough information about that in your records — ask your doctor"
- Diagnosis requests → politely declined
- New medication recommendations → refuses
- Questions about other people → refuses

**Safety guardrails:**
- Pre-send check: emergency patterns (chest pain, breathing difficulty) → immediate escalation with ambulance number 123
- Mental health patterns (suicidal ideation) → mental health hotline 08008880700
- Post-response check: flags possible diagnosis, new medication suggestions, or doctor contradictions for clinical review

**Minimum data threshold:** Requires at least one health record, medication, chronic condition, or completed booking. Empty records → redirect message.

**Context loading:** 11 parallel database queries cached in Redis for 1 hour. Invalidated on new lab result, prescription, medication change, follow-up update, or GP relationship change.

---

## 6. Patient Web App — Lab Services

### `/ar/lab` & `/en/lab` — Lab Search
**What it shows:** Browse available laboratories.

### `/ar/lab/[labSlug]` & `/en/lab/[labSlug]` — Lab Profile
**What it shows:** Individual lab profile page.
- Lab name, address, phone, working hours
- Test catalog with prices
- Walk-in / appointment booking options
- Home collection availability badge
- For chain labs (Al-Borg, Al-Mokhtabar, Alfa): branch finder section

### `/ar/lab/[labSlug]/branches` & `/en/lab/[labSlug]/branches` — Branch Finder
**What it shows:** Nearest chain lab branches using browser geolocation.
- Branches sorted by distance (PostGIS)
- Falls back to branch_number when geolocation unavailable
- Each branch: name, address, distance, working hours, phone, home collection badge
- "Book here" button per branch

### `/ar/lab/[labSlug]/book` & `/en/lab/[labSlug]/book` — Self-Referral Lab Booking
**What it shows:** Patient books a lab test without a doctor's order.
- Test selection from catalog
- Fasting requirements + preparation instructions
- Visit type: walk-in / appointment / home collection
- Date/time picker
- When chain API available: real-time branch slots with distance
- When API unavailable: generic picker + "The lab will contact you to confirm"
- Confirmation → WhatsApp notification

### `/ar/lab/[labSlug]/book/[routingId]` & `/en/lab/[labSlug]/book/[routingId]` — Order-Linked Lab Booking
**What it shows:** Patient books a lab appointment for a doctor-ordered test.
- Pre-selected tests from doctor's order
- Same booking flow as self-referral
- Order reference displayed

### `/ar/lab/results/[routingId]` & `/en/lab/results/[routingId]` — Lab Results
**What it shows:** Patient views their lab test results.
- Test name, value, unit, reference range
- Normal (green) / Abnormal (red) badges
- For radiology: radiologist report + "View imaging file" link
- Download PDF button
- Source badge: "Results from system" (chain API) or "Manually uploaded"

---

## 7. Patient Web App — Pharmacy

### `/ar/pharmacy/[pharmacySlug]` & `/en/pharmacy/[pharmacySlug]` — Pharmacy Profile
**What it shows:** Pharmacy public profile.
- Name, address, working hours, delivery options
- Medication catalog

### `/ar/pharmacy/prescription/[routingId]` & `/en/pharmacy/prescription/[routingId]` — Prescription Tracking
**What it shows:** Patient tracks their prescription status.
- Prescription details: drug names, doses, prescribing doctor
- Status timeline: ordered → routed → preparing → ready → dispensed
- Pharmacy name and contact
- "Pay online" button if payment pending
- WhatsApp notifications at each status change

---

## 8. Patient Web App — GP & Telehealth

### `/ar/gp/confirm/[id]` & `/en/gp/confirm/[id]` — GP Relationship Confirmation
**What it shows:** Patient confirms or declines a GP relationship request.
- Doctor name, photo, specialty
- Benefits explanation: "Your GP will follow your health over time, coordinate your care, and be available for video calls"
- Accept / Decline buttons
- On accept: GP relationship activated, both parties notified via WhatsApp

### `/ar/telehealth/[bookingId]` & `/en/telehealth/[bookingId]` — Video Consultation
**What it shows:** LiveKit video call for specialist consultations (booked appointments).
- Remote video full-screen
- Local video PiP in corner
- Controls: mute, camera, speaker, end call
- Call duration timer
- Connection quality indicator
- Recording consent banner (if doctor records)

---

## 9. Patient Web App — ICU Bed Search

### `/ar/icu` & `/en/icu` — ICU Bed Availability
**What it shows:** Search for available ICU beds near the patient.
- Location input (governorate or geolocation)
- Radius selector
- Unit type filter (medical, surgical, cardiac, neonatal, paediatric, neuro)
- Results: hospital name, available beds, distance, last updated
- Staleness indicators:
  - Green: updated < 2 hours
  - Yellow: 2–6 hours
  - Grey + warning: > 6 hours ("Data may be outdated — contact directly")
- Patient view is read-only — no transfer requests

### `/ar/icu/transfer/[id]` & `/en/icu/transfer/[id]` — ICU Transfer Request (Doctor)
**What it shows:** Doctor requests ICU bed transfer for a patient.
- Patient info, current facility
- Destination hospital/unit selection
- Clinical justification
- Urgency level
- Submit request → receiving hospital notified

---

## 10. Patient Web App — Insurance

### Insurance Section (within Medical Record Dashboard)
**What it shows:** Patient's insurance information and status.
- If no policy: "Add insurance policy" CTA with form (insurer select, policy number, card number, card upload)
- If unverified: warning banner + "Verify" button
- If verified: coverage breakdown (remaining annual limit progress bar, copay %, validity dates)
- If expired/suspended: red alert

**Add policy flow:**
1. Select insurer from dropdown (AXA, MetLife, Allianz, GlobeMed, Medmark)
2. Enter policy number, card number, member name
3. Upload card image
4. Submit → status = unverified → insurer reviews → verified/rejected

---

## 11. Patient Web App — Payments

### `/ar/pay/[reference]` & `/en/pay/[reference]` — Payment Checkout
**What it shows:** Unified payment page for any invoice type. Accessible from WhatsApp links without login.

**Mobile-first design** (most patients open from WhatsApp on phone):
- Invoice summary: description, provider name, date, amount
- 3 payment method cards (filtered by provider's configured methods):
  - **Paymob (Card):** Visa, Mastercard, Meeza, Apple Pay → redirects to Paymob iframe
  - **Fawry:** Shows Fawry reference code (large, copyable) + kiosk instructions + 24h expiry + card redirect option
  - **Vodafone Cash:** Phone number input → waiting screen "Waiting for approval on your phone..."
- Security notice: "Triaji never stores your card details"
- 44px minimum touch targets, full-width buttons on mobile

**Fawry flow:**
1. Patient taps "Pay with Fawry"
2. System generates Fawry reference code
3. Patient sees code + copy button + "Pay at any Fawry kiosk or ATM"
4. OR: "Pay online with card via Fawry" redirect
5. Fawry webhook confirms → invoice paid → WhatsApp receipt

### `/ar/pay/success` & `/en/pay/success` — Payment Success
**What it shows:** Green checkmark, receipt details, "Receipt sent via WhatsApp" notice.

### `/ar/pay/failed` & `/en/pay/failed` — Payment Failed
**What it shows:** Red X, error message, "Try again" button → back to checkout.

---

## 12. Patient Web App — Paediatric Profiles

### Profile Switcher (visible on all patient pages)
**What it shows:** Horizontal chip row at top: [Me] [Omar (5)] [Nour (9 months)] [+]
- Tapping a child loads that child's entire context
- All pages (triage, records, history, labs) show data for the selected child
- "+" links to add child flow

### `/ar/child/add` & `/en/child/add` — Add Child Profile
**What it shows:** 3-step form to add a child.

**Step 1 — Basic Info:**
- Child name, date of birth (date picker), sex (pill buttons), relation to child (dropdown: mother/father/grandmother/grandfather/sibling/guardian)

**Step 2 — Medical Baseline:**
- Blood type (optional dropdown)
- Gestational age in weeks (for premature babies, optional)
- Birth weight in grams (optional)
- Allergies toggle + selection
- Chronic conditions toggle + selection

**Step 3 — Vaccination History:**
- 3 radio options:
  - "Fully vaccinated per Egyptian schedule" → marks all past-due vaccines as given with note "Previously vaccinated — date unknown"
  - "Unknown — start tracking from now"
  - "Yes — enter dates later"
- On submit: creates patient record, profile, guardian relationship, auto-generates vaccination schedule from DOB + Egyptian vaccine catalog

### `/ar/child/[childId]/growth` & `/en/child/[childId]/growth` — Growth Charts
**What it shows:** WHO percentile growth curves.
- Tabs: Weight | Height | Head Circumference (under 2 only)
- Chart (recharts): shaded percentile bands:
  - Green: P15–P85 (normal range)
  - Yellow: P3–P15 and P85–P97 (watch zone)
  - Red zones: below P3 or above P97 (concern)
- Child's actual measurements as connected dots
- Most recent measurement highlighted
- "Add measurement" button → modal: weight (kg), height (cm), head circumference (cm, optional), date
- Current stats summary: weight, height, percentile, BMI
- Below P3 or above P97: "Consult your paediatrician" notice

**How it works:** WHO reference data stored in `who_growth_reference` table. Percentile calculated via `calculate_percentile()` SQL function using linear interpolation between stored data points.

### `/ar/child/[childId]/vaccines` & `/en/child/[childId]/vaccines` — Vaccination Schedule
**What it shows:** Egyptian national vaccination schedule tracking.
- Progress bar: X/14 completed
- Two sections: Completed + Upcoming/Overdue
- Each vaccine: name, dose number, scheduled age, due date, status badge
- Overdue vaccines: red badge
- Action buttons per vaccine: "Given" / "Deferred" / "Skipped"
- "Download vaccination certificate" → PDF (pdf-lib)

**14 vaccines tracked:** BCG, Hepatitis B (3 doses), OPV (5 doses), IPV (2 doses), Pentavalent (3 doses), PCV (3 doses), Rotavirus (2 doses), MMR (2 doses), Varicella, Meningococcal A, DTP Booster (2 doses), Hepatitis B School, Tetanus School (2 doses), HPV (optional, 2 doses)

**Reminders:** Daily cron checks for vaccines due within 14 days → WhatsApp to parent in preferred language. Overdue vaccines get separate alert.

**Turning 18:** Cron checks for children turning 18 within 30 days → WhatsApp to parent explaining transition to independent account.

### `/ar/child/[childId]/milestones` & `/en/child/[childId]/milestones` — Developmental Milestones
**What it shows:** Age-appropriate milestone tracking across 4 categories.

**Categories (accordion sections):**
- Gross motor (7 milestones: head lift → tricycle)
- Fine motor (5 milestones: grasp → scribble)
- Language (7 milestones: cooing → simple stories)
- Social (6 milestones: social smile → cooperative play)

**Status per milestone:**
- ✓ Achieved (green)
- ○ Upcoming (grey)
- ⚠️ Red flag: not achieved past target age (amber)

**Red flag banner:** NON-ALARMING language:
"This may be normal, but it's best to talk to your paediatrician."
Always ends with "Talk to your paediatrician" + booking link to paediatrics.

### `/ar/child/[childId]/school` & `/en/child/[childId]/school` — School Health Records
**What it shows:** School health exam history.
- Each record: academic year, school name, grade, exam date, doctor
- Physical measurements: height, weight, vision R/L, hearing
- Fitness status: Fit / Fit with restrictions / Not fit
- "Download certificate" per record (PDF)

---

## 13. Patient Web App — Clinic & Chain Booking

### `/ar/clinic/[clinicSlug]` & `/en/clinic/[clinicSlug]` — Clinic Profile
**What it shows:** Public clinic page with booking.
- Clinic name, address, phone, working hours
- Doctors list with specialties and fees
- Booking depends on `clinic_booking_mode`:
  - **Walk-in only:** "This clinic operates on a walk-in basis" + working hours + address
  - **Slots only:** Available time slots per doctor with date selection
  - **Both:** Slots for pre-booking + "Walk-ins also accepted" note

### `/ar/chain/[chainSlug]` & `/en/chain/[chainSlug]` — Chain Profile
**What it shows:** Multi-branch chain page.
- Chain name, logo, type, specialties
- All branches sorted by distance (geolocation) or branch_number (fallback)
- Nearest branch gets "Nearest to you" badge
- Each branch: name, address, working hours, phone
- "Book appointment" links to individual branch booking pages

---

## 14. Doctor Portal — Web

### `/ar/doctor` & `/en/doctor` — Doctor Landing Page
**What it shows:** Marketing page for doctors.
- "Connect with your patients smarter"
- "Triaji gives you a complete patient summary before every consultation"
- "Register as a doctor — free" CTA
- "Doctor login" link

### `/ar/doctor/register` & `/en/doctor/register` — Doctor Registration
**What it shows:** Registration form.
- Full name, medical syndicate number, primary specialty (dropdown)
- Governorate, clinic/hospital name, mobile number, email
- Password + confirmation
- On submit: account created with status "pending_verification"
- Platform admin verifies syndicate number (24–48 hours)

### `/ar/doctor/login` & `/en/doctor/login` — Doctor Login
**What it shows:** Syndicate number + password login.
- On success: redirect to dashboard
- If pending verification: redirect to pending page

### `/ar/doctor/pending` & `/en/doctor/pending` — Verification Pending
**What it shows:** "Your account is under review. We are verifying your syndicate number. This takes 24–48 hours."

### `/ar/doctor/dashboard` & `/en/doctor/dashboard` — Doctor Dashboard
**What it shows:** Doctor's main working screen.
- **Upcoming appointments:** Today's bookings with patient name, age, time, complaint
- **GP interaction alerts:** (only for GPs with active relationships) patients whose current medications have known interactions — "Contact now" for critical, "View record" for moderate
- **ICU panel:** Link to ICU bed search
- **Quick intake button:** For walk-in patients without booking

### `/ar/doctor/consultation/[bookingId]` & `/en/doctor/consultation/[bookingId]` — Pre-Consultation + Clinical Documents
**What it shows:** Complete pre-consultation view for a booked patient.

**Pre-consultation summary (AI-generated):**
- Patient demographics, BRS
- Chief complaint from triage
- Medical history: conditions, allergies, medications, surgeries
- Family history
- Recent lab results + trends
- Current medication interaction warnings (if any)

**Clinical document actions:**
- **Write prescription:** Structured form — drug name (with autocomplete from Egyptian catalog), dose, route, frequency, duration, instructions. Drug interaction check on each drug (real-time, on blur). Blocking for contraindicated/major interactions (override with documented reason).
- **Order labs:** Select from test catalog, mark urgent/routine, route to lab
- **Schedule follow-up:** Date picker + reason
- **Record notes:** Free-text clinical notes (Arabic)

**Paediatric patients:**
- "Paediatric Dose Calculator" button appears
- Side panel: select drug → shows weight-based dose formula, calculated range, available Egyptian formulations with volumes
- "Copy to prescription" auto-fills dose/frequency
- School health exam form available

### `/ar/doctor/quick-intake` & `/en/doctor/quick-intake` — Quick Intake
**What it shows:** Rapid triage form for walk-in patients.
- Patient sex, approximate age
- Symptom input (free text)
- "Run immediate assessment" → Claude API → severity + recommendation
- No booking required — designed for speed

### `/ar/doctor/patients` & `/en/doctor/patients` — GP Patient Panel
**What it shows:** All patients where this doctor is the GP.
- Patient cards: name, age, chronic conditions, adherence rate
- "Needs attention" filter: overdue follow-ups, protocol violations, interaction alerts
- Video call button per patient (📹)
- Guard: redirects to dashboard if no active GP relationships

### `/ar/doctor/patients/[patientId]` & `/en/doctor/patients/[patientId]` — Patient Detail
**What it shows:** Longitudinal view of a GP's patient.
- Complete medical record access (with patient consent)
- Visit history across all providers
- Medication timeline
- Lab result trends
- Protocol compliance
- GP freestanding notes (not tied to any booking)
- Referral history
- Follow-up tracking
- Video call button

### `/ar/doctor/results/[routingId]` & `/en/doctor/results/[routingId]` — Doctor Views Lab Results
**What it shows:** Same as patient lab results view but with clinical context.
- Full result values with reference ranges
- Doctor can add interpretation notes
- Linked to the ordering health record

---

## 15. Admin Panel — Platform Administration

### `/login` — Admin Login
**What it shows:** Email + password login form.
- Role-based redirect after login:
  - `platform_admin` → `/dashboard`
  - `clinic_owner` → `/clinic/dashboard`
  - `lab_owner` → `/lab/dashboard`
  - `pharmacy_owner` → `/pharmacy/dashboard`
  - `insurance_admin` → `/insurance/dashboard`
  - `chain_owner` → `/chain/dashboard`
  - `branch_manager` → their branch's admin

### `/dashboard` — Platform Dashboard
**What it shows:** Hospital/tenant overview with stats.

### `/tenants` — Tenant Management
**What it shows:** All registered tenants (clinics, labs, pharmacies).
- List with name, tier, status, created date
- "Create new tenant" button

### `/tenants/new` — Create Tenant
**What it shows:** Form to create a new tenant.
- Name (Arabic + English), slug, tier selection, contact info

### `/tenants/[id]` — Tenant Detail
**What it shows:** Individual tenant management.
- Configuration, staff, settings

### `/knowledge-base` — RAG Knowledge Base
**What it shows:** Medical knowledge documents used by the triage AI.
- Document list with titles, categories
- "Add document" → upload medical content
- These documents are embedded and retrieved during triage conversations

### `/knowledge-base/new` & `/knowledge-base/[id]/edit` — KB CRUD
**What it shows:** Create/edit knowledge base documents.
- Title, content (Arabic), category, tags

### `/emergency-rules` — Emergency Rule Management
**What it shows:** Rules that trigger emergency escalation during triage.
- Rule list with name, priority, escalation type
- 5 paediatric rules automatically included

### `/emergency-rules/new` & `/emergency-rules/[id]/edit` — Rule CRUD
**What it shows:** Create/edit emergency detection rules.

### `/doctor-verification` — Doctor Verification Queue
**What it shows:** Pending doctor registration verifications.
- Doctor name, syndicate number, specialty, registration date
- "Verify" / "Reject" buttons
- On verify: doctor account activated

### `/clinical-documents` — Clinical Document Templates
**What it shows:** Template management for prescriptions, lab orders, etc.

### `/chains` — Lab Chain Integration Management
**What it shows:** Al-Borg, Al-Mokhtabar, Alfa chain integration status.
- 3 chain cards with API status (green Live / yellow Contract Signed / red Not Connected)
- Branch count, test mappings count, monthly orders
- "Add API credentials" form
- "Test API" button
- "Import branches" CSV upload
- "Import test mapping" CSV upload

---

## 16. Admin Panel — Clinic Management

### `/clinic/dashboard` — Clinic Dashboard (indigo-700)
**What it shows:** Daily clinic overview.
- Today's patient count, revenue, doctor count
- Walk-in queue status
- Booked appointments
- Weekly revenue chart (recharts)

### `/clinic/reception` — Walk-In Queue
**What it shows:** Real-time walk-in patient queue.
- "Add patient" fast-add form (name, phone, complaint)
- Queue list: patient name, arrival time, waiting time, status
- Doctor assignment per patient
- "Check in" / "Start consultation" / "Complete" buttons
- When booking_mode = 'both': scheduled appointments section above walk-in queue
- When booking_mode = 'slots_only': fast-add form hidden

### `/clinic/appointments` — Time Slot Management
**What it shows:** Per-doctor availability calendar (next 14 days).
- Existing slots with booked/available status
- Quick-add slot templates (Morning / Afternoon / Evening)
- Only visible when booking_mode is 'slots_only' or 'both'

### `/clinic/billing` — Invoices
**What it shows:** Invoice management.
- Create invoice: patient, doctor, line items, amounts
- Chain pricing pre-fill (if clinic belongs to a chain with shared_pricing)
- Payment status badges
- 4 stat cards: Total Revenue / Paid Cash / Paid Online / Unpaid
- "Send reminder" button for unpaid invoices
- Daily revenue report link

### `/clinic/billing/daily` — Daily Revenue Report
**What it shows:** Day-by-day revenue breakdown.

### `/clinic/billing/insurance` — Insurance Claims Dashboard
**What it shows:** Insurance claims submitted by this clinic.
- Claims by status (submitted, approved, rejected, paid)
- Create claim from invoice
- Deadline warnings

### `/clinic/settings` — Clinic Settings
**What it shows:** Clinic configuration.
- Working hours per day
- Booking mode selector: walk-in only / slots only / both
- Queue settings
- Payment settings: online payment toggle, Fawry/Paymob/Vodafone Cash checkboxes, merchant codes

---

## 17. Admin Panel — Lab Management

### `/lab/dashboard` — Lab Dashboard (emerald-700)
**What it shows:** Lab overview with order stats.

### `/lab/reception` — Lab Reception Queue
**What it shows:** Incoming patients and orders.
- Walk-in patients
- Online bookings
- Order status tracking

### `/lab/orders` — Lab Orders
**What it shows:** All incoming lab orders.
- From doctors (via prescription routing)
- From patients (self-referral)
- Chain API orders vs manual orders
- Status: ordered → received → sample collected → processing → results ready

### `/lab/results` — Results Management
**What it shows:** Test results to upload/review.

### `/lab/results/upload/[routingId]` — Upload Results
**What it shows:** Technician enters test result values.
- Test name, value input, unit, reference range
- Normal/abnormal toggle
- On save: patient + doctor notified via WhatsApp
- Results appear in patient's medical record

### `/lab/billing` & `/lab/billing/insurance` — Lab Billing
**What it shows:** Same pattern as clinic billing but for lab services.

### `/lab/settings` — Lab Settings
**What it shows:** Lab configuration, working hours, payment settings.

---

## 18. Admin Panel — Pharmacy Management

### `/pharmacy/dashboard` — Pharmacy Dashboard (purple-700)
**What it shows:** Pharmacy overview.
- Incoming prescriptions count
- Today's dispensing
- Revenue stats

### `/pharmacy/prescriptions` — Prescription Queue
**What it shows:** Incoming prescriptions routed to this pharmacy.
- Status tabs: pending, preparing, ready, dispensed
- Each prescription: patient name, doctor, drug list, date

### `/pharmacy/prescriptions/[id]` — Prescription Detail
**What it shows:** Individual prescription processing.
- Full drug list with doses
- "Start preparing" → "Ready for pickup" → "Dispensed" status flow
- Stock check per drug
- WhatsApp notification sent at each step
- Invoice generation

### `/pharmacy/medications` — Medication Catalog
**What it shows:** Pharmacy's medication inventory.
- Drug name (Arabic + English), generic name, price, stock status
- Add/edit medications

### `/pharmacy/billing` & `/pharmacy/billing/insurance` — Pharmacy Billing
**What it shows:** Invoice management + insurance claims for pharmacy.

### `/pharmacy/settings` — Pharmacy Settings
**What it shows:** Pharmacy configuration, payment settings.

---

## 19. Admin Panel — Insurance Management

### `/insurance/dashboard` — Insurance Dashboard (amber-700)
**What it shows:** Insurance company overview.
- 4 stat cards: pending verifications, pending pre-auths, active claims, total payable
- Urgent pre-auth banner with SLA countdown
- Weekly claims chart (recharts BarChart)

### `/insurance/verifications` — Policy Verification Queue
**What it shows:** Patient policies pending verification.
- Table: patient name, policy number, submission date, card image
- Inline verification form: status (active/expired/suspended), annual limit, copay %, coverage end date
- On verify: patient notified via WhatsApp

### `/insurance/pre-auth` — Pre-Authorization Queue
**What it shows:** Pre-authorization requests from providers.
- Status tabs: all, submitted, under review, approved, denied
- SLA timer per request (green = within SLA, yellow = warning, red = overdue)
- Urgency badges

### `/insurance/pre-auth/[id]` — Pre-Auth Detail
**What it shows:** Full pre-authorization review.
- Patient info, procedure details, clinical justification, estimated cost
- Decision form: approve (amount + conditions + reference + validity) / partial / deny (reason + code)
- On decision: patient notified via WhatsApp

### `/insurance/claims` — Claims Queue
**What it shows:** Insurance claims from providers.
- Status tabs: submitted, under review, approved, rejected
- Claim number, patient, provider, type, amount

### `/insurance/claims/[id]` — Claim Detail
**What it shows:** Full claim review.
- Line items table, financial summary
- Pre-auth reference (if linked)
- Decision form: approve / partial / reject
- Computes provider_receives_egp, updates patient's used_limit

### `/insurance/remittance` — Remittance Management
**What it shows:** Batch payment processing.
- Existing remittances list
- "Create batch" → select provider + date range → shows approved unpaid claims → issue remittance

### `/insurance/remittance/new` — Create Remittance
**What it shows:** New batch remittance form.

### `/insurance/settings` — Insurance Settings
**What it shows:** Insurance company configuration.
- Pre-auth SLA hours (routine + urgent)
- Claims submission deadline days
- Reimbursement rate
- Auto-approve threshold

---

## 20. Admin Panel — ICU Management

### `/icu/overview` — National ICU Overview (Platform Admin)
**What it shows:** Nationwide ICU availability dashboard.
- Map or regional grouping of all hospitals with ICU data
- Bed availability by unit type
- Staleness indicators (green/yellow/grey)

### `/icu/setup` — ICU Unit Setup
**What it shows:** Configure ICU units for a hospital.
- Unit type (medical, surgical, cardiac, neonatal, paediatric, neuro)
- Total beds, ventilator count
- Contact information

### `/icu/beds` — ICU Bed Management
**What it shows:** Real-time bed status management.
- Grid: bed number, status (available/occupied/reserved/maintenance)
- Quick update buttons
- Last updated timestamp (feeds staleness indicator)

### `/icu/transfers` — ICU Transfer Requests
**What it shows:** Incoming transfer requests from other facilities.
- Patient info, sending facility, clinical justification, urgency
- Accept / Decline buttons

---

## 21. Admin Panel — Chain Management

### `/chain/dashboard` — Chain Dashboard (violet-700)
**What it shows:** Centralised view across all branches.
- 4 stat cards: total patients, today's patients, monthly revenue, avg wait time
- Branch status cards: per branch (green active / red closed), patient count, doctor count, wait time
- Revenue bar chart (per branch per week)
- New patients line chart

### `/chain/branches` — Branch List
**What it shows:** All branches with live status.
- Branch name, address, doctors, status, last activity
- "Add new branch" button

### `/chain/branches/new` — Add Branch Wizard
**What it shows:** 3-step wizard.
1. Identity: branch name (AR+EN), address, governorate, phone
2. Copy settings: from existing branch (working hours, config) or start fresh
3. Assign doctors: checkbox list of chain doctors

On save: creates new tenant with chain_id, copies config, creates doctor assignments.

### `/chain/branches/[branchId]` — Branch Detail
**What it shows:** Branch overview + link to that branch's existing admin panel.

### `/chain/doctors` — Chain-Wide Doctor Roster
**What it shows:** All doctors across all branches.
- Per doctor: name, specialty, which branches assigned, schedule per branch
- "Assign to branch" / "Edit schedule" / "Transfer" actions

### `/chain/patients` — Chain-Wide Patient Registry
**What it shows:** Patients recognised across the chain.
- Name, first seen date, total visits, branches visited, last visit
- Search + pagination

### `/chain/pricing` — Shared Pricing Catalog
**What it shows:** One price list for all branches.
- Service type tabs (consultation, lab, procedure)
- Price table with branch exception support
- "Export PDF" for price list

**Price resolution priority:**
1. Branch exception in chain_pricing → branch-specific price
2. Chain-level price → shared price
3. Branch fallback → branch's own pricing
4. Manual override → staff can always change

### `/chain/analytics` — Consolidated Analytics
**What it shows:** Cross-branch performance data.
- Period selector (week/month/quarter)
- Per-branch revenue cards with % change vs previous period
- Stacked bar chart: patients per branch per week
- Doctor performance table: name, branches, patients, revenue, avg wait
- Peak hours heatmap: day x hour grid
- Branch comparison table
- Export PDF / Excel

### `/chain/settings` — Chain Settings
**What it shows:** Chain configuration.
- Name (AR+EN), slug, branding colour
- Shared pricing toggle
- Shared patient records toggle

---

## 22. Mobile App — Patient

### Authentication
- **Phone login:** Same OTP flow as web
- **Biometric:** Face ID / Touch ID for returning users

### Home Screen (4-tab layout: Home, Records, History, Profile)
- **Triage CTA:** "ابدأ الفرز الطبي" — links to chat
- **Ask Triaji button:** Prominent teal card (NOT a 5th tab) — links to health assistant
- **Upcoming appointments** cards
- **Alert cards:** overdue follow-ups, overdue vaccinations, abnormal lab results
- **Profile switcher:** horizontal chips [Me] [Child1] [Child2] [+]

### Chat Screen
- Same AI triage as web but mobile-optimised
- Voice input via expo-av
- Camera for symptom photos

### Medical Record Screen
- Same dashboard as web but React Native components
- **Victory Native** vital trend charts (the standout feature — HbA1c trend on phone)
- Floating "Ask Triaji" FAB button

### History Screen
- Timeline with all visits, labs, prescriptions
- Payment status badges + "Pay Online" button

### GP Screen
- Doctor name, specialty, availability badge (🟢/🔴/⚪)
- **Video call button** (📹) — only when doctor available + has gp_video_calls_enabled
- Call history list
- "Book appointment" link

### Video Call Screen (LiveKit)
- Remote video full-screen, local PiP
- Controls: mute, camera, speaker, chat, end call
- Call timer, connection quality dots
- Recording consent banner
- 60-second no-answer timeout → "No answer" → navigate back

### Health Assistant Screen
- Same streaming chat as web but React Native
- Voice input, keyboard avoidance, haptic feedback
- Animated typing indicator (three dots)

### ICU Search, Lab Results, Prescription Tracking
- Same functionality as web equivalents, React Native UI

### Incoming Call (Modal Overlay)
- Triggered from _layout.tsx notification handler
- Full-screen overlay above all navigation
- Works when app is backgrounded
- Caller name, role, accept/decline buttons

---

## 23. Mobile App — Doctor

### Doctor Login
- Syndicate number + password (NOT email)
- Registration flow same as web

### Doctor Dashboard
- Today's appointments with patient cards
- GP interaction alerts
- ICU link
- Quick intake

### Patient Panel
- GP patients with health indicators
- "Needs attention" filter
- Video call button per patient (checks push token availability)

### Consultation Screen
- Pre-consultation summary
- Simplified prescription form
- Lab ordering
- Follow-up scheduling
- **In-call notes panel** (during video calls) — draft saved to gp_video_calls

### Video Call Screen
- Same as patient but with Notes button (📋, doctor only)
- Slide-up notes panel with TextInput, auto-saves draft
- On call end: navigates to post-call form

### Post-Call Clinical Form
- Pre-filled from Claude AI extraction (when transcription ready)
- Pre-loaded in-call draft notes
- If transcription processing: "Processing transcription — you can add notes now"
- 4 action buttons: prescription, labs, follow-up, save notes only
- Saves health_records with type='gp_video_consultation'

### Doctor Profile + Settings
- **Video call settings:** enable toggle, fee (free/paid), max duration (15/30/45/unlimited), per-day availability schedule
- Personal info, specialty, syndicate number

### Referrals + Follow-ups
- Referral management
- Follow-up tracking across all patients

---

## 24. API Routes Reference

### Patient APIs
| Route | Method | Description |
|-------|--------|-------------|
| `/api/chat` | POST | AI triage conversation |
| `/api/phone/send-otp` | POST | Send OTP |
| `/api/phone/verify-otp` | POST | Verify OTP |
| `/api/patient/onboarding` | POST | Save patient profile |
| `/api/patient/children` | GET/POST | List/add child profiles |
| `/api/patient/insurance/policy` | GET/POST | Insurance policies |
| `/api/patient/gp/request` | POST | Request GP |
| `/api/patient/consent/grant` | POST | Grant record access |
| `/api/health-assistant/chat` | POST | Health AI (SSE streaming) |
| `/api/health-assistant/sessions` | GET | Chat history |
| `/api/health-assistant/suggestions` | GET | Dynamic suggestions |
| `/api/payments/initiate` | POST | Create payment |
| `/api/payments/[reference]` | GET | Check payment status |

### Doctor APIs
| Route | Method | Description |
|-------|--------|-------------|
| `/api/doctor/clinical-document` | POST | Save prescription/lab order/notes |
| `/api/doctor/school-health` | POST | School health exam |
| `/api/doctor/paediatric-dose` | GET | Weight-based dose calculator |
| `/api/doctor/gp-call-settings` | POST | Video call config |
| `/api/doctor/gp-availability` | GET | Check availability |
| `/api/interactions/check` | POST | Drug interaction check (doctor only) |

### Telehealth APIs
| Route | Method | Description |
|-------|--------|-------------|
| `/api/telehealth/gp-room` | POST | Create video call room |
| `/api/telehealth/gp-token` | POST | LiveKit participant token |
| `/api/telehealth/gp-call/[id]` | PUT | Update call status |
| `/api/telehealth/gp-recording/start` | POST | Start recording |
| `/api/telehealth/gp-recording/stop` | POST | Stop recording |

### Webhook Routes
| Route | Provider | Description |
|-------|----------|-------------|
| `/api/webhooks/fawry` | Fawry | Payment confirmation |
| `/api/webhooks/paymob` | Paymob | Payment confirmation |
| `/api/webhooks/vodafone` | Vodafone Cash | Payment confirmation |
| `/api/webhooks/lab-chain/alborg` | Al-Borg | Lab results |
| `/api/webhooks/lab-chain/almokhtabar` | Al-Mokhtabar | Lab results |
| `/api/webhooks/lab-chain/alfa` | Alfa | Lab results |

### Cron Jobs
| Route | Schedule | Description |
|-------|----------|-------------|
| `/api/cron/vaccination-reminders` | Daily | Vaccination + turning-18 alerts |
| `/api/cron/claims-deadline` | Daily | Insurance claims deadline warnings |
| `/api/cron/payment-expiry` | Every 30 min | Expire stale payments, release slots |
| `/api/cron/lab-chain-results` | Every 2 hours | Poll chain APIs for results |
| `/api/cron/lab-chain-sync` | Daily | Sync branch/test data from chains |
| `/api/cron/protocol-check` | Daily | Chronic disease protocol compliance |

---

## 25. Database Schema Summary

### 53 Migrations (001–053)

| Migration | Tables/Changes |
|-----------|---------------|
| 001–006 | Foundation: patients, patient_profiles, tenants, doctors, bookings, triage_sessions |
| 007–009 | Doctor availability, RAG knowledge base, HIS adapters |
| 010–012 | Insurance provider codes, telehealth_sessions, language support |
| 013–015 | Phone calls, doctor accounts, health records, prescription items |
| 016 | Structured patient profile: allergies, conditions, medications, surgeries, family history, reproductive health |
| 017 | Lab module: lab_test_catalog, lab_services, lab_order_routing, lab_appointments |
| 018 | Pharmacy module: medication_catalog, pharmacy_invoices, prescription_routing |
| 019 | Longitudinal: vitals_history, follow_up_schedule, disease_protocols |
| 020 | Care coordination: gp_relationships, referrals, record_access_grants |
| 021 | Insurance: insurance_companies, patient_insurance_policies, pre_authorization_requests, insurance_claims, remittance_records |
| 022 | ICU: icu_units, icu_beds, icu_transfer_requests |
| 023 | Mobile: expo_push_tokens |
| 031 | Structured profile (allergy_options, chronic_condition_options, etc.) |
| 032–034 | Clinic tier, walk-in queue, clinic billing |
| 035–038 | Lab tenant, lab orders, pharmacy tenant, prescription routing |
| 039–042 | Vitals history, GP relationships, referrals, disease protocols |
| 043–044 | Insurance tenant, insurance policies/claims |
| 045 | ICU registry |
| 046 | Doctor push tokens |
| 047 | Medication interactions: drug_interactions (20 seeded), interaction_check_log |
| 048 | Paediatric: guardian_relationships, growth_measurements, who_growth_reference, vaccine_catalog (14 vaccines), vaccination_schedule, milestone_catalog (25 milestones), patient_milestones, school_health_records, paediatric_drug_dosing (8 drugs) |
| 049 | Payments: payment_transactions, payment_reference_seq |
| 050 | Lab chains: lab_chains (3 seeded), lab_chain_branches, lab_chain_test_mapping, lab_chain_webhooks, lab_chain_sync_log |
| 051 | GP video calls: gp_video_calls, doctor video config |
| 052 | Chains: chains, chain_pricing, chain_patient_registry, doctor_branch_assignments |
| 053 | Health assistant: health_assistant_sessions |

### Adapter Packages

| Package | Adapters | Purpose |
|---------|----------|---------|
| `@triaji/his-adapters` | Neuron, Shifa, Generic, Mock | Hospital Information System integration |
| `@triaji/insurance-adapters` | AXA, MetLife, Allianz, GlobeMed, Medmark | Insurance company API integration |
| `@triaji/payment-adapters` | Fawry, Paymob, Vodafone Cash | Payment gateway integration |
| `@triaji/lab-chain-adapters` | Al-Borg, Al-Mokhtabar, Alfa | Lab chain API integration |

### Core Packages

| Package | Purpose |
|---------|---------|
| `@triaji/shared` | Types, i18n strings, constants |
| `@triaji/rules-engine` | BRS calculator, emergency rules (including 5 paediatric rules) |

---

*Triaji — Complete Application Walkthrough*
*30 phases, 53 migrations, 196 pages, 3 applications*
*Built with: Next.js 15, React Native (Expo), Supabase, Claude AI, LiveKit, Deepgram, PostGIS*
