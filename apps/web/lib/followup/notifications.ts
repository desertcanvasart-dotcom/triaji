/**
 * Follow-Up WhatsApp Notification Functions
 *
 * Bilingual (Arabic/English) notification templates for follow-up events.
 * Uses sendWhatsAppMessage from the WhatsApp client.
 */

import { sendWhatsAppMessage, type WhatsAppResult } from '@/lib/whatsapp/client';

// ─── Arabic date formatting ─────────────────────────────────────────────────

function formatDateAr(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });
}

function formatDateEn(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });
}

// ─── Notification: Follow-Up Created ────────────────────────────────────────

interface FollowUpCreatedData {
  doctorName: string;
  followUpDate: string;
  reasonAr: string;
}

export async function sendFollowUpCreatedNotification(
  patientPhone: string,
  preferredLang: string,
  data: FollowUpCreatedData
): Promise<WhatsAppResult> {
  const message = preferredLang === 'en'
    ? [
        `Your doctor, ${data.doctorName}, has scheduled a follow-up visit.`,
        ``,
        `Date: ${formatDateEn(data.followUpDate)}`,
        data.reasonAr ? `Reason: ${data.reasonAr}` : '',
        ``,
        `We'll send you a reminder before your appointment.`,
        `Triajji Healthcare`,
      ].filter(Boolean).join('\n')
    : [
        `حدد لك الدكتور ${data.doctorName} موعد متابعة`,
        ``,
        `التاريخ: ${formatDateAr(data.followUpDate)}`,
        data.reasonAr ? `السبب: ${data.reasonAr}` : '',
        ``,
        `هنبعتلك تذكير قبل الموعد.`,
        `ترياچي للرعاية الصحية`,
      ].filter(Boolean).join('\n');

  return sendWhatsAppMessage(patientPhone, message);
}

// ─── Notification: Follow-Up Reminder (7 days / 1 day) ─────────────────────

interface FollowUpReminderData {
  doctorName: string;
  followUpDate: string;
  reasonAr: string;
}

export async function sendFollowUpReminder(
  patientPhone: string,
  preferredLang: string,
  type: '7days' | '1day',
  data: FollowUpReminderData
): Promise<WhatsAppResult> {
  const daysText = type === '7days'
    ? { ar: 'أسبوع', en: 'one week' }
    : { ar: 'يوم واحد', en: 'tomorrow' };

  const message = preferredLang === 'en'
    ? [
        `Reminder: Your follow-up appointment with Dr. ${data.doctorName} is in ${daysText.en}.`,
        ``,
        `Date: ${formatDateEn(data.followUpDate)}`,
        data.reasonAr ? `Reason: ${data.reasonAr}` : '',
        ``,
        `Please book your appointment if you haven't already.`,
        `Triajji Healthcare`,
      ].filter(Boolean).join('\n')
    : [
        `تذكير: موعد المتابعة مع الدكتور ${data.doctorName} بعد ${daysText.ar}.`,
        ``,
        `التاريخ: ${formatDateAr(data.followUpDate)}`,
        data.reasonAr ? `السبب: ${data.reasonAr}` : '',
        ``,
        `لو لسه محجزتش، احجز موعدك دلوقتي.`,
        `ترياچي للرعاية الصحية`,
      ].filter(Boolean).join('\n');

  return sendWhatsAppMessage(patientPhone, message);
}

// ─── Notification: Overdue Follow-Up ────────────────────────────────────────

interface OverdueReminderData {
  doctorName: string;
  followUpDate: string;
  reasonAr: string;
  patientName: string;
}

export async function sendOverdueReminder(
  patientPhone: string,
  preferredLang: string,
  data: OverdueReminderData
): Promise<WhatsAppResult> {
  const message = preferredLang === 'en'
    ? [
        `Hi ${data.patientName}, your follow-up appointment with Dr. ${data.doctorName} was due on ${formatDateEn(data.followUpDate)}.`,
        ``,
        data.reasonAr ? `Reason: ${data.reasonAr}` : '',
        ``,
        `Your doctor is concerned about your health. Please schedule a follow-up visit as soon as possible.`,
        `Triajji Healthcare`,
      ].filter(Boolean).join('\n')
    : [
        `أهلاً ${data.patientName}، موعد المتابعة مع الدكتور ${data.doctorName} كان المفروض يوم ${formatDateAr(data.followUpDate)}.`,
        ``,
        data.reasonAr ? `السبب: ${data.reasonAr}` : '',
        ``,
        `الدكتور بيسأل عليك. من فضلك احجز أقرب موعد متابعة.`,
        `ترياچي للرعاية الصحية`,
      ].filter(Boolean).join('\n');

  return sendWhatsAppMessage(patientPhone, message);
}
