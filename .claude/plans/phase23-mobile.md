# Phase 23 — Native Mobile App Upgrade — Implementation Plan

## Starting Point

Phase 12 already built a functional mobile app with:
- Expo SDK 52, Expo Router 4 (file-based), React 18.3
- Phone OTP auth, MMKV storage, Cairo font, RTL support
- Chat triage, doctor booking (modal), session history, health records upload
- Telehealth placeholder, voice recording (expo-av), push notifications
- Bilingual via `useLang()` hook + `@triaji/shared` i18n
- Styling: pure React Native StyleSheet (NO NativeWind/Tailwind currently)

**Key constraints:**
- No NativeWind currently installed → prompt asks for NativeWind v4, but the entire app uses StyleSheet. **Decision: keep StyleSheet** to avoid rewriting every existing screen. NativeWind can be added incrementally later.
- Expo Router v4 already installed (not v3 as prompt says) → keep v4.
- MMKV used instead of AsyncStorage → keep MMKV (it's faster and encrypted).
- No separate Arabic/English components needed — `useLang()` hook already handles everything.
- No database migration needed (except `expo_push_token` on `doctor_accounts`).

---

## 10 Batches — Strict Build Order

### Batch 1 — Migration + New Packages + Config (~5 files)

**Migration:** `046_doctor_push_token.sql`
```sql
ALTER TABLE doctor_accounts ADD COLUMN IF NOT EXISTS expo_push_token TEXT;
```

**New Expo packages to install:**
```bash
npx expo install expo-local-authentication  # Biometric
npx expo install expo-location              # ICU + maps
npx expo install expo-haptics               # Tactile feedback
npx expo install expo-sharing               # Share medical record
npx expo install expo-file-system           # PDF download
npx expo install react-native-maps          # Hospital maps
pnpm add victory-native                     # Vital charts
```

**Update `app.json`:**
- Add location permission descriptions (iOS + Android)
- Add biometric permission (iOS Face ID usage description)
- Add Android notification channels: `default` + `emergency` (high importance)

**Create `.env` file** with env vars (template only — no secrets).

**Files: ~3 new/modified**

---

### Batch 2 — Auth Upgrade: Biometric + Doctor Login (~6 files)

**Biometric auth:** `lib/auth/biometric.ts`
- `authenticateWithBiometrics()` — Face ID / fingerprint via expo-local-authentication
- On first successful OTP login → ask to enable biometrics
- On subsequent opens → biometric prompt, falls back to OTP
- Store encrypted session in MMKV (already encrypted)

**Doctor login screen:** `app/(doctor)/login.tsx`
- Email + password form (not syndicate number — Phase 14 uses email/password)
- Calls Supabase auth `signInWithPassword`
- Stores doctor session in MMKV under separate keys
- On success → navigate to `(doctor)/index`

**Doctor registration:** `app/(doctor)/register.tsx`
- Full name, syndicate number, specialty, governorate, phone, email, password
- POST to `/api/doctor/auth/register`
- On success → navigate to pending verification screen

**Update `useAuth` hook:**
- Add `doctorId`, `isDoctorMode` state
- Add `loginAsDoctor()`, `logoutDoctor()` methods
- Root layout checks: if doctor session → show `(doctor)` tabs, else `(patient)` tabs

**Update root `_layout.tsx`:**
- Add biometric check on app open
- Add doctor/patient routing logic
- Keep existing font loading + splash screen

**Files: ~6 new/modified**

---

### Batch 3 — Patient Home Screen Upgrade (~4 files)

**Upgrade `app/(patient)/index.tsx`** — currently just redirects to chat.
Rebuild as the full home screen from the prompt:

- Greeting: "مرحباً، {name} 👋" with date
- Notification bell badge (count from API)
- Alerts section: protocol alerts, overdue follow-ups (from `/api/patient/alerts`)
- Upcoming appointments card (from `/api/patient/bookings`)
- Current medications strip (from `/api/patient/medications`)
- "Start chat" CTA button
- Doctor Trio card (deep link to chat with Trio flag)
- Emergency ICU shortcut

**New API endpoint (web):** `apps/web/app/api/patient/home/route.ts`
- GET: returns { alerts, upcomingBookings, medications, protocolAlerts } in one call
- Auth: patient token

**New component:** `components/shared/AlertCard.tsx`
- Reusable alert card with icon, title, description, CTA

**Files: ~4 new/modified**

---

### Batch 4 — Medical Record Dashboard (~8 files)

**Upgrade `app/(patient)/medical-record.tsx`** (currently `records.tsx` — rename to new route):
Full medical record dashboard from Phase 19.

**New components in `components/medical-record/`:**

1. `AllergyBanner.tsx` — always-visible red strip with allergy list
2. `VitalTrendChart.tsx` — Victory Native line charts (HbA1c, BP, weight)
   - Tap → full-screen expanded view modal
3. `MedicationCard.tsx` — medication with dose, frequency, adherence badge
4. `FollowUpCard.tsx` — upcoming follow-up with "Book now" link
5. `ProtocolCompliance.tsx` — per-condition compliance gauge
6. `VitalsSheet.tsx` — bottom sheet for quick vitals entry (weight, BP, glucose)
   - Haptic feedback on stepper buttons (expo-haptics)
   - POST to `/api/patient/vitals/log`

**Share record button:**
- Creates 24h share link via `/api/patient/records/share-link`
- Opens native share sheet via expo-sharing

**Offline cache:**
- `lib/storage/cache.ts` — cache last medical record fetch in MMKV
- Show cached data with "offline" banner when no network
- `components/shared/OfflineBanner.tsx`

**Files: ~8 new/modified**

---

### Batch 5 — History Timeline + Lab Results + Pharmacy (~5 files)

**Upgrade `app/(patient)/history.tsx`:**
- Grouped by date (Section list)
- Each encounter card: doctor, specialty, summary, prescriptions, lab orders, follow-up
- Filter chips: All | Visits | Labs | Prescriptions | Imaging
- Expandable detail view

**New screen:** `app/(patient)/labs/results/[id].tsx`
- Lab results view: test name, value, reference range, normal/abnormal badge
- Color coding: green (normal), red (abnormal)
- PDF download via expo-file-system + share

**New screen:** `app/(patient)/pharmacy/prescription/[id].tsx`
- Prescription status tracker (5-step timeline)
- Pharmacy location with "Open in Maps" link
- "Bring original prescription" warning

**Files: ~5 new**

---

### Batch 6 — ICU Search (Patient + Doctor) (~5 files)

**Patient ICU screen:** `app/(patient)/icu.tsx`
- Read-only ICU search (no transfer capability)
- Location via expo-location (request permission)
- Unit type filter pills
- Staleness colour coding (green < 2h, yellow 2-6h, grey > 6h)
- Phone number → opens phone dialer (Linking.openURL)
- Supabase Realtime subscription for live bed count updates

**Doctor ICU screen:** `app/(doctor)/icu.tsx`
- Full ICU search + transfer request
- Same search UI as patient
- "Request Transfer" button per result → opens bottom sheet

**Transfer request sheet:** `components/icu/TransferRequestSheet.tsx`
- Bottom sheet modal with patient info + clinical summary + urgency
- Emergency callout with hospital phone
- POST to `/api/icu/transfer`
- On success → show transfer tracker inline

**ICU result card:** `components/icu/IcuResultCard.tsx`
- Reusable card: hospital name, distance, bed count, staleness indicator, phone

**Files: ~5 new**

---

### Batch 7 — GP + Privacy + Profile Upgrade (~4 files)

**GP screen:** `app/(patient)/gp.tsx`
- If GP exists: show doctor card with "Message", "Book", "End relationship" actions
- If no GP: "Choose your GP" CTA → opens doctor search
- Fetches from `/api/patient/gp`

**Privacy screen:** `app/(patient)/privacy.tsx`
- Consent management: who can see records
- Active access grants with revoke buttons
- From `/api/patient/privacy`

**Upgrade profile screen:** `app/(patient)/profile.tsx`
- Add: insurance section (show active policy status)
- Add: notification preferences (toggle per type)
- Add: language toggle (already exists, keep)
- Add: biometric toggle
- Keep: logout

**Files: ~4 new/modified**

---

### Batch 8 — Doctor Screens (~8 files)

**Doctor dashboard:** `app/(doctor)/index.tsx`
- Today's appointments list
- Overdue follow-up alerts badge
- New lab results badge
- "Quick intake" button
- ICU panel card (emergency accent)

**Doctor tab layout:** `app/(doctor)/_layout.tsx`
- 4 tabs: Dashboard, Patients, ICU, Profile
- Arabic/English tab labels via useLang

**Pre-consultation view:** `app/(doctor)/consultation/[bookingId].tsx`
- Patient summary: demographics, BRS, allergies, chronic conditions
- Medications list
- Recent lab results
- Previous doctor notes
- Action buttons: Write prescription, Order labs, Schedule follow-up, Refer

**Doctor components:**
1. `components/doctor/BookingCard.tsx` — appointment card with patient info
2. `components/doctor/PatientSummary.tsx` — compact patient medical summary
3. `components/doctor/PrescriptionForm.tsx` — add medications + dose + frequency
4. `components/doctor/OverdueAlert.tsx` — overdue follow-up card

**Files: ~8 new**

---

### Batch 9 — Doctor Patient Panel + Referrals + Follow-ups (~5 files)

**Patient panel:** `app/(doctor)/patients/index.tsx`
- List of GP patients with health indicators
- "Needs attention" filter (red/yellow/green)
- Guard: redirect to dashboard if no GP relationships
- Fetches from `/api/doctor/patients`

**Patient detail:** `app/(doctor)/patients/[patientId].tsx`
- Full patient view: vitals, medications, lab history, protocol compliance
- GP freestanding note text area
- From `/api/doctor/patients/[id]`

**Referrals:** `app/(doctor)/referrals.tsx`
- Tabs: Incoming | Outgoing
- Incoming: accept/decline buttons
- Outgoing: status tracking

**Follow-ups:** `app/(doctor)/follow-ups.tsx`
- Overdue follow-up list
- "Send reminder" button per patient

**Doctor profile:** `app/(doctor)/profile.tsx`
- Doctor info, language toggle, notification preferences, logout

**Files: ~5 new**

---

### Batch 10 — Push Notifications Upgrade + Verification (~4 files)

**Upgrade notification handler:** `lib/notifications/handler.ts`
- Handle all 10 notification types with deep linking
- Emergency channel for ICU transfer notifications (Android high importance)
- Notification tap → navigate to correct screen via expo-router

**Push notification server function:** `apps/web/lib/notifications/push.ts`
- `sendPushNotification(token, title, body, data)` → Expo push service
- Priority: high for ICU transfers, normal for everything else

**Update existing web notification functions:**
- In each existing notification function (lab results, prescriptions, follow-ups, etc.):
  - Check if patient/doctor has `expo_push_token`
  - If yes: send push notification IN ADDITION to WhatsApp
  - WhatsApp is NOT replaced — push is supplementary

**TypeScript verification:**
- `pnpm --filter @triaji/mobile exec tsc --noEmit`
- Fix any errors

**Files: ~4 new/modified**

---

## Summary Table

| Batch | Focus | New Files | Modified |
|-------|-------|-----------|----------|
| 1 | Migration + packages + config | 2 | 1 |
| 2 | Auth (biometric + doctor login) | 4 | 2 |
| 3 | Patient home screen | 3 | 1 |
| 4 | Medical record dashboard | 7 | 1 |
| 5 | History + labs + pharmacy | 5 | 0 |
| 6 | ICU search (patient + doctor) | 5 | 0 |
| 7 | GP + privacy + profile | 2 | 2 |
| 8 | Doctor screens (dashboard + consult) | 8 | 0 |
| 9 | Doctor panel + referrals | 5 | 0 |
| 10 | Push notifications + verify | 2 | 2 |
| **Total** | | **~43** | **~9** |

---

## Key Architectural Decisions

| Decision | Rationale |
|----------|-----------|
| **Keep StyleSheet, skip NativeWind** | Entire Phase 12 app uses StyleSheet. Introducing NativeWind means rewriting every screen. Not worth the risk. Can migrate incrementally later. |
| **Keep Expo Router v4** | Already installed, v3 is older. v4 is backward-compatible. |
| **Keep MMKV over AsyncStorage** | MMKV is already used throughout, is faster, and supports encryption. The prompt mentions AsyncStorage but MMKV is already the better choice in place. |
| **No separate AR/EN component files** | `useLang()` hook already handles bilingual. All strings from `@triaji/shared/i18n/strings.ts`. |
| **Push supplements WhatsApp, not replaces** | Many patients don't have the app installed. WhatsApp remains the primary channel. Push is added for app users. |
| **Doctor and patient share one app binary** | Single app with role-based routing. Root layout checks session type → shows appropriate tab group. |
| **Keep existing screens, extend them** | Prompt says "Do NOT rebuild Phase 12 from scratch — upgrade and extend." |
| **Victory Native for charts** | React Native equivalent of recharts. Used for vital trends only. |
| **Telehealth deferred to Phase 23b** | Prompt explicitly says: "LiveKit React Native requires significant native module setup; plan as Phase 23b." |

---

## What's NOT in This Plan (Per Prompt)

- ❌ Admin panel in mobile (staff use web)
- ❌ Full offline mode (graceful degradation only)
- ❌ Payment gateway (Phase 26)
- ❌ Telehealth video (Phase 23b)
- ❌ App Store submission (EAS internal only)
- ❌ NativeWind migration (incremental later)
