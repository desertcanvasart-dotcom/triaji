/**
 * Patient Video Call Screen — loads call data, generates token, joins room.
 * 60-second timeout if status stays 'ringing': marks call as missed,
 * shows t('videoCall.noAnswer'), navigates back after 2 seconds.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { useLang } from '@/hooks/useLang';
import { s } from '@triaji/shared/i18n';
import VideoCallScreen from '@/components/video-call/VideoCallScreen';

const API_BASE_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'https://app.triajji.com';
const RINGING_TIMEOUT_MS = 60000;

interface CallData {
  id: string;
  status: 'ringing' | 'in_progress' | 'completed' | 'missed' | 'declined';
  livekit_token: string;
  livekit_url: string;
  doctor_name_ar: string;
  doctor_name_en?: string;
}

export default function PatientVideoCallScreen() {
  const { callId } = useLocalSearchParams<{ callId: string }>();
  const { lang, isRtl } = useLang();

  const [callData, setCallData] = useState<CallData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [noAnswer, setNoAnswer] = useState(false);

  const ringingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  // ─── Fetch call data and generate token ─────────────────────────────────

  const fetchCallData = useCallback(async () => {
    try {
      const { getPatientToken } = await import('@/lib/storage');
      const token = getPatientToken();

      const res = await fetch(
        `${API_BASE_URL}/api/telehealth/gp-call/${callId}?join=patient`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!mountedRef.current) return;

      if (res.ok) {
        const data: CallData = await res.json();
        setCallData(data);

        // If status is ringing, start 60-second timeout
        if (data.status === 'ringing') {
          startRingingTimeout();
          startStatusPolling();
        }
      } else {
        setError(s.common.error[lang]);
      }
    } catch {
      if (mountedRef.current) {
        setError(s.common.error[lang]);
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [callId, lang]);

  // ─── 60-second ringing timeout ──────────────────────────────────────────

  const startRingingTimeout = () => {
    if (ringingTimeoutRef.current) clearTimeout(ringingTimeoutRef.current);

    ringingTimeoutRef.current = setTimeout(async () => {
      if (!mountedRef.current) return;

      // Mark as missed
      try {
        const { getPatientToken } = await import('@/lib/storage');
        const token = getPatientToken();

        await fetch(`${API_BASE_URL}/api/telehealth/gp-call/${callId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status: 'missed' }),
        });
      } catch {
        // Silent
      }

      if (!mountedRef.current) return;
      setNoAnswer(true);

      // Navigate back after 2 seconds
      setTimeout(() => {
        if (mountedRef.current) {
          router.back();
        }
      }, 2000);
    }, RINGING_TIMEOUT_MS);
  };

  // ─── Poll call status to detect when doctor answers ─────────────────────

  const startStatusPolling = () => {
    if (statusPollRef.current) clearInterval(statusPollRef.current);

    statusPollRef.current = setInterval(async () => {
      try {
        const { getPatientToken } = await import('@/lib/storage');
        const token = getPatientToken();

        const res = await fetch(
          `${API_BASE_URL}/api/telehealth/gp-call/${callId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (res.ok) {
          const data = await res.json();
          if (data.status === 'in_progress' && mountedRef.current) {
            // Doctor answered — stop timeout and polling
            if (ringingTimeoutRef.current) clearTimeout(ringingTimeoutRef.current);
            if (statusPollRef.current) clearInterval(statusPollRef.current);
            setCallData((prev) => prev ? { ...prev, status: 'in_progress' } : prev);
          } else if (
            (data.status === 'declined' || data.status === 'missed') &&
            mountedRef.current
          ) {
            if (ringingTimeoutRef.current) clearTimeout(ringingTimeoutRef.current);
            if (statusPollRef.current) clearInterval(statusPollRef.current);
            setNoAnswer(true);
            setTimeout(() => {
              if (mountedRef.current) router.back();
            }, 2000);
          }
        }
      } catch {
        // Silent
      }
    }, 3000);
  };

  // ─── Lifecycle ──────────────────────────────────────────────────────────

  useEffect(() => {
    mountedRef.current = true;
    fetchCallData();

    return () => {
      mountedRef.current = false;
      if (ringingTimeoutRef.current) clearTimeout(ringingTimeoutRef.current);
      if (statusPollRef.current) clearInterval(statusPollRef.current);
    };
  }, [fetchCallData]);

  // ─── Call End ───────────────────────────────────────────────────────────

  const handleCallEnd = useCallback(() => {
    if (ringingTimeoutRef.current) clearTimeout(ringingTimeoutRef.current);
    if (statusPollRef.current) clearInterval(statusPollRef.current);
    router.back();
  }, []);

  // ─── Render ─────────────────────────────────────────────────────────────

  if (noAnswer) {
    return (
      <View style={styles.centerContainer}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={styles.noAnswerIcon}>📵</Text>
        <Text style={[styles.noAnswerText, isRtl && styles.textRtl]}>
          {s.videoCall.noAnswer[lang]}
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color="#0D7A7A" />
        <Text style={[styles.loadingText, isRtl && styles.textRtl]}>
          {s.videoCall.calling[lang]}
        </Text>
      </View>
    );
  }

  if (error || !callData) {
    return (
      <View style={styles.centerContainer}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={[styles.errorText, isRtl && styles.textRtl]}>
          {error ?? s.common.error[lang]}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <VideoCallScreen
        callId={callData.id}
        role="patient"
        lang={lang}
        token={callData.livekit_token}
        serverUrl={callData.livekit_url}
        onCallEnd={handleCallEnd}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#1A2F4A',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontFamily: 'Cairo',
  },
  textRtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  errorText: {
    fontSize: 16,
    color: '#EF4444',
    fontFamily: 'Cairo',
  },
  noAnswerIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  noAnswerText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'Cairo-SemiBold',
  },
});
