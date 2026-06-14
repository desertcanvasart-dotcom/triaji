/**
 * AlertCard — reusable alert/notification card component.
 * Used on the home screen for protocol alerts, overdue follow-ups, etc.
 */

import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';

interface AlertCardProps {
  icon: string;
  title: string;
  description: string;
  onPress?: () => void;
  variant: 'warning' | 'info' | 'error';
  isRtl?: boolean;
}

const VARIANT_COLORS = {
  warning: {
    bg: '#FFF8E1',
    border: '#FFE082',
    iconBg: '#FFF3E0',
    title: '#E65100',
    desc: '#4E342E',
  },
  info: {
    bg: '#E0F2F1',
    border: '#B2DFDB',
    iconBg: '#E0F7FA',
    title: '#00695C',
    desc: '#37474F',
  },
  error: {
    bg: '#FFEBEE',
    border: '#FFCDD2',
    iconBg: '#FCE4EC',
    title: '#C62828',
    desc: '#4E342E',
  },
};

export default function AlertCard({
  icon,
  title,
  description,
  onPress,
  variant,
  isRtl,
}: AlertCardProps) {
  const colors = VARIANT_COLORS[variant];

  const content = (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.bg, borderColor: colors.border },
      ]}
    >
      <View style={[styles.row, isRtl && styles.rowRtl]}>
        <View style={[styles.iconCircle, { backgroundColor: colors.iconBg }]}>
          <Text style={styles.icon}>{icon}</Text>
        </View>
        <View style={styles.textContainer}>
          <Text
            style={[styles.title, { color: colors.title }, isRtl && styles.textRtl]}
            numberOfLines={1}
          >
            {title}
          </Text>
          <Text
            style={[styles.description, { color: colors.desc }, isRtl && styles.textRtl]}
            numberOfLines={2}
          >
            {description}
          </Text>
        </View>
        {onPress && (
          <Text style={styles.chevron}>{isRtl ? '‹' : '›'}</Text>
        )}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowRtl: {
    flexDirection: 'row-reverse',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 20,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Cairo-Bold',
    marginBottom: 2,
  },
  description: {
    fontSize: 13,
    lineHeight: 20,
    fontFamily: 'Cairo',
  },
  textRtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  chevron: {
    fontSize: 22,
    color: '#CCC',
  },
});
