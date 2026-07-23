/**
 * Push Notifications — Expo Push Notification Service
 * Sends push notifications to mobile app users via Expo's push service.
 * Abstracts over APNs (iOS) and FCM (Android).
 *
 * IMPORTANT: This function is called IN ADDITION to WhatsApp, never instead of.
 * WhatsApp is always sent regardless of push token availability.
 */

import { Expo, type ExpoPushMessage, type ExpoPushTicket } from 'expo-server-sdk';

// ─── Client Singleton ───────────────────────────────────────────────────────

let expoClient: Expo | null = null;

function getExpo(): Expo {
  if (!expoClient) {
    const accessToken = process.env['EXPO_ACCESS_TOKEN'];
    expoClient = new Expo(accessToken ? { accessToken } : undefined);
  }
  return expoClient;
}

// ─── Send Push Notification ─────────────────────────────────────────────────

/**
 * Send a push notification via Expo.
 * CRITICAL: Only sends if expoPushToken is not null.
 * This is always called IN ADDITION to WhatsApp — never instead of.
 *
 * @param expoPushToken - Can be null! If null, silently returns without sending.
 * @param title - Notification title
 * @param body - Notification body
 * @param data - Extra data payload for deep linking
 */
export async function sendPushNotification(
  expoPushToken: string | null,
  title: string,
  body: string,
  data: Record<string, unknown> = {}
): Promise<boolean> {
  // CRITICAL: only send if token is not null
  if (!expoPushToken) return false;

  if (!Expo.isExpoPushToken(expoPushToken)) {
    console.error('[Push] Invalid Expo push token:', expoPushToken);
    return false;
  }

  const expo = getExpo();

  // Determine priority and channel based on notification type
  const notifType = data.type?.toString() ?? '';
  const isTransfer = notifType.includes('transfer');
  const priority = isTransfer ? 'high' as const : 'normal' as const;
  const channelId = isTransfer ? 'emergency' : 'default';

  const message: ExpoPushMessage = {
    to: expoPushToken,
    sound: 'default',
    title,
    body,
    data: { ...data },
    priority,
    channelId,
  };

  try {
    const tickets: ExpoPushTicket[] = await expo.sendPushNotificationsAsync([message]);
    const ticket = tickets[0];
    if (!ticket) return false;

    if (ticket.status === 'error') {
      console.error('[Push] Error sending notification:', ticket.message);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[Push] Failed to send notification:', err);
    return false;
  }
}

// ─── Notification Templates ─────────────────────────────────────────────────

export async function sendAppointmentReminder24h(
  token: string | null,
  doctorName: string,
  time: string,
  lang: 'ar' | 'en' = 'ar'
): Promise<boolean> {
  const title = lang === 'ar' ? 'تذكير بموعدك' : 'Appointment Reminder';
  const body = lang === 'ar'
    ? `موعدك غداً مع د. ${doctorName} الساعة ${time}`
    : `Your appointment tomorrow with Dr. ${doctorName} at ${time}`;

  return sendPushNotification(token, title, body, { type: 'appointment_reminder' });
}

export async function sendAppointmentReminder2h(
  token: string | null,
  lang: 'ar' | 'en' = 'ar'
): Promise<boolean> {
  const title = lang === 'ar' ? 'موعدك قريب' : 'Appointment Soon';
  const body = lang === 'ar' ? 'موعدك بعد ساعتين' : 'Your appointment is in 2 hours';

  return sendPushNotification(token, title, body, { type: 'appointment_reminder' });
}

export async function sendTelehealthReminder(
  token: string | null,
  link: string,
  lang: 'ar' | 'en' = 'ar'
): Promise<boolean> {
  const title = lang === 'ar' ? 'استشارتك الأونلاين' : 'Online Consultation';
  const body = lang === 'ar'
    ? `استشارتك الأونلاين بعد ساعة`
    : `Your online consultation in 1 hour`;

  return sendPushNotification(token, title, body, { type: 'telehealth_reminder', link });
}

export async function sendOtpPush(
  token: string | null,
  code: string,
  lang: 'ar' | 'en' = 'ar'
): Promise<boolean> {
  const title = lang === 'ar' ? 'رمز دكتور تريو' : 'DoctorTrio Code';
  const body = lang === 'ar'
    ? `رمز دكتور تريو: ${code}. صالح 10 دقائق.`
    : `DoctorTrio code: ${code}. Valid for 10 minutes.`;

  return sendPushNotification(token, title, body, { type: 'otp', code });
}

export async function sendAbnormalLabResult(
  token: string | null,
  lang: 'ar' | 'en' = 'ar'
): Promise<boolean> {
  const title = lang === 'ar' ? 'نتيجة تحليل' : 'Lab Result';
  const body = lang === 'ar'
    ? 'نتيجة تحليلك تحتاج انتباه'
    : 'Your lab result needs attention';

  return sendPushNotification(token, title, body, { type: 'lab_results_ready' });
}

export async function sendLabResultsReady(
  token: string | null,
  routingId: string,
  lang: 'ar' | 'en' = 'ar'
): Promise<boolean> {
  const title = lang === 'ar' ? 'نتائج تحاليلك جاهزة' : 'Your lab results are ready';
  const body = lang === 'ar'
    ? 'يمكنك الاطلاع على نتائج تحاليلك الآن'
    : 'You can view your lab results now';

  return sendPushNotification(token, title, body, { type: 'lab_results_ready', routingId });
}

export async function sendPrescriptionReady(
  token: string | null,
  routingId: string,
  lang: 'ar' | 'en' = 'ar'
): Promise<boolean> {
  const title = lang === 'ar' ? 'روشتتك جاهزة' : 'Your prescription is ready';
  const body = lang === 'ar'
    ? 'روشتتك جاهزة للاستلام من الصيدلية'
    : 'Your prescription is ready for pickup at the pharmacy';

  return sendPushNotification(token, title, body, { type: 'prescription_ready', routingId });
}

export async function sendFollowUpReminder(
  token: string | null,
  followUpId: string,
  doctorId: string,
  doctorName: string,
  lang: 'ar' | 'en' = 'ar'
): Promise<boolean> {
  const title = lang === 'ar' ? 'تذكير بموعد المتابعة' : 'Follow-up Reminder';
  const body = lang === 'ar'
    ? `عندك موعد متابعة مع د. ${doctorName}`
    : `You have a follow-up with Dr. ${doctorName}`;

  return sendPushNotification(token, title, body, {
    type: 'follow_up_reminder',
    followUpId,
    doctorId,
  });
}

export async function sendTransferUpdate(
  token: string | null,
  status: 'accepted' | 'declined',
  transferId: string,
  lang: 'ar' | 'en' = 'ar'
): Promise<boolean> {
  const accepted = status === 'accepted';
  const title = lang === 'ar'
    ? (accepted ? 'تم قبول طلب التحويل' : 'تم رفض طلب التحويل')
    : (accepted ? 'Transfer request accepted' : 'Transfer request declined');
  const body = lang === 'ar'
    ? (accepted ? 'تم قبول طلب تحويل المريض' : 'تم رفض طلب تحويل المريض')
    : (accepted ? 'Patient transfer request has been accepted' : 'Patient transfer request has been declined');

  return sendPushNotification(token, title, body, {
    type: accepted ? 'transfer_accepted' : 'transfer_declined',
    transferId,
  });
}

export async function sendReferralReceived(
  token: string | null,
  referralId: string,
  fromDoctorName: string,
  lang: 'ar' | 'en' = 'ar'
): Promise<boolean> {
  const title = lang === 'ar' ? 'إحالة جديدة' : 'New Referral';
  const body = lang === 'ar'
    ? `إحالة جديدة من د. ${fromDoctorName}`
    : `New referral from Dr. ${fromDoctorName}`;

  return sendPushNotification(token, title, body, {
    type: 'referral_received',
    referralId,
  });
}

export async function sendGpRequest(
  token: string | null,
  requestId: string,
  lang: 'ar' | 'en' = 'ar'
): Promise<boolean> {
  const title = lang === 'ar' ? 'طلب طبيب أساسي' : 'GP Request';
  const body = lang === 'ar'
    ? 'لديك طلب طبيب أساسي جديد'
    : 'You have a new GP request';

  return sendPushNotification(token, title, body, { type: 'gp_request', requestId });
}

export async function sendProtocolAlert(
  token: string | null,
  conditionCode: string,
  lang: 'ar' | 'en' = 'ar'
): Promise<boolean> {
  const title = lang === 'ar' ? 'تنبيه بروتوكول' : 'Protocol Alert';
  const body = lang === 'ar'
    ? 'لديك تنبيه بروتوكول صحي يحتاج انتباهك'
    : 'You have a health protocol alert that needs attention';

  return sendPushNotification(token, title, body, { type: 'protocol_alert', conditionCode });
}

export async function sendMessageFromDoctor(
  token: string | null,
  doctorId: string,
  doctorName: string,
  lang: 'ar' | 'en' = 'ar'
): Promise<boolean> {
  const title = lang === 'ar' ? 'رسالة من الدكتور' : 'Message from your doctor';
  const body = lang === 'ar'
    ? `رسالة جديدة من د. ${doctorName}`
    : `New message from Dr. ${doctorName}`;

  return sendPushNotification(token, title, body, { type: 'message_from_doctor', doctorId });
}
