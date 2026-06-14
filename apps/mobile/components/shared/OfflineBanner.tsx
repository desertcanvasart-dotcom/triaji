/**
 * OfflineBanner — yellow banner shown when the device is offline.
 * Uses a simple fetch check to determine connectivity.
 */

import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { Lang } from '@triaji/shared/i18n';
import { s } from '@triaji/shared/i18n';

interface OfflineBannerProps {
  lang: Lang;
  isRtl: boolean;
}

export default function OfflineBanner({ lang, isRtl }: OfflineBannerProps) {
  const [isOffline, setIsOffline] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const checkConnectivity = async () => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        await fetch('https://www.google.com/generate_204', {
          method: 'HEAD',
          signal: controller.signal,
        });
        clearTimeout(timeout);
        setIsOffline(false);
      } catch {
        setIsOffline(true);
      }
    };

    checkConnectivity();
    intervalRef.current = setInterval(checkConnectivity, 15000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <View style={styles.container}>
      <Text style={[styles.text, isRtl && styles.textRtl]}>
        {s.mobileRecord.offline[lang]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFF8E1',
    paddingVertical: 8,
    paddingHorizontal: 16,
    width: '100%',
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
    color: '#E65100',
    fontFamily: 'Cairo-SemiBold',
    textAlign: 'center',
  },
  textRtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
