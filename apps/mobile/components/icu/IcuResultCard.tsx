/**
 * IcuResultCard — displays a single ICU search result with staleness indicator,
 * bed counts, distance, and optional transfer button.
 */

import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
} from 'react-native';
import type { IcuSearchResult } from '@triaji/shared/types/icu';
import { getStalenessLevel, type StalenessLevel } from '@triaji/shared/types/icu';
import { s } from '@triaji/shared/i18n';
import type { Lang } from '@triaji/shared/i18n';

const STALENESS_COLORS: Record<StalenessLevel, string> = {
  fresh: '#22C55E',
  stale: '#EAB308',
  unreliable: '#9CA3AF',
};

interface IcuResultCardProps {
  result: IcuSearchResult;
  lang: Lang;
  isRtl: boolean;
  showTransferButton?: boolean;
  onTransfer?: () => void;
}

function getRelativeTime(updatedAt: string, lang: Lang): string {
  const diffMs = Date.now() - new Date(updatedAt).getTime();
  const minutes = Math.floor(diffMs / (1000 * 60));

  if (minutes < 60) {
    return lang === 'ar'
      ? `${minutes} ${s.icu.minutesAgo[lang]}`
      : `${minutes} ${s.icu.minutesAgo[lang]}`;
  }

  const hours = Math.floor(minutes / 60);
  return lang === 'ar'
    ? `${hours} ${s.icu.hoursAgo[lang]}`
    : `${hours} ${s.icu.hoursAgo[lang]}`;
}

export default function IcuResultCard({
  result,
  lang,
  isRtl,
  showTransferButton,
  onTransfer,
}: IcuResultCardProps) {
  const staleness = getStalenessLevel(result.last_updated_at);
  const color = STALENESS_COLORS[staleness];
  const isFull = result.available_beds === 0;

  const hospitalName =
    lang === 'ar' ? result.hospital_name_ar : (result.hospital_name_en || result.hospital_name_ar);

  const unitTypeKey = result.unit_type as keyof typeof s.icu.unitTypes;
  const unitTypeName = s.icu.unitTypes[unitTypeKey]?.[lang] ?? result.unit_type;

  const distanceLabel = lang === 'ar'
    ? `${result.distance_km.toFixed(1)} ${s.booking.distance[lang]}`
    : `${result.distance_km.toFixed(1)} ${s.booking.distance[lang]}`;

  const bedLabel = lang === 'ar'
    ? `${result.available_beds} سرير متاح من ${result.total_beds}`
    : `${result.available_beds} beds available of ${result.total_beds}`;

  const handleCall = () => {
    if (result.phone_direct) {
      Linking.openURL(`tel:${result.phone_direct}`);
    }
  };

  return (
    <View style={[styles.card, { borderLeftColor: color, borderLeftWidth: 4 }]}>
      {/* Staleness dot + hospital name */}
      <View style={[styles.headerRow, isRtl && styles.rowRtl]}>
        <View style={[styles.dotRow, isRtl && styles.rowRtl]}>
          <View style={[styles.dot, { backgroundColor: color }]} />
          <Text
            style={[styles.hospitalName, isRtl && styles.textRtl]}
            numberOfLines={1}
          >
            {hospitalName}
          </Text>
        </View>
        <Text style={styles.distance}>{distanceLabel}</Text>
      </View>

      {/* Unit type */}
      <Text style={[styles.unitType, isRtl && styles.textRtl]}>
        {unitTypeName}
      </Text>

      {/* Bed count row */}
      <View style={[styles.bedRow, isRtl && styles.rowRtl]}>
        {isFull ? (
          <View style={styles.fullBadge}>
            <Text style={styles.fullBadgeText}>{s.icu.fullyOccupied[lang]}</Text>
          </View>
        ) : (
          <Text style={[styles.bedText, isRtl && styles.textRtl]}>
            {bedLabel}
          </Text>
        )}
      </View>

      {/* Unreliable warning */}
      {staleness === 'unreliable' && (
        <View style={styles.warningRow}>
          <Text style={styles.warningText}>{s.icu.dataStale[lang]}</Text>
        </View>
      )}

      {/* Last updated */}
      <Text style={[styles.lastUpdated, isRtl && styles.textRtl]}>
        {s.icu.lastUpdated[lang]}: {getRelativeTime(result.last_updated_at, lang)}
      </Text>

      {/* Action row */}
      <View style={[styles.actionRow, isRtl && styles.rowRtl]}>
        {result.phone_direct && (
          <TouchableOpacity
            style={styles.phoneBtn}
            onPress={handleCall}
            accessibilityLabel="Call hospital"
          >
            <Text style={styles.phoneBtnText}>
              {lang === 'ar' ? 'اتصل' : 'Call'}
            </Text>
          </TouchableOpacity>
        )}

        {showTransferButton &&
          result.available_beds > 0 &&
          result.accepts_transfers && (
            <TouchableOpacity
              style={styles.transferBtn}
              onPress={onTransfer}
              accessibilityLabel={s.icu.requestTransfer[lang]}
            >
              <Text style={styles.transferBtnText}>
                {s.icu.requestTransfer[lang]}
              </Text>
            </TouchableOpacity>
          )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  rowRtl: {
    flexDirection: 'row-reverse',
  },
  textRtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  dotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  hospitalName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A2F4A',
    fontFamily: 'Cairo-Bold',
    flex: 1,
  },
  distance: {
    fontSize: 13,
    color: '#0D7A7A',
    fontWeight: '600',
    fontFamily: 'Cairo-SemiBold',
    marginLeft: 8,
  },
  unitType: {
    fontSize: 13,
    color: '#666',
    fontFamily: 'Cairo',
    marginBottom: 6,
    marginLeft: 18,
  },
  bedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  bedText: {
    fontSize: 14,
    color: '#1A2F4A',
    fontFamily: 'Cairo-SemiBold',
    fontWeight: '600',
  },
  fullBadge: {
    backgroundColor: '#FFEBEE',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  fullBadgeText: {
    fontSize: 13,
    color: '#C62828',
    fontWeight: '600',
    fontFamily: 'Cairo-SemiBold',
  },
  warningRow: {
    backgroundColor: '#FFF8E1',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginVertical: 4,
  },
  warningText: {
    fontSize: 12,
    color: '#F57C00',
    fontFamily: 'Cairo',
    textAlign: 'center',
  },
  lastUpdated: {
    fontSize: 12,
    color: '#999',
    fontFamily: 'Cairo',
    marginBottom: 8,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  phoneBtn: {
    backgroundColor: '#E0F2F1',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  phoneBtnText: {
    fontSize: 14,
    color: '#0D7A7A',
    fontWeight: '600',
    fontFamily: 'Cairo-SemiBold',
  },
  transferBtn: {
    backgroundColor: '#0D7A7A',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    flex: 1,
    alignItems: 'center',
  },
  transferBtnText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '700',
    fontFamily: 'Cairo-Bold',
  },
});
