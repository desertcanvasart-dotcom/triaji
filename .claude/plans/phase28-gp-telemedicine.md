# Phase 28 — GP Telemedicine: Implementation Plan

## Overview
LiveKit video consultations for GP-patient relationships — mobile-only, both-party initiation, recording with consent, Deepgram Arabic transcription, Claude clinical note extraction, and configurable pricing via Phase 26 payment gateway. Different from Phase 11 specialist telehealth: on-the-spot calls (not scheduled), mobile-only (not web), short check-ins (5–15 min), and ongoing relationship context.

---

## Batch 1: Migration 051 + LiveKit Setup + Types + i18n (~8 files)

1. **`supabase/migrations/051_gp_video_calls.sql`**
   - `gp_call_status` enum (initiated, ringing, accepted, declined, missed, in_progress, completed, failed)
   - `gp_call_initiator` enum (doctor, patient)
   - `gp_video_calls` table — relationship context, LiveKit room, timing, recording, transcription, pricing, post-call health record link
   - `doctor_accounts` ALTER: gp_video_call_fee_egp, gp_video_calls_enabled, max_call_duration_minutes, video_call_availability JSONB
   - `health_records` ALTER: gp_video_call_id FK
   - Enable Supabase Realtime on gp_video_calls
   - Indexes + RLS (patient own calls, doctor own calls)

2. **`apps/mobile/lib/livekit/setup.ts`** — registerGlobals() called at app startup
3. **`apps/mobile/lib/livekit/token.ts`** — getVideoCallToken() calling POST /api/telehealth/gp-token
4. **`apps/mobile/app.json`** — camera + microphone permissions
5. **`packages/shared/types/gp-video.ts`** — GpCallStatus, GpCallInitiator, GpVideoCall, GpCallSettings types
6. **`packages/shared/i18n/strings.ts`** — `videoCall` section (~30 AR+EN strings)

---

## Batch 2: GP Call APIs (6 routes)

1. **`POST /api/telehealth/gp-room`** — Create LiveKit room for GP call
   - Creates gp_video_calls record, generates LiveKit room via LiveKit SDK
   - Sends push notification to other party (high priority)
   - Auth: doctor or patient with active GP relationship

2. **`POST /api/telehealth/gp-token`** — Generate participant token
   - Reuses Phase 11 token generation pattern
   - Validates caller has access to this call
   - Auth: doctor or patient

3. **`PUT /api/telehealth/gp-call/[id]`** — Update call status
   - Accept, decline, end, missed transitions
   - On 'completed': calculate duration_seconds, trigger transcription if recorded
   - Sends push notifications for state changes
   - Auth: participant in the call

4. **`POST /api/telehealth/gp-recording/start`** — Start LiveKit egress recording
   - Uses EgressClient from livekit-server-sdk
   - Stores to Supabase Storage bucket 'gp-recordings'
   - Sets recording_expires_at = NOW() + 90 days
   - Auth: doctor (only doctor can initiate recording)

5. **`POST /api/telehealth/gp-recording/stop`** — Stop recording
   - Stops egress, saves URL to gp_video_calls.recording_url

6. **`GET /api/doctor/gp-availability`** — Check if doctor available now
   - Reads video_call_availability JSONB + current day/time
   - Returns: { available: boolean, nextWindow?: string }
   - Auth: patient with GP relationship

7. **`POST /api/doctor/gp-call-settings`** — Save video call config
   - Body: { fee, enabled, maxDuration, availability }
   - Auth: doctor

---

## Batch 3: Transcription Pipeline (2 files)

1. **`apps/web/lib/telehealth/transcribe.ts`**
   - `transcribeGpCall(callId)`:
     1. Download recording audio from Supabase Storage
     2. Deepgram Arabic transcription (nova-2, diarize=true for speaker separation)
     3. Format with speaker labels (الطبيب / المريض)
     4. Claude clinical note extraction (chief complaint, assessment, plan, follow-up, red flags)
     5. Store transcription_ar + structured_notes_ar
     6. Notify doctor via push (gp_transcription_ready)

2. **`POST /api/telehealth/gp-transcribe/[id]`** — Trigger transcription
   - Called after call ends if recording exists
   - Runs transcribeGpCall() asynchronously
   - Auth: internal (called by call-end handler)

3. **`GET /api/telehealth/gp-call/[id]/transcription`** — Get transcription
   - Returns transcription + structured notes when ready
   - Auth: doctor

---

## Batch 4: Mobile Components — Video Call UI (8 files)

1. **`apps/mobile/components/video-call/VideoCallScreen.tsx`** — Main call UI
   - Props: { callId, role, lang }
   - LiveKit Room + VideoTrack + AudioTrack
   - Remote video full-screen, local PiP in corner
   - Call duration timer
   - Connection quality indicator (🟢🟡🔴)
   - Poor connection banner after 10s

2. **`apps/mobile/components/video-call/IncomingCallScreen.tsx`** — Full-screen incoming call
   - Caller photo, name, role
   - Accept (green) / Decline (red) buttons
   - Vibration + ring sound

3. **`apps/mobile/components/video-call/CallControls.tsx`** — Mute/camera/speaker/chat/notes/end buttons
4. **`apps/mobile/components/video-call/ConnectionQuality.tsx`** — Quality dots
5. **`apps/mobile/components/video-call/RecordingConsent.tsx`** — Consent banner
6. **`apps/mobile/components/video-call/CallTimer.tsx`** — Duration display
7. **`apps/mobile/components/gp/AvailabilityBadge.tsx`** — 🟢/🔴/⚪ status indicator
8. **`apps/mobile/components/video-call/InCallChat.tsx`** — Simple text chat for poor audio

---

## Batch 5: Mobile Screens — Call Flow (5 files)

1. **`apps/mobile/app/(patient)/video-call/[callId].tsx`** — Patient video call screen
2. **`apps/mobile/app/(doctor)/video-call/[callId].tsx`** — Doctor video call screen
3. **`apps/mobile/app/(shared)/incoming-call/[callId].tsx`** — Incoming call (both roles)
4. **Modify `apps/mobile/app/(patient)/gp.tsx`** — Add availability indicator + call button + call history
5. **Modify `apps/mobile/app/(doctor)/patients/[patientId].tsx`** — Add video call button

---

## Batch 6: Post-Call Clinical Form (3 files)

1. **`apps/mobile/app/(doctor)/video-call/post-call/[callId].tsx`** — Post-call form page
2. **`apps/mobile/components/post-call/PostCallForm.tsx`** — Clinical form
   - Pre-filled from Claude extraction when available
   - If transcription not ready: empty fields + "جاري تفريغ المكالمة"
   - Actions: write prescription, order labs, schedule follow-up, save notes only
   - Saves health_records with document_type='gp_video_consultation', linked via gp_video_call_id
3. **`apps/mobile/components/post-call/TranscriptionView.tsx`** — View transcription + structured notes

---

## Batch 7: Pricing + Push Notifications + Call History (4 files)

1. **Modify `apps/mobile/app/(doctor)/profile.tsx`** — Video call settings section:
   - Toggle: gp_video_calls_enabled
   - Fee: free vs paid with amount input
   - Max duration: 15/30/45/unlimited
   - Availability: per-day time ranges

2. **Modify `apps/mobile/lib/notifications/handler.ts`** — Add 4 new notification types:
   - `gp_video_call_incoming` → full-screen incoming call UI
   - `gp_video_call_declined` → toast
   - `gp_video_call_missed` → toast
   - `gp_transcription_ready` → deep link to post-call form

3. **Patient call history** — in GP screen: list of past video calls with duration, complaint, post-call actions
4. **Doctor call history** — in patient detail: same + transcription access

---

## Batch 8: Verification
- TypeScript check: 0 new errors
- Tests pass
- Phase 11 web telehealth unaffected
- Manual checks:
  - Doctor initiates → patient gets push → accepts → video connects
  - Patient initiates → doctor gets push → accepts → video connects
  - No answer 60s → missed status
  - Recording consent → recording starts → stored in Supabase Storage
  - Transcription → Deepgram Arabic → Claude extraction → doctor notified
  - Post-call form pre-fills when transcription ready
  - Paid call → Phase 26 payment → call starts on success
  - Free call → no payment step
  - Availability badge correct (🟢/🔴/⚪)

---

## Key Architectural Decisions

1. **Mobile-only**: GP video calls are mobile-only — Phase 11 web telehealth stays for specialist consultations
2. **Both-party initiation**: either GP or patient can start a call — unlike Phase 11 which is always patient-initiated via booking
3. **Realtime status**: Supabase Realtime on gp_video_calls — both parties see status changes instantly
4. **Transcription is async**: runs after call ends, never blocks post-call form — form always available immediately
5. **Recording requires consent**: explicit patient consent banner — no recording without acknowledgement, 90-day expiry
6. **Free by default**: gp_video_call_fee_egp defaults to 0 — encourages ongoing GP relationships
7. **Reuses Phase 11 infra**: same LiveKit server, same token generation pattern — just different room naming and call model

## Total: ~35 new files, ~8 modified files
