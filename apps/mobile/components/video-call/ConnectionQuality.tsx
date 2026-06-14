/**
 * ConnectionQuality — three-dot indicator showing connection quality.
 * Green = good, yellow = fair, red = poor.
 */

import { View, StyleSheet } from 'react-native';

type Quality = 'good' | 'fair' | 'poor';

interface ConnectionQualityProps {
  quality: Quality;
}

const QUALITY_COLORS: Record<Quality, [string, string, string]> = {
  good: ['#22C55E', '#22C55E', '#22C55E'],
  fair: ['#F59E0B', '#F59E0B', '#D1D5DB'],
  poor: ['#EF4444', '#D1D5DB', '#D1D5DB'],
};

export default function ConnectionQuality({ quality }: ConnectionQualityProps) {
  const colors = QUALITY_COLORS[quality];

  return (
    <View style={styles.container}>
      {colors.map((color, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            { backgroundColor: color },
            i === 0 && styles.dotSmall,
            i === 1 && styles.dotMedium,
            i === 2 && styles.dotLarge,
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  dot: {
    borderRadius: 2,
    width: 4,
  },
  dotSmall: {
    height: 6,
  },
  dotMedium: {
    height: 10,
  },
  dotLarge: {
    height: 14,
  },
});
