/**
 * ProtocolCompliance — displays disease protocol compliance with progress bar.
 */

import { View, Text, StyleSheet } from 'react-native';
import type { Lang } from '@triaji/shared/i18n';
import { s } from '@triaji/shared/i18n';

interface ProtocolComplianceProps {
  condition: string;
  compliancePct: number;
  overdueItems: string[];
  lang: Lang;
  isRtl: boolean;
}

function getBarColor(pct: number): string {
  if (pct >= 80) return '#2E7D32';
  if (pct >= 50) return '#E65100';
  return '#C62828';
}

export default function ProtocolCompliance({
  condition,
  compliancePct,
  overdueItems,
  lang,
  isRtl,
}: ProtocolComplianceProps) {
  const barColor = getBarColor(compliancePct);

  return (
    <View style={styles.card}>
      <View style={[styles.headerRow, isRtl && styles.rowRtl]}>
        <Text style={[styles.condition, isRtl && styles.textRtl]}>{condition}</Text>
        <Text style={[styles.pctText, { color: barColor }]}>{compliancePct}%</Text>
      </View>

      {/* Progress bar */}
      <View style={styles.barBg}>
        <View
          style={[styles.barFill, { width: `${Math.min(compliancePct, 100)}%`, backgroundColor: barColor }]}
        />
      </View>

      {/* Overdue items */}
      {overdueItems.length > 0 && (
        <View style={styles.overdueSection}>
          <Text style={[styles.overdueTitle, isRtl && styles.textRtl]}>
            {s.mobileRecord.overdueItems[lang]}
          </Text>
          {overdueItems.map((item, idx) => (
            <View key={idx} style={[styles.overdueRow, isRtl && styles.rowRtl]}>
              <Text style={styles.bullet}>{'\u26A0\uFE0F'}</Text>
              <Text style={[styles.overdueText, isRtl && styles.textRtl]}>{item}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  rowRtl: {
    flexDirection: 'row-reverse',
  },
  condition: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A2F4A',
    fontFamily: 'Cairo-SemiBold',
    flex: 1,
  },
  pctText: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Cairo-Bold',
  },
  textRtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  barBg: {
    height: 8,
    backgroundColor: '#F0F0F0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  barFill: {
    height: 8,
    borderRadius: 4,
  },
  overdueSection: {
    marginTop: 4,
  },
  overdueTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#E65100',
    fontFamily: 'Cairo-SemiBold',
    marginBottom: 4,
  },
  overdueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  bullet: {
    fontSize: 12,
  },
  overdueText: {
    fontSize: 13,
    color: '#666',
    fontFamily: 'Cairo',
    flex: 1,
  },
});
