# Phase 30 — Arabic Health AI Assistant: Implementation Plan

## Overview
"تريجي يسألك" / "Ask Triaji" — a personalised health companion grounded strictly in the patient's own medical records. Not a chatbot, not a symptom checker, not a second doctor. Every answer anchored to personal data. Arabic-first (Egyptian colloquial), bilingual, with safety guardrails and emergency escalation. Web + mobile. The final phase.

**The one rule:** Every answer must be based on the patient's own records. If the question has no grounding in their data → politely decline and refer to doctor.

---

## Batch 1: Migration 053 + Types + i18n (~5 files)

1. **`supabase/migrations/053_health_assistant.sql`**
   - `health_assistant_sessions` table — patient_id, lang, messages JSONB, message_count, escalation_triggered, context_snapshot_at
   - Indexes on patient_id + last_message_at
   - RLS: patients see only their own sessions

2. **`packages/shared/types/health-assistant.ts`** (new)
   - AssistantContext (11 data sources), AssistantSession, SafetyCheckResult, MedicationSummary, LabResultSummary, VitalTrendSummary, PrescriptionSummary, EncounterSummary, FollowUpSummary, ProtocolStatusSummary

3. **`packages/shared/types/index.ts`** (modified) — re-exports

4. **`packages/shared/i18n/strings.ts`** (modified) — `healthAssistant` section (~20 AR+EN strings: title, subtitle, greeting, inputPlaceholder, send, suggestions, history, contextBanner, typing, disclaimer, limitedData, etc.)

---

## Batch 2: Context Loader + System Prompt + Safety (3 files)

1. **`apps/web/lib/health-assistant/context-loader.ts`**
   - `loadAssistantContext(patientId)` — loads 11 data sources in parallel:
     - Profile (age, sex, governorate, work type)
     - Chronic conditions (from patient_chronic_conditions + chronic_condition_options)
     - Allergies (from patient_allergies + allergy_options)
     - Current medications (from patient_medications)
     - Recent lab results (6 months, with abnormal flags)
     - Vitals trend (12 months, with trend direction)
     - Active prescriptions (90 days, with dispensing status)
     - Recent encounters (6 months, doctor notes + plans)
     - Follow-ups (overdue + upcoming)
     - Protocol compliance (for chronic disease patients)
     - GP relationship
   - Returns structured `AssistantContext`
   - Cached in Redis/Supabase for 1 hour, invalidated on new lab/prescription/consultation

2. **`apps/web/lib/health-assistant/system-prompt.ts`**
   - `buildSystemPrompt(context)` — bilingual system prompt:
     - Arabic: Egyptian colloquial, friendly, 4-5 sentences max
     - English: clear, friendly
     - Injects all patient data
     - 7 core rules: grounded in data, no diagnosis, no new meds, no contradicting doctor, always refer back, reassuring, concise
     - Topics allowed vs declined
   - `generateSuggestedQuestions(context, lang)` — dynamic suggestions based on abnormal labs, overdue follow-ups, recent prescriptions, encounters, chronic conditions (max 3)

3. **`apps/web/lib/health-assistant/safety.ts`**
   - `runSafetyCheck(message, context)` — pre-send check:
     - Emergency patterns (Arabic + English): chest pain, breathing difficulty, numbness, sudden headache, fainting, severe bleeding, overdose
     - Mental health patterns: suicidal ideation, self-harm
     - Returns: { safe, requiresEscalation, reason }
   - `buildEscalationResponse(reason, lang)` — bilingual escalation:
     - Emergency → ambulance 123 + go to ER
     - Mental health → 08008880700 (free hotline) + "You are not alone"
   - `runPostResponseCheck(response, sessionId)` — post-response flagging:
     - Flag if assistant gave a diagnosis, suggested new medication, or contradicted doctor
     - Stored for clinical team review

---

## Batch 3: Conversation API (4 routes)

1. **`POST /api/health-assistant/chat`** — main conversation endpoint
   - Auth: patient
   - Body: { message, sessionId? }
   - Loads/creates session, loads context (cached), runs pre-safety check
   - If escalation → return escalation response immediately (no Claude call)
   - Calls Claude Sonnet with system prompt + message history
   - Appends to session, runs post-response check
   - Returns: { response, sessionId, escalated? }
   - **Streaming support**: returns text/event-stream for word-by-word display

2. **`GET /api/health-assistant/sessions`** — list patient's sessions (last 90 days)
3. **`GET /api/health-assistant/sessions/[id]`** — load a previous session
4. **`GET /api/health-assistant/suggestions`** — get dynamic suggested questions based on patient data

---

## Batch 4: Web UI (AR+EN) (4 files)

1. **`apps/web/components/health-assistant/AssistantChat.tsx`**
   - Props: { lang }
   - Chat interface: greeting with patient name, suggestion chips, message bubbles (user teal right, assistant grey left, RTL-aware)
   - Streaming response display (word by word)
   - Voice input button (🎤) reusing Deepgram from Phase 23
   - Context-awareness banner (collapsed): last labs date, last visit, active meds count
   - Minimum data threshold check: if no records → show "empty record" message
   - Disclaimer footer
   - Keyboard shortcut: Enter to send

2. **`apps/web/components/health-assistant/AssistantHistory.tsx`**
   - Sidebar/panel showing previous sessions (last 30 days)
   - Session preview: date, first message, message count
   - Tap to load and continue

3. **Pages:**
   - `apps/web/app/ar/health-assistant/page.tsx` → AssistantChat lang="ar" dir="rtl"
   - `apps/web/app/en/health-assistant/page.tsx` → AssistantChat lang="en" dir="ltr"

4. **Integration:** Add "اسأل تريجي" button to MedicalRecordDashboard

---

## Batch 5: Mobile UI (2 files)

1. **`apps/mobile/app/(patient)/health-assistant.tsx`**
   - Same conversation flow as web but React Native (View, Text, FlatList, TextInput)
   - Voice input via expo-av
   - Streaming response (ReadableStream → word-by-word state updates)
   - Keyboard avoidance (KeyboardAvoidingView)
   - Haptic feedback on send (expo-haptics)
   - Typing indicator: three animated dots
   - RTL-aware message bubbles
   - Suggestion chips as horizontal ScrollView
   - Context banner at top

2. **Integration:** Add "اسأل تريجي" / "Ask Triaji" button to mobile home screen and medical record screen

---

## Batch 6: Verification
- TypeScript: 0 new errors
- Tests pass
- Manual checks:
  - Arabic patient gets Arabic responses in Egyptian colloquial
  - English patient gets English responses
  - "ايه معنى السكر التراكمي" → answer references patient's own HbA1c values
  - "ايه أحسن دواء للضغط" (patient not on BP meds) → politely declined
  - "ايه أحسن دواء للضغط" (patient on amlodipine) → references their own prescription
  - "عندي ألم صدر شديد" → emergency escalation with 123
  - "عايز أموت" → mental health escalation with hotline number
  - Suggested questions reflect patient's actual data
  - Empty record patient → "سجلك لسه فاضي" message
  - Context cached → second message loads faster
  - Streaming works on web and mobile
  - Voice input works

---

## Key Architectural Decisions

1. **Strictly grounded**: system prompt enforces every answer from personal data — no generic health advice
2. **Safety first**: pre-send check for emergency/mental health patterns BEFORE calling Claude — never delayed
3. **Context caching**: 11 parallel DB queries cached for 1 hour — invalidated on data changes
4. **Streaming**: word-by-word display on both web and mobile — perceived latency under 1 second
5. **Post-response monitoring**: flags diagnoses, new med suggestions, doctor contradictions for clinical review
6. **Minimum data threshold**: empty records → redirect message, not empty chat
7. **Egyptian colloquial Arabic**: not MSA — "بص، أنت مريض سكر" not "إن مرض السكري لديك"

## Total: ~20 new files, ~5 modified files
