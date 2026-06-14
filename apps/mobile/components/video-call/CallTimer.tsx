/**
 * CallTimer — displays an incrementing HH:MM:SS timer from a given start time.
 * Used as an overlay on the video call screen.
 */

import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface CallTimerProps {
  startTime: Date;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export default function CallTimer({ startTime }: CallTimerProps) {
  const [elapsed, setElapsed] = useState('00:00:00');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const tick = () => {
      const ms = Date.now() - startTime.getTime();
      setElapsed(formatElapsed(ms));
    };

    tick();
    intervalRef.current = setInterval(tick, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [startTime]);

  return (
    <View style={styles.container}>
      <Text style={styles.timerText}>{elapsed}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  timerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'Cairo-SemiBold',
    letterSpacing: 1,
  },
});
