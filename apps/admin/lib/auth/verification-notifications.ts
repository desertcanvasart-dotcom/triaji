/**
 * Confirmations sent to a doctor when their verification is decided.
 *
 * The pending screen promises "we'll message you when it's confirmed", but
 * approval/rejection used to change the database silently. These send that
 * message. Best-effort by design: a messaging failure must never roll back the
 * verification decision, so callers ignore the result. Both channels degrade to
 * a console log in dev (no gateway keys).
 */

import { sendWhatsAppMessage } from '@triaji/shared/lib/whatsapp/client';
import { sendSMS } from '@triaji/shared/lib/sms/client';

const LOGIN_URL = 'https://app.doctortrio.online/ar/doctor/login';

async function notify(phone: string | null | undefined, message: string): Promise<void> {
  if (!phone) return;
  // WhatsApp first (matches the rest of the admin notifications), SMS alongside
  // so the doctor still hears even without WhatsApp. Neither may throw.
  await Promise.allSettled([
    sendWhatsAppMessage(phone, message),
    sendSMS(phone, message),
  ]);
}

/** Tell a doctor their account was verified and they can now sign in. */
export async function notifyDoctorApproved(
  phone: string | null | undefined,
  nameAr: string | null | undefined,
): Promise<void> {
  const greeting = nameAr ? `د. ${nameAr}` : 'دكتور';
  await notify(
    phone,
    `${greeting}، تم توثيق حسابك في دكتور تريو ✅\n` +
      `تقدر تسجّل دخولك دلوقتي وتبدأ تستقبل الحالات: ${LOGIN_URL}`,
  );
}

/** Tell a doctor their registration was rejected, with the reason. */
export async function notifyDoctorRejected(
  phone: string | null | undefined,
  reason: string,
): Promise<void> {
  await notify(
    phone,
    `للأسف مقدرناش نوثّق حسابك في دكتور تريو حاليًا.\n` +
      `السبب: ${reason}\n` +
      `تقدر تعدّل مستنداتك وتحاول تاني: ${LOGIN_URL}`,
  );
}
