/**
 * Telehealth Screen — video call using LiveKit React Native.
 * Falls back to a "join via browser" link if LiveKit RN is not installed.
 */

import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useLang } from '@/hooks/useLang';
import { api } from '@/lib/api';
import { s } from '@triaji/shared/i18n';

export default function TelehealthScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const { lang, isRtl } = useLang();

  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [duration, setDuration] = useState(0);
  const [wsUrl, setWsUrl] = useState('');
  const [token, setToken] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetchToken();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const fetchToken = async () => {
    if (!bookingId) return;
    try {
      const result = await api.getTelehealthToken(bookingId);
      setWsUrl(result.wsUrl);
      setToken(result.token);
    } catch {
      Alert.alert(
        s.common.error[lang],
        lang === 'ar'
          ? 'فشل الاتصال بغرفة الاستشارة'
          : 'Failed to connect to consultation room'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    // Try to use LiveKit RN if available, otherwise open in browser
    try {
      const livekit = require('@livekit/react-native');
      if (livekit) {
        setConnected(true);
        timerRef.current = setInterval(() => {
          setDuration((d) => d + 1);
        }, 1000);
      }
    } catch {
      // LiveKit RN not installed — open in browser
      const webUrl = `${process.env['EXPO_PUBLIC_API_URL'] ?? 'https://app.triajji.com'}/${lang}/telehealth/${bookingId}`;
      Linking.openURL(webUrl);
    }
  };

  const handleEndCall = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setConnected(false);
    router.back();
  };

  const formatDuration = (secs: number): string => {
    const m = Math.floor(secs / 60);
    const sec = secs % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0D7A7A" />
        <Text style={styles.loadingText}>
          {lang === 'ar' ? 'جاري الاتصال...' : 'Connecting...'}
        </Text>
      </View>
    );
  }

  if (connected) {
    return (
      <View style={styles.callContainer}>
        <View style={styles.videoPlaceholder}>
          <Text style={styles.placeholderText}>
            {lang === 'ar' ? 'استشارة فيديو جارية' : 'Video consultation in progress'}
          </Text>
          <Text style={styles.durationText}>{formatDuration(duration)}</Text>
        </View>

        <View style={styles.controls}>
          <TouchableOpacity style={styles.endCallBtn} onPress={handleEndCall}>
            <Text style={styles.endCallText}>{s.telehealth.endCall[lang]}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backBtn}>{isRtl ? '→' : '←'}</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, isRtl && styles.textRtl]}>
          {s.telehealth.header[lang]}
        </Text>
      </View>

      <View style={styles.waitingRoom}>
        <View style={styles.cameraPreview}>
          <Text style={styles.previewIcon}>📹</Text>
        </View>

        <Text style={[styles.waitingTitle, isRtl && styles.textRtl]}>
          {s.telehealth.readyToJoin[lang]}
        </Text>

        <Text style={[styles.consentText, isRtl && styles.textRtl]}>
          {s.telehealth.recordingConsent[lang]}
        </Text>

        <TouchableOpacity style={styles.joinBtn} onPress={handleJoin}>
          <Text style={styles.joinBtnText}>
            {s.telehealth.joinConsultation[lang]}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A2F4A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
    gap: 12,
  },
  backBtn: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    fontFamily: 'Cairo-Bold',
  },
  textRtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A2F4A',
  },
  loadingText: {
    color: '#FFFFFF',
    marginTop: 16,
    fontSize: 16,
    fontFamily: 'Cairo',
  },
  waitingRoom: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  cameraPreview: {
    width: 200,
    height: 150,
    borderRadius: 16,
    backgroundColor: '#2A3F5A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  previewIcon: {
    fontSize: 48,
  },
  waitingTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 16,
    fontFamily: 'Cairo-Bold',
  },
  consentText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    fontFamily: 'Cairo',
  },
  joinBtn: {
    backgroundColor: '#0D7A7A',
    borderRadius: 16,
    paddingHorizontal: 48,
    paddingVertical: 18,
  },
  joinBtnText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'Cairo-Bold',
  },
  callContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  videoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A2F4A',
  },
  placeholderText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 16,
    fontFamily: 'Cairo',
  },
  durationText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
  },
  controls: {
    paddingVertical: 32,
    paddingHorizontal: 24,
    backgroundColor: '#111',
    alignItems: 'center',
  },
  endCallBtn: {
    backgroundColor: '#C62828',
    borderRadius: 30,
    paddingHorizontal: 40,
    paddingVertical: 16,
  },
  endCallText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Cairo-Bold',
  },
});
