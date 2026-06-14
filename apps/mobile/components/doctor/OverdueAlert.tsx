/**
 * OverdueAlert — badge card for overdue follow-ups or new lab results.
 * Shows count with icon and tap action.
 */

import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import type { Lang } from '@triaji/shared/i18n';
import { s } from '@triaji/shared/i18n';

interface OverdueAlertProps {
  count: number;
  type: 'follow_up' | 'lab_result';
  lang: Lang;
  isRtl: boolean;
  onPress: () => void;
}

export default function OverdueAlert({
  count,
  type,
  lang,
  isRtl,
  onPress,
}: OverdueAlertProps) {
  const icon = type === 'follow_up' ? '⚠️' : '🧪';
  const label = type === 'follow_up'
    ? s.doctorDashboard.overdueFollowUps[lang]
    : s.doctorDashboard.newLabResults[lang];

  const bgColor = type === 'follow_up' ? '#FFF8E1' : '#E0F2F1';
  const borderColor = type === 'follow_up' ? '#FFE082' : '#B2DFDB';
  const countColor = type === 'follow_up' ? '#E65100' : '#00695C';

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: bgColor, borderColor }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.row, isRtl && styles.rowRtl]}>
        <Text style={styles.icon}>{icon}</Text>
        <View style={styles.textContainer}>
          <Text style={[styles.count, { color: countColor }]}>
            {count}
          </Text>
          <Text style={[styles.label, isRtl && styles.textRtl]} numberOfLines={2}>
            {label}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowRtl: {
    flexDirection: 'row-reverse',
  },
  icon: {
    fontSize: 24,
  },
  textContainer: {
    flex: 1,
  },
  count: {
    fontSize: 22,
    fontWeight: '800',
    fontFamily: 'Cairo-Bold',
  },
  label: {
    fontSize: 12,
    color: '#555',
    fontFamily: 'Cairo',
    lineHeight: 18,
  },
  textRtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
