# Messaging & Telephony Channels — Provider Decision

**Status:** Decided · **Date:** 2026-09-10

## Decision

**Zernio is used for WhatsApp only.** The SMS gateway and the call center stay on
their own (Egyptian/local) providers and do **not** route through Zernio.

| Channel | Provider | Notes |
| --- | --- | --- |
| WhatsApp | **Zernio** | Shipped (Zernio WhatsApp provider, PR #12). End-customer numbers connect via Meta Embedded Signup — Egyptian WhatsApp numbers work fine. |
| SMS (OTP, reminders) | **Local Egyptian SMS gateway** (unchanged) | Needs a licensed Egyptian aggregator + registered alphanumeric sender ID. Not Zernio. |
| Call center (inbound/outbound voice) | **Twilio** (unchanged) | Requires a local Egyptian number. Not Zernio. |

## Why Zernio can't do SMS / voice for Egypt

We asked Zernio directly. Their answer:

- Zernio sells **dedicated numbers** (which carry SMS and PSTN calls) in **57 countries.
  Egypt is not one of them.** You cannot buy an Egyptian number through Zernio.
- SMS and voice/call-center features (forwarding, IVR, voicemail, recording,
  transcription, SIP routing) only work on a number **provisioned through Zernio** — a
  number you bring (e.g. a connected WhatsApp number) has no Zernio line behind it, so
  Calls and SMS cannot be enabled on it.
- Their suggested workarounds are to buy a **US/Canada** number (instant, no KYC) or a
  "documents, no local presence" number (South Africa, Kenya, Mexico, Thailand, …).

Those workarounds do **not** fit a patient-facing Egyptian product, because the
constraint is the *Egyptian recipient's* carrier and expectations, not our ability to
buy a number:

- **SMS deliverability** — A2P SMS into Egypt from a foreign long code is heavily
  filtered by Egyptian carriers; OTP/booking messages would fail or arrive late.
- **Regulatory (NTRA)** — Egyptian A2P/bulk SMS must go through a licensed local
  aggregator with a registered sender ID (e.g. "DoctorTrio"); a foreign Zernio number
  can't carry that sender ID.
- **Trust** — a medical OTP or reminder from a random foreign number reads as a scam.
- **Inbound calls** — patients will not dial a foreign number to reach a clinic; a call
  center needs a local Egyptian caller-ID for anyone to call in, and for outbound calls
  to actually connect.

## Scope / when this could change

- This decision is about numbers we provision for **SMS/PSTN**. It does **not** affect
  WhatsApp, where customers bring their own (Egyptian) numbers via Embedded Signup.
- The only case where Zernio SMS/voice would be worth adding is reaching people
  **outside Egypt** (diaspora patients, international insurers, roaming lab/ICU
  partners). A Zernio US number is a fine, instant option for that segment only.
- Architecturally nothing changes: WhatsApp, the SMS gateway, and Twilio (phone) are
  already separate integrations. Zernio slots in as the WhatsApp provider only.
