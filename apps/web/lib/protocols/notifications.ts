/**
 * Protocol Notification Functions
 *
 * Bilingual (Arabic/English) notifications for protocol-related events.
 * Uses sendWhatsAppMessage from the WhatsApp client.
 */

import { sendWhatsAppMessage, type WhatsAppResult } from '@/lib/whatsapp/client';

// ─── Critical Threshold Alert ───────────────────────────────────────────────

interface CriticalAlertData {
  patientName: string;
  alertMessage: string;
  value: string;
  unit: string;
}

/**
 * Send an immediate critical threshold alert via WhatsApp.
 * Called when a vital or lab value exceeds a dangerous threshold.
 */
export async function sendCriticalThresholdAlert(
  phone: string,
  lang: string,
  data: CriticalAlertData
): Promise<WhatsAppResult> {
  const message = lang === 'en'
    ? [
        `IMPORTANT Health Alert`,
        ``,
        `Dear ${data.patientName},`,
        `${data.alertMessage}`,
        data.value ? `Current reading: ${data.value} ${data.unit}` : '',
        ``,
        `Please consult your doctor as soon as possible.`,
        `If you feel unwell, call emergency services at 123.`,
        ``,
        `Triajji Healthcare`,
      ].filter(Boolean).join('\n')
    : [
        `تنبيه صحي مهم`,
        ``,
        `${data.patientName}،`,
        `${data.alertMessage}`,
        data.value ? `القراءة الحالية: ${data.value} ${data.unit}` : '',
        ``,
        `من فضلك تواصل مع طبيبك في أقرب وقت.`,
        `لو حاسس بأي أعراض خطيرة، اتصل بالطوارئ على 123.`,
        ``,
        `ترياچي للرعاية الصحية`,
      ].filter(Boolean).join('\n');

  return sendWhatsAppMessage(phone, message);
}

// ─── Weekly Protocol Digest ─────────────────────────────────────────────────

interface DigestAlert {
  type: string;
  messageAr: string;
  messageEn: string;
}

/**
 * Send a weekly summary of protocol compliance alerts.
 * Called every Sunday by the protocol-check cron job.
 */
export async function sendWeeklyProtocolDigest(
  phone: string,
  lang: string,
  alerts: DigestAlert[]
): Promise<WhatsAppResult> {
  if (alerts.length === 0) {
    return { success: true };
  }

  const alertLines = alerts.map((a, i) => {
    const msg = lang === 'en' ? a.messageEn : a.messageAr;
    return `${i + 1}. ${msg}`;
  });

  const message = lang === 'en'
    ? [
        `Weekly Health Summary`,
        ``,
        `Here are your health reminders for this week:`,
        ``,
        ...alertLines,
        ``,
        `Staying on track with your health plan makes a big difference.`,
        `If you need help, contact your GP through Triajji.`,
        ``,
        `Triajji Healthcare`,
      ].join('\n')
    : [
        `ملخص صحي أسبوعي`,
        ``,
        `التذكيرات الصحية للأسبوع:`,
        ``,
        ...alertLines,
        ``,
        `الالتزام بخطتك الصحية بيفرق معاك كتير.`,
        `لو محتاج مساعدة، تواصل مع طبيبك من خلال ترياچي.`,
        ``,
        `ترياچي للرعاية الصحية`,
      ].join('\n');

  return sendWhatsAppMessage(phone, message);
}
