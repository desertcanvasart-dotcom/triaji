/**
 * IncomingCallScreen — full-screen modal overlay for incoming video calls.
 * Triggered from _layout.tsx notification handler. Works when app is backgrounded.
 * Handles both patient and doctor receiving calls.
 * Shows caller info with accept (green) and decline (red) buttons.
 */

import { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import type { Lang } from '@triaji/shared/i18n';
import { s } from '@triaji/shared/i18n';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface IncomingCallScreenProps {
  callId: string;
  callerName: string;
  callerRole: 'doctor' | 'patient';
  lang: Lang;
  onAccept: () => void;
  onDecline: () => void;
}

export default function IncomingCallScreen({
  callId,
  callerName,
  callerRole,
  lang,
  onAccept,
  onDecline,
}: IncomingCallScreenProps) {
  const isRtl = lang === 'ar';
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Fade in on mount
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  // Pulsing animation for the avatar ring
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  const roleLabel =
    callerRole === 'doctor'
      ? s.videoCall.yourGP[lang]
      : callerRole === 'patient'
        ? '' // No subtitle needed for patients calling
        : '';

  return (
    <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
      <View style={styles.container}>
        {/* Top section — caller info */}
        <View style={styles.callerSection}>
          <Text style={[styles.incomingLabel, isRtl && styles.textRtl]}>
            {s.videoCall.incomingCall[lang]}
          </Text>

          {/* Avatar with pulse ring */}
          <View style={styles.avatarWrapper}>
            <Animated.View
              style={[
                styles.pulseRing,
                { transform: [{ scale: pulseAnim }] },
              ]}
            />
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {callerName[0] ?? '?'}
              </Text>
            </View>
          </View>

          <Text style={[styles.callerName, isRtl && styles.textRtl]}>
            {callerName}
          </Text>

          {roleLabel ? (
            <Text style={[styles.callerRole, isRtl && styles.textRtl]}>
              {roleLabel}
            </Text>
          ) : null}

          <Text style={[styles.callingStatus, isRtl && styles.textRtl]}>
            {s.videoCall.calling[lang]}
          </Text>
        </View>

        {/* Bottom section — action buttons */}
        <View style={styles.actionSection}>
          {/* Decline */}
          <View style={styles.actionGroup}>
            <TouchableOpacity
              style={styles.declineBtn}
              onPress={onDecline}
              activeOpacity={0.7}
            >
              <Text style={styles.btnIcon}>✕</Text>
            </TouchableOpacity>
            <Text style={[styles.actionLabel, isRtl && styles.textRtl]}>
              {s.videoCall.decline[lang]}
            </Text>
          </View>

          {/* Accept */}
          <View style={styles.actionGroup}>
            <TouchableOpacity
              style={styles.acceptBtn}
              onPress={onAccept}
              activeOpacity={0.7}
            >
              <Text style={styles.btnIcon}>📞</Text>
            </TouchableOpacity>
            <Text style={[styles.actionLabel, isRtl && styles.textRtl]}>
              {s.videoCall.accept[lang]}
            </Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    zIndex: 9999,
    elevation: 9999,
  },
  container: {
    flex: 1,
    backgroundColor: '#1A2F4A',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 80 : 60,
    paddingBottom: Platform.OS === 'ios' ? 60 : 40,
  },
  callerSection: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  incomingLabel: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    fontFamily: 'Cairo',
    marginBottom: 40,
  },
  textRtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  avatarWrapper: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  pulseRing: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: 'rgba(13, 122, 122, 0.4)',
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#0D7A7A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  callerName: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'Cairo-Bold',
    marginBottom: 6,
    textAlign: 'center',
  },
  callerRole: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.65)',
    fontFamily: 'Cairo',
    marginBottom: 12,
  },
  callingStatus: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.5)',
    fontFamily: 'Cairo',
  },
  actionSection: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  actionGroup: {
    alignItems: 'center',
    gap: 10,
  },
  declineBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnIcon: {
    fontSize: 28,
    color: '#FFFFFF',
  },
  actionLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    fontFamily: 'Cairo',
  },
});
