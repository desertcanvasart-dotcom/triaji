import { sendWhatsAppMessage } from '@triaji/shared/lib/whatsapp/client';

/**
 * Notify the patient that they have been registered in the queue.
 * Arabic message: "You are #X, estimated wait Y minutes"
 */
export async function sendQueueRegisteredNotification(
  phone: string,
  queueNumber: number,
  estimatedWaitMinutes: number
) {
  const message =
    `مرحباً، تم تسجيلك في قائمة الانتظار ✅\n\n` +
    `رقمك في الطابور: #${queueNumber}\n` +
    `الوقت المتوقع للانتظار: ${estimatedWaitMinutes} دقيقة\n\n` +
    `سنرسل لك إشعار عندما يقترب دورك.\n` +
    `دكتور تريو 🏥`;

  return sendWhatsAppMessage(phone, message);
}

/**
 * Notify the patient that they are almost next in the queue.
 * Arabic message: "You are almost next"
 */
export async function sendAlmostNextNotification(phone: string) {
  const message =
    `تنبيه — دورك قريب جداً! ⏰\n\n` +
    `يرجى التوجه إلى منطقة الانتظار والاستعداد.\n\n` +
    `دكتور تريو 🏥`;

  return sendWhatsAppMessage(phone, message);
}

/**
 * Notify the patient that they have been called to proceed.
 * Arabic message: "Please proceed to room X"
 */
export async function sendCalledNotification(
  phone: string,
  roomName: string
) {
  const message =
    `دورك الآن! 🔔\n\n` +
    `يرجى التوجه إلى: ${roomName}\n\n` +
    `دكتور تريو 🏥`;

  return sendWhatsAppMessage(phone, message);
}
