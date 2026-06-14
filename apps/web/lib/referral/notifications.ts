/**
 * Referral WhatsApp Notification Functions
 *
 * Bilingual (Arabic/English) notification templates for referral events.
 * Patient messages respect preferred_language. Doctor messages always Arabic.
 * Uses sendWhatsAppMessage from the WhatsApp client.
 */

import { sendWhatsAppMessage, type WhatsAppResult } from '@/lib/whatsapp/client';

// ─── Notification: Referral Sent to Patient ──────────────────────────────────
// Patient receives: "Doctor X referred you to {specialty}"

interface ReferralSentToPatientData {
  referringDoctorName: string;
  specialtyAr: string;
  specialtyEn?: string;
  urgency: string;
  reasonAr: string;
}

export async function sendReferralSentToPatient(
  phone: string,
  preferredLang: string,
  data: ReferralSentToPatientData
): Promise<WhatsAppResult> {
  const urgencyLabels: Record<string, { ar: string; en: string }> = {
    routine: { ar: 'عادي', en: 'Routine' },
    urgent: { ar: 'عاجل', en: 'Urgent' },
    emergency: { ar: 'طوارئ', en: 'Emergency' },
  };

  const urgencyLabel = urgencyLabels[data.urgency] ?? urgencyLabels['routine']!;

  const message =
    preferredLang === 'en'
      ? [
          `Dr. ${data.referringDoctorName} has referred you to a ${data.specialtyEn ?? data.specialtyAr} specialist.`,
          ``,
          `Urgency: ${urgencyLabel.en}`,
          `Reason: ${data.reasonAr}`,
          ``,
          `We'll notify you when a specialist accepts your referral.`,
          `Triajji Healthcare`,
        ].join('\n')
      : [
          `الدكتور ${data.referringDoctorName} حولك لأخصائي ${data.specialtyAr}.`,
          ``,
          `الأولوية: ${urgencyLabel.ar}`,
          `السبب: ${data.reasonAr}`,
          ``,
          `هنبلغك لما الأخصائي يقبل التحويل.`,
          `ترياچي للرعاية الصحية`,
        ].join('\n');

  return sendWhatsAppMessage(phone, message);
}

// ─── Notification: Referral to Receiving Doctor (Tier 2) ─────────────────────
// Receiving doctor: "New referral from Dr. X"

interface ReferralToDoctorData {
  referringDoctorName: string;
  patientName: string;
  specialtyAr: string;
  reasonAr: string;
  urgency: string;
}

export async function sendReferralToDoctor(
  phone: string,
  _preferredLang: string,
  data: ReferralToDoctorData
): Promise<WhatsAppResult> {
  const urgencyLabels: Record<string, string> = {
    routine: 'عادي',
    urgent: 'عاجل',
    emergency: 'طوارئ',
  };

  // Doctor messages always Arabic
  const message = [
    `تحويل جديد من الدكتور ${data.referringDoctorName}.`,
    ``,
    `المريض: ${data.patientName}`,
    `التخصص: ${data.specialtyAr}`,
    `الأولوية: ${urgencyLabels[data.urgency] ?? 'عادي'}`,
    `السبب: ${data.reasonAr}`,
    ``,
    `يرجى قبول أو رفض التحويل من لوحة التحكم.`,
    `ترياچي للرعاية الصحية`,
  ].join('\n');

  return sendWhatsAppMessage(phone, message);
}

// ─── Notification: Referral Accepted to Patient ──────────────────────────────
// Patient: "Dr. X accepted your referral"

interface ReferralAcceptedToPatientData {
  acceptingDoctorName: string;
  specialtyAr: string;
  specialtyEn?: string;
}

export async function sendReferralAcceptedToPatient(
  phone: string,
  preferredLang: string,
  data: ReferralAcceptedToPatientData
): Promise<WhatsAppResult> {
  const message =
    preferredLang === 'en'
      ? [
          `Great news! Dr. ${data.acceptingDoctorName} (${data.specialtyEn ?? data.specialtyAr}) has accepted your referral.`,
          ``,
          `You can now book an appointment with the specialist.`,
          `Triajji Healthcare`,
        ].join('\n')
      : [
          `خبر سار! الدكتور ${data.acceptingDoctorName} (${data.specialtyAr}) قبل التحويل الخاص بك.`,
          ``,
          `يمكنك الآن حجز موعد مع الأخصائي.`,
          `ترياچي للرعاية الصحية`,
        ].join('\n');

  return sendWhatsAppMessage(phone, message);
}

// ─── Notification: Referral Declined to Referrer ─────────────────────────────
// Referring doctor: "Dr. X declined, auto-downgraded to Tier 1"

interface ReferralDeclinedToReferrerData {
  decliningDoctorName: string;
  patientName: string;
  specialtyAr: string;
  reasonAr?: string;
}

export async function sendReferralDeclinedToReferrer(
  phone: string,
  _preferredLang: string,
  data: ReferralDeclinedToReferrerData
): Promise<WhatsAppResult> {
  // Doctor messages always Arabic
  const message = [
    `الدكتور ${data.decliningDoctorName} رفض تحويل المريض ${data.patientName}.`,
    ``,
    data.reasonAr ? `السبب: ${data.reasonAr}` : '',
    `تم تحويل الطلب تلقائياً إلى المستوى الأول (أي أخصائي ${data.specialtyAr} متاح).`,
    ``,
    `ترياچي للرعاية الصحية`,
  ]
    .filter(Boolean)
    .join('\n');

  return sendWhatsAppMessage(phone, message);
}

// ─── Notification: Referral Outcome to Referrer ──────────────────────────────
// Referring doctor: outcome report from specialist

interface ReferralOutcomeToReferrerData {
  specialistName: string;
  patientName: string;
  outcomeSummaryAr: string;
}

export async function sendReferralOutcomeToReferrer(
  phone: string,
  _preferredLang: string,
  data: ReferralOutcomeToReferrerData
): Promise<WhatsAppResult> {
  // Doctor messages always Arabic
  const message = [
    `تقرير نتيجة التحويل من الدكتور ${data.specialistName} بخصوص المريض ${data.patientName}.`,
    ``,
    `الملخص: ${data.outcomeSummaryAr}`,
    ``,
    `يرجى مراجعة التفاصيل الكاملة من لوحة التحكم.`,
    `ترياچي للرعاية الصحية`,
  ].join('\n');

  return sendWhatsAppMessage(phone, message);
}
