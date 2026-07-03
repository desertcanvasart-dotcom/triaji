/**
 * Root Layout — initializes fonts, splash screen, push notifications.
 * Routes to auth, patient, or doctor stacks based on authentication state.
 * Optionally requires biometric authentication on app open.
 * Listens for 'gp_video_call_incoming' notifications to show IncomingCallScreen
 * as a full-screen modal overlay above all navigation.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import {
  useFonts,
  Cairo_400Regular,
  Cairo_600SemiBold,
  Cairo_700Bold,
} from '@expo-google-fonts/cairo';
import { registerForPushNotifications } from '@/lib/notifications';
import {
  isAuthenticated,
  isDoctorMode,
  isDoctorAuthenticated,
  isBiometricEnabled,
} from '@/lib/storage';
import { authenticateWithBiometrics } from '@/lib/auth/biometric';
import { getLang } from '@/lib/storage';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import IncomingCallScreen from '@/components/video-call/IncomingCallScreen';
import type { Lang } from '@triaji/shared/i18n';

const API_BASE_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'https://app.triajji.com';

SplashScreen.preventAutoHideAsync();

interface IncomingCallData {
  callId: string;
  callerName: string;
  callerRole: 'doctor' | 'patient';
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Cairo: Cairo_400Regular,
    'Cairo-SemiBold': Cairo_600SemiBold,
    'Cairo-Bold': Cairo_700Bold,
  });

  const [biometricPassed, setBiometricPassed] = useState(false);
  const [biometricChecking, setBiometricChecking] = useState(true);

  // Incoming call modal state
  const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null);
  const notificationListenerRef = useRef<Notifications.Subscription | null>(null);
  const responseListenerRef = useRef<Notifications.Subscription | null>(null);

  // Biometric gate on app open
  useEffect(() => {
    async function checkBiometric() {
      const hasAuth = isAuthenticated() || isDoctorAuthenticated();
      const biometricOn = isBiometricEnabled();

      if (hasAuth && biometricOn) {
        const lang = getLang();
        const success = await authenticateWithBiometrics(lang);
        setBiometricPassed(success);
      } else {
        setBiometricPassed(true);
      }
      setBiometricChecking(false);
    }

    if (fontsLoaded) {
      checkBiometric();
    }
  }, [fontsLoaded]);

  useEffect(() => {
    if (fontsLoaded && !biometricChecking) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, biometricChecking]);

  useEffect(() => {
    if (isAuthenticated()) {
      registerForPushNotifications();
    }
  }, []);

  // ─── Incoming Video Call Notification Listener ────────────────────────────

  useEffect(() => {
    // Foreground: when app is active and receives a notification
    notificationListenerRef.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        const data = notification.request.content.data;

        if (data?.type === 'gp_video_call_incoming') {
          setIncomingCall({
            callId: String(data.call_id ?? ''),
            callerName: String(data.caller_name ?? ''),
            callerRole: (data.caller_role as 'doctor' | 'patient') ?? 'doctor',
          });
        }
      }
    );

    // Background/killed: when user taps the notification
    responseListenerRef.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;

        if (data?.type === 'gp_video_call_incoming') {
          setIncomingCall({
            callId: String(data.call_id ?? ''),
            callerName: String(data.caller_name ?? ''),
            callerRole: (data.caller_role as 'doctor' | 'patient') ?? 'doctor',
          });
        }
      }
    );

    return () => {
      if (notificationListenerRef.current) {
        Notifications.removeNotificationSubscription(notificationListenerRef.current);
      }
      if (responseListenerRef.current) {
        Notifications.removeNotificationSubscription(responseListenerRef.current);
      }
    };
  }, []);

  // ─── Incoming Call Handlers ───────────────────────────────────────────────

  const handleAcceptCall = useCallback(() => {
    if (!incomingCall) return;

    const callId = incomingCall.callId;
    const doctorMode = isDoctorMode();

    setIncomingCall(null);

    // Navigate to the appropriate video call screen
    if (doctorMode) {
      router.push(`/(doctor)/video-call/${callId}`);
    } else {
      router.push(`/(patient)/video-call/${callId}`);
    }
  }, [incomingCall]);

  const handleDeclineCall = useCallback(async () => {
    if (!incomingCall) return;

    const callId = incomingCall.callId;
    setIncomingCall(null);

    // Update call status to declined
    try {
      const doctorMode = isDoctorMode();
      let token = '';

      if (doctorMode) {
        const { storage } = await import('@/lib/storage');
        token = storage.getString('doctor-token') ?? '';
      } else {
        const { getPatientToken } = await import('@/lib/storage');
        token = getPatientToken() ?? '';
      }

      await fetch(`${API_BASE_URL}/api/telehealth/gp-call/${callId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: 'declined' }),
      });
    } catch {
      // Silent — best effort
    }
  }, [incomingCall]);

  // ─── Render ───────────────────────────────────────────────────────────────

  if (!fontsLoaded || biometricChecking) {
    return null;
  }

  // If biometric failed, show a locked screen (splash stays hidden but we block)
  if (!biometricPassed) {
    return (
      <View style={lockStyles.container}>
        <ActivityIndicator size="large" color="#0D7A7A" />
      </View>
    );
  }

  const currentLang: Lang = getLang() ?? 'ar';

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#FFFFFF' },
        }}
      >
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(patient)" />
        <Stack.Screen name="(doctor)" />
        <Stack.Screen
          name="booking"
          options={{ presentation: 'modal' }}
        />
        <Stack.Screen
          name="telehealth"
          options={{ presentation: 'fullScreenModal' }}
        />
      </Stack>

      {/* Incoming Call Modal Overlay — above all navigation */}
      {incomingCall && (
        <IncomingCallScreen
          callId={incomingCall.callId}
          callerName={incomingCall.callerName}
          callerRole={incomingCall.callerRole}
          lang={currentLang}
          onAccept={handleAcceptCall}
          onDecline={handleDeclineCall}
        />
      )}
    </>
  );
}

const lockStyles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
});
