/**
 * Push Notification Registration + Deep Link Handler.
 * Registers Expo push token with server, sets up Android channels,
 * and handles notification response routing.
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { api } from './api';

// ─── Notification Types ────────────────────────────────────────────────────

type TriajjiNotification =
  | { type: 'lab_results_ready'; routingId: string }
  | { type: 'prescription_ready'; routingId: string }
  | { type: 'follow_up_reminder'; followUpId: string; doctorId: string }
  | { type: 'transfer_accepted'; transferId: string }
  | { type: 'transfer_declined'; transferId: string }
  | { type: 'gp_request'; requestId: string }
  | { type: 'referral_received'; referralId: string }
  | { type: 'protocol_alert'; conditionCode: string }
  | { type: 'appointment_reminder'; bookingId: string }
  | { type: 'message_from_doctor'; doctorId: string };

// ─── Notification Handler ──────────────────────────────────────────────────

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ─── Deep Link Routing ─────────────────────────────────────────────────────

function getDeepLinkPath(data: TriajjiNotification): string | null {
  switch (data.type) {
    case 'lab_results_ready':
      return `/(patient)/labs/results/${data.routingId}`;

    case 'prescription_ready':
      return `/(patient)/pharmacy/prescription/${data.routingId}`;

    case 'follow_up_reminder':
      return `/(patient)/chat?doctorId=${data.doctorId}&followUpId=${data.followUpId}`;

    case 'transfer_accepted':
    case 'transfer_declined':
      return '/(doctor)/icu';

    case 'gp_request':
      return '/(patient)/gp';

    case 'referral_received':
      return '/(doctor)/referrals';

    case 'protocol_alert':
      return '/(patient)/index';

    case 'appointment_reminder':
      return '/(patient)/index';

    case 'message_from_doctor':
      return `/(patient)/chat?doctorId=${data.doctorId}`;

    default:
      return null;
  }
}

/**
 * Handle a notification response (tap) by navigating to the appropriate screen.
 */
function handleNotificationResponse(response: Notifications.NotificationResponse): void {
  const data = response.notification.request.content.data as TriajjiNotification | undefined;
  if (!data?.type) return;

  const path = getDeepLinkPath(data);
  if (path) {
    // Use setTimeout to ensure the app is fully mounted before navigating
    setTimeout(() => {
      router.push(path as never);
    }, 500);
  }
}

// ─── Android Notification Channels ─────────────────────────────────────────

async function setupAndroidChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;

  // Default channel: normal importance
  await Notifications.setNotificationChannelAsync('default', {
    name: 'default',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#0D7A7A',
  });

  // Emergency channel: high importance (for ICU transfers)
  await Notifications.setNotificationChannelAsync('emergency', {
    name: 'Emergency',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 500, 200, 500],
    lightColor: '#DC2626',
    sound: 'default',
    bypassDnd: true,
  });

  // Video-call channel: time-sensitive (incoming GP video calls). Previously
  // only declared in a dead module, so it was never actually registered.
  await Notifications.setNotificationChannelAsync('video-call', {
    name: 'Video Calls',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 500, 500, 500],
    lightColor: '#0D7A7A',
    sound: 'default',
    bypassDnd: true,
  });
}

// ─── Registration ──────────────────────────────────────────────────────────

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log('[Push] Push notifications require a physical device');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('[Push] Push notification permission not granted');
    return null;
  }

  // Set up Android channels
  await setupAndroidChannels();

  const tokenData = await Notifications.getExpoPushTokenAsync();
  const token = tokenData.data;

  // Register with server
  try {
    await api.registerPushToken(token);
  } catch (err) {
    console.error('[Push] Failed to register token with server:', err);
  }

  return token;
}

// ─── Listeners Setup ───────────────────────────────────────────────────────

/**
 * Set up notification listeners. Call once in the app root.
 * Returns a cleanup function to remove listeners.
 */
export function setupNotificationListeners(): () => void {
  // Handle notification taps when app is running
  const responseSubscription = Notifications.addNotificationResponseReceivedListener(
    handleNotificationResponse
  );

  // Handle last notification response (app opened from killed state via notification)
  Notifications.getLastNotificationResponseAsync().then((response) => {
    if (response) {
      handleNotificationResponse(response);
    }
  });

  return () => {
    responseSubscription.remove();
  };
}
