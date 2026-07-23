/**
 * AvailabilityBadge — shows GP availability status (available/unavailable/unset).
 * Fetches real-time availability from /api/doctor/gp-availability.
 */

import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import type { Lang } from '@triaji/shared/i18n';
import { s } from '@triaji/shared/i18n';

const API_BASE_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'https://app.doctortrio.online';

type AvailabilityStatus = 'available' | 'unavailable' | 'unset' | 'loading' | 'error';

interface AvailabilityBadgeProps {
  doctorAccountId: string;
  lang: Lang;
}

const STATUS_CONFIG: Record<
  Exclude<AvailabilityStatus, 'loading' | 'error'>,
  { dotColor: string; textKey: 'gpAvailable' | 'gpUnavailable' | 'gpUnset' }
> = {
  available: { dotColor: '#22C55E', textKey: 'gpAvailable' },
  unavailable: { dotColor: '#EF4444', textKey: 'gpUnavailable' },
  unset: { dotColor: '#9CA3AF', textKey: 'gpUnset' },
};

export default function AvailabilityBadge({
  doctorAccountId,
  lang,
}: AvailabilityBadgeProps) {
  const [status, setStatus] = useState<AvailabilityStatus>('loading');
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    async function fetchAvailability() {
      try {
        const { getPatientToken } = await import('@/lib/storage');
        const token = getPatientToken();

        const res = await fetch(
          `${API_BASE_URL}/api/doctor/gp-availability?doctorAccountId=${doctorAccountId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (!mountedRef.current) return;

        if (res.ok) {
          const data = await res.json();
          setStatus(data.available ? 'available' : data.schedule_set ? 'unavailable' : 'unset');
        } else {
          setStatus('error');
        }
      } catch {
        if (mountedRef.current) setStatus('error');
      }
    }

    fetchAvailability();

    // Poll every 30 seconds
    const interval = setInterval(fetchAvailability, 30000);

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [doctorAccountId]);

  if (status === 'loading') {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color="#0D7A7A" />
      </View>
    );
  }

  if (status === 'error') return null;

  const config = STATUS_CONFIG[status];

  return (
    <View style={[styles.container, { borderColor: config.dotColor }]}>
      <View style={[styles.dot, { backgroundColor: config.dotColor }]} />
      <Text style={[styles.text, lang === 'ar' && styles.textRtl]}>
        {s.videoCall[config.textKey][lang]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    alignSelf: 'flex-start',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Cairo-SemiBold',
    color: '#333',
  },
  textRtl: {
    writingDirection: 'rtl',
  },
});
