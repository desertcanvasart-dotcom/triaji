/**
 * Confirmations sent to a doctor when their verification is decided.
 *
 * The pending screen promises "we'll message you when it's confirmed", but
 * approval/rejection used to change the database silently. These send that
 * message over every channel we have — email (Resend), WhatsApp and SMS.
 * Best-effort by design: a messaging failure must never roll back the
 * verification decision, so callers ignore the result. Each channel degrades to
 * a console log in dev (no keys).
 */

import { sendWhatsAppMessage } from '@triaji/shared/lib/whatsapp/client';
import { sendSMS } from '@triaji/shared/lib/sms/client';
import { sendEmail } from '@triaji/shared/lib/email/client';

const LOGIN_URL = 'https://app.doctortrio.online/ar/doctor/login';

/** Minimal RTL Arabic email shell. */
function emailShell(bodyHtml: string): string {
  return `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1A2F4A;line-height:1.7">
  <h2 style="color:#0d9488;margin:0 0 16px">دكتور تريو</h2>
  ${bodyHtml}
  <p style="margin-top:24px;font-size:12px;color:#94a3b8">دي رسالة تلقائية من منصة دكتور تريو.</p>
</div>`;
}

function button(label: string): string {
  return `<a href="${LOGIN_URL}" style="display:inline-block;background:#0d9488;color:#fff;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:12px;margin:8px 0">${label}</a>`;
}

async function fanOut(
  phone: string | null | undefined,
  email: string | null | undefined,
  smsText: string,
  emailSubject: string,
  emailHtml: string,
): Promise<void> {
  const tasks: Promise<unknown>[] = [];
  if (phone) {
    tasks.push(sendWhatsAppMessage(phone, smsText), sendSMS(phone, smsText));
  }
  if (email) {
    tasks.push(sendEmail({ to: email, subject: emailSubject, html: emailShell(emailHtml) }));
  }
  await Promise.allSettled(tasks);
}

/** Tell a doctor their account was verified and they can now sign in. */
export async function notifyDoctorApproved(
  phone: string | null | undefined,
  email: string | null | undefined,
  nameAr: string | null | undefined,
): Promise<void> {
  const greeting = nameAr ? `د. ${nameAr}` : 'دكتور';
  const smsText =
    `${greeting}، تم توثيق حسابك في دكتور تريو ✅\n` +
    `تقدر تسجّل دخولك دلوقتي وتبدأ تستقبل الحالات: ${LOGIN_URL}`;
  const emailHtml =
    `<p>${greeting}، تم توثيق حسابك في دكتور تريو بنجاح ✅</p>` +
    `<p>تقدر تسجّل دخولك دلوقتي وتبدأ تستقبل الحالات.</p>` +
    `<p>${button('تسجيل الدخول')}</p>`;
  await fanOut(phone, email, smsText, 'تم توثيق حسابك في دكتور تريو', emailHtml);
}

/** Tell a doctor their registration was rejected, with the reason. */
export async function notifyDoctorRejected(
  phone: string | null | undefined,
  email: string | null | undefined,
  reason: string,
): Promise<void> {
  const smsText =
    `للأسف مقدرناش نوثّق حسابك في دكتور تريو حاليًا.\n` +
    `السبب: ${reason}\n` +
    `تقدر تعدّل مستنداتك وتحاول تاني: ${LOGIN_URL}`;
  const emailHtml =
    `<p>للأسف مقدرناش نوثّق حسابك في دكتور تريو حاليًا.</p>` +
    `<p style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:12px"><strong>السبب:</strong> ${reason}</p>` +
    `<p>تقدر تعدّل مستنداتك وتحاول تاني.</p>` +
    `<p>${button('تعديل المستندات')}</p>`;
  await fanOut(phone, email, smsText, 'مراجعة حسابك في دكتور تريو', emailHtml);
}
