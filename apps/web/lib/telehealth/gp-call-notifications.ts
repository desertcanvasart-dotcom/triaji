/**
 * GP Video Call Push Notifications — server-side helpers.
 * Sends high-priority push notifications for video call events.
 * All notifications use the recipient's preferred_language for bilingual title + body.
 *
 * Uses expo-server-sdk consistent with apps/web/lib/notifications/push.ts pattern.
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

// ─── Types ──────────────────────────────────────────────────────────────────

type Lang = 'ar' | 'en';

interface IncomingCallData {
  callId: string;
  callerName: string;
  callerRole: 'doctor' | 'patient';
}

interface DeclinedCallData {
  callId: string;
}

interface MissedCallData {
  callId: string;
  callerName: string;
}

interface TranscriptionReadyData {
  callId: string;
}

// ─── Internal high-priority send helper ──────────────────────────────────

/**
 * Send a high-priority push notification for video call events.
 * - Android: priority='high', channelId='video-call'
 * - iOS: sound='default', _contentAvailable=true for wake
 */
async function sendHighPriorityPush(
  recipientPushToken: string | null,
  title: string,
  body: string,
  data: Record<string, unknown>
): Promise<boolean> {
  if (!recipientPushToken) return false;

  if (!Expo.isExpoPushToken(recipientPushToken)) {
    console.error('[GP-Push] Invalid Expo push token:', recipientPushToken);
    return false;
  }

  const expo = getExpo();

  const message: ExpoPushMessage = {
    to: recipientPushToken,
    sound: 'default',
    title,
    body,
    data: { ...data },
    priority: 'high',
    channelId: 'video-call',
    // iOS-specific: time-sensitive delivery
    _contentAvailable: true,
  };

  try {
    const tickets: ExpoPushTicket[] = await expo.sendPushNotificationsAsync([message]);
    const ticket = tickets[0];
    if (!ticket) return false;

    if (ticket.status === 'error') {
      console.error('[GP-Push] Error sending notification:', ticket.message);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[GP-Push] Failed to send notification:', err);
    return false;
  }
}

// ─── Notification Senders ─────────────────────────────────────────────────

/**
 * Send incoming video call notification.
 * High priority — wakes device, plays sound.
 * Title/body in recipient's preferred language.
 */
export async function sendIncomingCallNotification(
  recipientPushToken: string | null,
  lang: Lang,
  data: IncomingCallData
): Promise<boolean> {
  const title = lang === 'ar' ? 'مكالمة فيديو واردة' : 'Incoming video call';
  const body = data.callerName;

  return sendHighPriorityPush(recipientPushToken, title, body, {
    type: 'gp_video_call_incoming',
    callId: data.callId,
    callerName: data.callerName,
    callerRole: data.callerRole,
  });
}

/**
 * Send call declined notification.
 * High priority for immediate delivery.
 * Title/body in recipient's preferred language.
 */
export async function sendCallDeclinedNotification(
  recipientPushToken: string | null,
  lang: Lang,
  data: DeclinedCallData
): Promise<boolean> {
  const title = lang === 'ar' ? 'رفض الاتصال' : 'Call declined';
  const body = ''; // No body needed — toast only on client

  return sendHighPriorityPush(recipientPushToken, title, body, {
    type: 'gp_video_call_declined',
    callId: data.callId,
  });
}

/**
 * Send missed call notification.
 * High priority for immediate delivery.
 * Title/body in recipient's preferred language.
 */
export async function sendCallMissedNotification(
  recipientPushToken: string | null,
  lang: Lang,
  data: MissedCallData
): Promise<boolean> {
  const title = lang === 'ar' ? 'مكالمة فائتة' : 'Missed call';
  const body = lang === 'ar'
    ? `من ${data.callerName}`
    : `from ${data.callerName}`;

  return sendHighPriorityPush(recipientPushToken, title, body, {
    type: 'gp_video_call_missed',
    callId: data.callId,
    callerName: data.callerName,
  });
}

/**
 * Send transcription ready notification.
 * High priority for immediate delivery.
 * Title/body in recipient's preferred language.
 */
export async function sendTranscriptionReadyNotification(
  recipientPushToken: string | null,
  lang: Lang,
  data: TranscriptionReadyData
): Promise<boolean> {
  const title = lang === 'ar' ? 'تفريغ المكالمة جاهز' : 'Transcription ready';
  const body = lang === 'ar' ? 'عرض الملاحظات' : 'View notes';

  return sendHighPriorityPush(recipientPushToken, title, body, {
    type: 'gp_transcription_ready',
    callId: data.callId,
  });
}
