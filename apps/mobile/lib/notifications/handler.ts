/**
 * Push Notification Handler — processes incoming push notifications
 * and routes them to the correct screen via deep linking.
 *
 * Handles all notification types including GP video call notifications.
 * All GP video call notifications use the recipient's preferred_language
 * for bilingual title + body (set server-side).
 */

import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { Platform } from 'react-native';

// ─── Notification Data Types ────────────────────────────────────────────────

export type NotificationData =
  | { type: 'appointment_reminder'; bookingId?: string }
  | { type: 'telehealth_reminder'; link?: string }
  | { type: 'otp'; code?: string }
  | { type: 'lab_results_ready'; routingId?: string }
  | { type: 'prescription_ready'; routingId?: string }
  | { type: 'follow_up_reminder'; followUpId?: string; doctorId?: string }
  | { type: 'transfer_accepted'; transferId?: string }
  | { type: 'transfer_declined'; transferId?: string }
  | { type: 'referral_received'; referralId?: string }
  | { type: 'gp_request'; requestId?: string }
  | { type: 'protocol_alert'; conditionCode?: string }
  | { type: 'message_from_doctor'; doctorId?: string }
  // GP Video Call notifications (Batch 7)
  | { type: 'gp_video_call_incoming'; callId: string; callerName: string; callerRole: 'doctor' | 'patient' }
  | { type: 'gp_video_call_declined'; callId: string }
  | { type: 'gp_video_call_missed'; callId: string; callerName: string }
  | { type: 'gp_transcription_ready'; callId: string };

// ─── Configure notification handler ────────────────────────────────────────

/**
 * Set up the foreground notification handler.
 * GP video call notifications use high priority (time-sensitive).
 */
export function configureNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const data = notification.request.content.data as NotificationData | undefined;
      const type = data?.type ?? '';

      // High-priority GP video call types: always show alert + sound
      const isHighPriority =
        type === 'gp_video_call_incoming' ||
        type === 'gp_video_call_missed' ||
        type === 'gp_video_call_declined' ||
        type === 'gp_transcription_ready';

      return {
        shouldShowAlert: true,
        shouldPlaySound: isHighPriority || type.includes('transfer'),
        shouldSetBadge: true,
        priority: isHighPriority
          ? Notifications.AndroidNotificationPriority.HIGH
          : Notifications.AndroidNotificationPriority.DEFAULT,
      };
    },
  });
}

// ─── Android notification channels ─────────────────────────────────────────

/**
 * Register Android notification channels.
 * Includes high-priority channel for GP video calls.
 */
export async function registerNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;

  await Promise.all([
    Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
    }),
    Notifications.setNotificationChannelAsync('emergency', {
      name: 'Emergency',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
      vibrationPattern: [0, 500, 250, 500],
      bypassDnd: true,
    }),
    Notifications.setNotificationChannelAsync('video-call', {
      name: 'Video Calls',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
      vibrationPattern: [0, 500, 250, 500],
      bypassDnd: true,
    }),
  ]);
}

// ─── Handle notification response (user tapped) ───────────────────────────

/**
 * Handle when user taps on a notification.
 * Routes to the appropriate screen based on notification type.
 */
export function handleNotificationResponse(
  response: Notifications.NotificationResponse
): void {
  const data = response.notification.request.content.data as NotificationData | undefined;
  if (!data?.type) return;

  switch (data.type) {
    // ─── GP Video Call Types ──────────────────────────────────────────

    case 'gp_video_call_incoming':
      // Incoming call is handled by the _layout.tsx modal overlay (Batch 5).
      // The overlay listens to incoming notifications directly.
      // No additional navigation needed — the overlay auto-shows.
      break;

    case 'gp_video_call_declined':
      // Toast only, no navigation. The call screen already handles this state.
      break;

    case 'gp_video_call_missed':
      // Navigate to GP screen or patient panel
      if (data.callId) {
        router.push({
          pathname: '/(doctor)/patients/[patientId]' as never,
          params: { callId: data.callId },
        });
      }
      break;

    case 'gp_transcription_ready':
      // Navigate to post-call form
      if (data.callId) {
        router.push({
          pathname: '/(doctor)/video-call/post-call/[callId]' as never,
          params: { callId: data.callId },
        });
      }
      break;

    // ─── Existing Types ──────────────────────────────────────────────

    case 'appointment_reminder':
      router.push('/(patient)/appointments' as never);
      break;

    case 'lab_results_ready':
      if (data.routingId) {
        router.push({
          pathname: '/(patient)/lab-results/[id]' as never,
          params: { id: data.routingId },
        });
      }
      break;

    case 'prescription_ready':
      if (data.routingId) {
        router.push({
          pathname: '/(patient)/prescriptions/[id]' as never,
          params: { id: data.routingId },
        });
      }
      break;

    case 'follow_up_reminder':
      if (data.doctorId) {
        router.push({
          pathname: '/(patient)/gp/[doctorId]' as never,
          params: { doctorId: data.doctorId },
        });
      }
      break;

    case 'transfer_accepted':
    case 'transfer_declined':
      if (data.transferId) {
        router.push({
          pathname: '/(doctor)/transfers/[id]' as never,
          params: { id: data.transferId },
        });
      }
      break;

    case 'referral_received':
      if (data.referralId) {
        router.push({
          pathname: '/(doctor)/referrals/[id]' as never,
          params: { id: data.referralId },
        });
      }
      break;

    case 'gp_request':
      if (data.requestId) {
        router.push({
          pathname: '/(doctor)/gp-requests/[id]' as never,
          params: { id: data.requestId },
        });
      }
      break;

    case 'protocol_alert':
      if (data.conditionCode) {
        router.push({
          pathname: '/(doctor)/protocols/[code]' as never,
          params: { code: data.conditionCode },
        });
      }
      break;

    case 'message_from_doctor':
      if (data.doctorId) {
        router.push({
          pathname: '/(patient)/gp/[doctorId]' as never,
          params: { doctorId: data.doctorId },
        });
      }
      break;

    default:
      break;
  }
}

// ─── Set up listeners ──────────────────────────────────────────────────────

/**
 * Initialize all notification listeners.
 * Call once in the root _layout.tsx on app start.
 * Returns a cleanup function.
 */
export function setupNotificationListeners(): () => void {
  configureNotificationHandler();

  // Handle notifications received while app is foregrounded
  const foregroundSubscription = Notifications.addNotificationReceivedListener(
    (notification) => {
      const data = notification.request.content.data as NotificationData | undefined;

      // For incoming calls, we need to trigger the overlay immediately
      if (data?.type === 'gp_video_call_incoming') {
        // Emit a custom event that _layout.tsx listens for
        incomingCallEmitter.emit(data);
      }
    }
  );

  // Handle notification tap
  const responseSubscription = Notifications.addNotificationResponseReceivedListener(
    handleNotificationResponse
  );

  // Check if app was launched by a notification
  Notifications.getLastNotificationResponseAsync().then((response) => {
    if (response) {
      handleNotificationResponse(response);
    }
  });

  return () => {
    foregroundSubscription.remove();
    responseSubscription.remove();
  };
}

// ─── Simple event emitter for incoming calls ───────────────────────────────

type IncomingCallData = Extract<NotificationData, { type: 'gp_video_call_incoming' }>;
type IncomingCallListener = (data: IncomingCallData) => void;

class IncomingCallEmitter {
  private listeners: Set<IncomingCallListener> = new Set();

  subscribe(listener: IncomingCallListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(data: IncomingCallData): void {
    for (const listener of this.listeners) {
      try {
        listener(data);
      } catch {
        // Silent
      }
    }
  }
}

/** Global emitter for incoming call overlay. Subscribe in _layout.tsx. */
export const incomingCallEmitter = new IncomingCallEmitter();
