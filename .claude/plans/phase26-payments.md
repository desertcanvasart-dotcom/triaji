# Phase 26 — Payment Gateway Integration: Implementation Plan

## Overview
Online payments via Fawry (kiosk/card), Paymob (card/wallet/Apple Pay), and Vodafone Cash (mobile wallet). Two modes: pre-payment at booking and post-payment from invoices via WhatsApp links. Three-provider adapter pattern matching existing HIS/insurance adapter architecture.

---

## Batch 1: Migration 049 + Payment Adapter Package + Types + i18n
**~15 files**

1. **`supabase/migrations/049_payments.sql`**
   - `payment_provider` enum (fawry, paymob, vodafone_cash)
   - `payment_status` enum (pending, processing, completed, failed, expired, refunded, partial_refund)
   - `payable_type` enum (booking, clinic_invoice, lab_invoice, pharmacy_invoice, insurance_copay)
   - `payment_transactions` table — one row per payment attempt, generic payable_id, provider order tracking, HMAC webhook payload, refund tracking, receipt tracking
   - `payment_reference_seq` sequence + `next_payment_reference()` → PAY-2026-000001 format
   - `tenant_config` ALTER: accepts_online_payment, payment_providers[], fawry_merchant_code, paymob_integration_id, vf_merchant_code, payment_split_pct, bank IBAN
   - Indexes + RLS (patients see own payments, service_role for providers)

2. **`packages/payment-adapters/`** — new package
   - `interface.ts` — PaymentAdapter, CreatePaymentRequest/Result, PaymentVerificationResult, RefundResult
   - `factory.ts` — getPaymentAdapter(provider) → adapter
   - `adapters/fawry.ts` — Fawry Accept API v2 (HMAC-SHA256 signature, charge + verify + refund)
   - `adapters/paymob.ts` — Paymob Accept (auth token → order → payment key → iframe, HMAC-SHA512 webhook)
   - `adapters/vodafone.ts` — Vodafone Cash Business API (payment initiation, approval flow)

3. **`packages/shared/types/payment.ts`** — PaymentTransaction, PaymentProvider, PaymentStatus, PayableType types
4. **`packages/shared/i18n/strings.ts`** — `payment` section (~30 AR+EN strings)
5. **`.env.example`** — add 9 payment env vars

---

## Batch 2: Payment APIs (6 routes)
**Core payment initiation, status, and webhook handling**

1. **`POST /api/payments/initiate`** — Create payment transaction
   - Body: { payable_type, payable_id, provider, patient_id }
   - Generates triaji_reference via `next_payment_reference()` RPC
   - Calls adapter.createPayment() → returns payment URL / Fawry code
   - Creates `payment_transactions` row with status='pending'
   - Returns: { reference, paymentUrl?, fawryCode?, expiresAt }
   - Auth: patient session OR public (for WhatsApp link flow)

2. **`GET /api/payments/[reference]`** — Check payment status
   - Returns payment_transactions row with payable details
   - No auth required (reference is the token — per prompt: "accessible without login")

3. **`POST /api/webhooks/fawry`** — Fawry webhook handler
   - Verify HMAC-SHA256 signature → 401 if invalid
   - Idempotent: skip if already completed
   - On success: mark payment completed → update payable → send receipt WhatsApp
   - No auth (webhook from Fawry servers)

4. **`POST /api/webhooks/paymob`** — Paymob webhook handler
   - Verify HMAC-SHA512 → 401 if invalid
   - Same completion flow as Fawry

5. **`POST /api/webhooks/vodafone`** — Vodafone Cash webhook handler
   - Signature verification per VF API docs
   - Same completion flow

6. **Shared webhook processor** `apps/web/lib/payments/process-webhook.ts`
   - `processPaymentCompletion(triaji_reference, provider_details)`:
     - Update payment_transactions status
     - If payable_type='booking': set booking status='confirmed', send confirmation WhatsApp
     - If payable_type='clinic_invoice': set status='paid', payment_method=provider
     - If payable_type='pharmacy_invoice': same
     - If payable_type='lab_invoice': same
     - If payable_type='insurance_copay': same
     - Send receipt WhatsApp (bilingual based on patient's preferred_language)

---

## Batch 3: Payment Checkout Page (AR+EN)
**The unified payment page — accessible from WhatsApp links without login**

1. **`apps/web/app/ar/pay/[reference]/page.tsx`** + **`/en/pay/[reference]/page.tsx`**
   - Fetches payment_transactions by triaji_reference
   - Shows invoice summary (description, amount, provider name)
   - Shows available payment methods (filtered by provider's payment_providers[])
   - Three payment method cards: Card/Paymob, Fawry, Vodafone Cash

2. **`apps/web/components/payment/PaymentCheckout.tsx`**
   - Props: { reference, lang }
   - State machine: idle → selecting → processing → success/failed/expired
   - Fawry flow: show code + copy button + kiosk instructions + card redirect option
   - Paymob flow: redirect to Paymob iframe URL
   - Vodafone flow: phone number input → waiting for approval screen
   - Security notice: "تريجي لا تخزن بيانات بطاقتك"

3. **Success/failed pages:**
   - `/ar/pay/success` + `/en/pay/success` — green checkmark, receipt details
   - `/ar/pay/failed` + `/en/pay/failed` — retry option

---

## Batch 4: Pre-Payment at Booking
**Integrate payment into the booking confirmation flow**

1. **Modify booking confirmation** (`apps/web/components/booking/BookingConfirmation.tsx`):
   - If provider has `accepts_online_payment = true`: show fee + two buttons:
     - "ادفع وأكد الحجز 💳" → creates payment_transactions with payable_type='booking'
     - "احجز بدون دفع مسبق" → existing flow
   - If no online payment: existing flow unchanged

2. **Modify booking API** (`apps/web/app/api/booking/route.ts`):
   - Add `payment_pending` to booking status
   - When payment requested: create booking with status='payment_pending' → create payment → return reference
   - Do NOT send confirmation WhatsApp yet (wait for payment)

3. **Mobile booking** — modify `apps/mobile/app/(patient)/booking/confirm.tsx`:
   - Same payment options as bottom sheet
   - "Pay" opens `/ar/pay/[reference]` in in-app WebView via deep link

---

## Batch 5: Post-Payment from Invoices + WhatsApp
**Payment links in WhatsApp messages and in-app invoice screens**

1. **Modify WhatsApp invoice templates** (`apps/web/lib/whatsapp/templates.ts`):
   - When provider has accepts_online_payment: append payment link to invoice messages
   - Link format: `https://triaji.com/{lang}/pay/{reference}`
   - Bilingual (AR + EN)

2. **Modify patient history screens** (web + mobile):
   - Add payment status badge per invoice: ✅ مدفوع / ⏳ غير مدفوع / 💳 قيد المعالجة
   - Unpaid invoices show "ادفع أونلاين" / "Pay Online" button
   - Button opens the payment page

3. **Payment notification functions** `apps/web/lib/payments/notifications.ts`:
   - `sendPaymentReceipt(phone, lang, data)` — bilingual receipt WhatsApp
   - `sendPaymentExpiredNotification(phone, lang, data)` — booking expired
   - `sendPaymentReminder(phone, lang, data)` — manual reminder from provider

---

## Batch 6: Payment Expiry Cron + Provider Dashboard
**Cleanup and admin visibility**

1. **`GET /api/cron/payment-expiry`** — runs every 30 minutes
   - Find pending payments past expiry (Fawry: 24h, Paymob: 1h)
   - Mark status='expired'
   - If booking: release slot, set booking status='cancelled', notify patient
   - Invoices: leave as unpaid (can retry)

2. **Admin payment APIs:**
   - `GET /api/admin/payments/summary` — totals by status (paid cash / paid online / unpaid)
   - `POST /api/admin/payments/reminder` — send payment reminder WhatsApp

3. **Provider billing enhancement:**
   - Modify `/clinic/billing`, `/lab/billing`, `/pharmacy/billing` pages:
     - Add 4 stat cards (total / paid cash / paid online / unpaid)
     - Unpaid invoices list with "إرسال تذكير" button
   - Payment settings in provider settings page:
     - Toggle: accepts_online_payment
     - Checkboxes: fawry, paymob, vodafone_cash
     - Merchant code inputs per provider
     - Save to tenant_config

---

## Batch 7: Verification
- TypeScript check: 0 new errors
- Tests pass
- Manual checks:
  - `/ar/pay/[ref]` accessible without login
  - Fawry code displayed + copy works
  - Paymob iframe redirect works
  - Vodafone phone input + waiting screen
  - Webhook HMAC verification rejects invalid signatures
  - Idempotent webhook handling (duplicate webhook → no duplicate action)
  - Booking pre-payment: slot held → payment → confirmed → WhatsApp
  - Expired payment: slot released → booking cancelled → patient notified
  - Invoice post-payment: WhatsApp link → pay → paid badge
  - Provider dashboard: correct totals + reminder sends WhatsApp
  - No card data stored in Triaji database

---

## Key Architectural Decisions

1. **Reference-as-token**: payment page uses triaji_reference as auth — no login required. This is critical for WhatsApp link access.
2. **Adapter pattern**: same interface for all 3 providers — easy to add DragonPay, ValU, etc. later
3. **Idempotent webhooks**: always check if already processed before acting — providers may send duplicates
4. **Never mandatory**: "Pay at clinic" option always available — online payment is convenience, not requirement
5. **Never touch card data**: all card entry on provider's hosted page/iframe — Triaji only stores references
6. **Webhook processor shared**: one `processPaymentCompletion()` handles all payable types — DRY

## Security
- HMAC signature verification on all 3 webhook routes
- No card/CVV data in database — ever
- Payment page public (no auth) but scoped by reference
- Service role for webhook processing (not anon key)

## Total: ~35 new files, ~10 modified files
