/**
 * MedicationCard — displays a single active medication with adherence badge.
 */

import { View, Text, StyleSheet } from 'react-native';
import type { Lang } from '@triaji/shared/i18n';
import { s } from '@triaji/shared/i18n';

interface MedicationCardProps {
  name: string;
  dose: string;
  frequency: string;
  adherencePct?: number;
  lang: Lang;
  isRtl: boolean;
}

function getAdherenceColor(pct: number): { bg: string; text: string; label: string } {
  if (pct >= 80) return { bg: '#E8F5E9', text: '#2E7D32', label: `${pct}%` };
  if (pct >= 50) return { bg: '#FFF8E1', text: '#E65100', label: `${pct}%` };
  return { bg: '#FFEBEE', text: '#C62828', label: `${pct}%` };
}

export default function MedicationCard({
  name,
  dose,
  frequency,
  adherencePct,
  lang,
  isRtl,
}: MedicationCardProps) {
  const adherence = adherencePct != null ? getAdherenceColor(adherencePct) : null;

  return (
    <View style={[styles.card, isRtl && styles.cardRtl]}>
      <Text style={styles.icon}>{'\u{1F48A}'}</Text>
      <View style={styles.info}>
        <Text style={[styles.name, isRtl && styles.textRtl]}>{name}</Text>
        <Text style={[styles.detail, isRtl && styles.textRtl]}>
          {s.mobileRecord.dose[lang]}: {dose}
        </Text>
        <Text style={[styles.detail, isRtl && styles.textRtl]}>
          {s.mobileRecord.frequency[lang]}: {frequency}
        </Text>
      </View>
      {adherence && (
        <View style={[styles.badge, { backgroundColor: adherence.bg }]}>
          <Text style={[styles.badgeText, { color: adherence.text }]}>
            {adherence.label}
          </Text>
          <Text style={[styles.badgeLabel, { color: adherence.text }]}>
            {s.mobileRecord.adherence[lang]}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  cardRtl: {
    flexDirection: 'row-reverse',
  },
  icon: {
    fontSize: 24,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A2F4A',
    fontFamily: 'Cairo-SemiBold',
  },
  detail: {
    fontSize: 13,
    color: '#888',
    fontFamily: 'Cairo',
    marginTop: 2,
  },
  textRtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  badge: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Cairo-Bold',
  },
  badgeLabel: {
    fontSize: 10,
    fontFamily: 'Cairo',
  },
});
