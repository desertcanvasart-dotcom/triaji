/**
 * Payment notification functions (bilingual AR/EN).
 * Sends WhatsApp messages for receipts, expiry alerts, and reminders.
 */

import { sendWhatsAppMessage, type WhatsAppResult } from '@/lib/whatsapp/client';
import type { Lang } from '@triaji/shared/i18n/strings';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ReceiptData {
  description: string;
  amount: number;
  method: string;
  reference: string;
  date: Date;
}

interface ExpiredData {
  description: string;
  amount: number;
  bookingLink?: string;
}

interface ReminderData {
  providerName: string;
  invoiceNumber: string;
  amount: number;
  paymentLink: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(date: Date, lang: Lang): string {
  return date.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-EG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatAmount(amount: number, lang: Lang): string {
  if (lang === 'ar') {
    return `${amount.toFixed(2)} جنيه`;
  }
  return `EGP ${amount.toFixed(2)}`;
}

// ─── Receipt ───────────────────────────────────────────────────────────────────

export async function sendPaymentReceipt(
  phone: string,
  lang: Lang,
  data: ReceiptData,
): Promise<WhatsAppResult> {
  const dateStr = formatDate(data.date, lang);
  const amountStr = formatAmount(data.amount, lang);

  const message =
    lang === 'ar'
      ? `تم الدفع بنجاح ✅

${data.description}
💰 المبلغ: ${amountStr}
💳 طريقة الدفع: ${data.method}
🔖 رقم المرجع: ${data.reference}
📅 التاريخ: ${dateStr}

شكراً لك — دكتور تريو 🏥`
      : `Payment successful ✅

${data.description}
💰 Amount: ${amountStr}
💳 Method: ${data.method}
🔖 Reference: ${data.reference}
📅 Date: ${dateStr}

Thank you — DoctorTrio 🏥`;

  return sendWhatsAppMessage(phone, message);
}

// ─── Payment Expired ───────────────────────────────────────────────────────────

export async function sendPaymentExpiredNotification(
  phone: string,
  lang: Lang,
  data: ExpiredData,
): Promise<WhatsAppResult> {
  const amountStr = formatAmount(data.amount, lang);

  let message: string;

  if (lang === 'ar') {
    message = `انتهت مدة الدفع ⏰

${data.description}
💰 المبلغ: ${amountStr}

تم إلغاء حجزك لانتهاء مدة الدفع. تم تحرير الموعد ويمكن لمريض آخر حجزه.`;

    if (data.bookingLink) {
      message += `\n\n🔄 يمكنك الحجز مرة أخرى من هنا:\n${data.bookingLink}`;
    }

    message += '\n\nدكتور تريو 🏥';
  } else {
    message = `Payment expired ⏰

${data.description}
💰 Amount: ${amountStr}

Your booking was cancelled due to payment expiry. The slot has been released and is available for other patients.`;

    if (data.bookingLink) {
      message += `\n\n🔄 You can book again here:\n${data.bookingLink}`;
    }

    message += '\n\nDoctorTrio 🏥';
  }

  return sendWhatsAppMessage(phone, message);
}

// ─── Payment Reminder ──────────────────────────────────────────────────────────

export async function sendPaymentReminder(
  phone: string,
  lang: Lang,
  data: ReminderData,
): Promise<WhatsAppResult> {
  const amountStr = formatAmount(data.amount, lang);

  const message =
    lang === 'ar'
      ? `تذكير بفاتورة غير مسددة 🔔

🏥 ${data.providerName}
📄 رقم الفاتورة: ${data.invoiceNumber}
💰 المبلغ: ${amountStr}

💳 ادفع دلوقتي:
${data.paymentLink}

دكتور تريو 🏥`
      : `Payment reminder 🔔

🏥 ${data.providerName}
📄 Invoice: ${data.invoiceNumber}
💰 Amount: ${amountStr}

💳 Pay now:
${data.paymentLink}

DoctorTrio 🏥`;

  return sendWhatsAppMessage(phone, message);
}
