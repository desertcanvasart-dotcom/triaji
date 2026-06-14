/**
 * BookingCard — appointment card for doctor dashboard.
 * Shows patient name, age, time, condition tags, and action buttons.
 */

import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { Lang } from '@triaji/shared/i18n';
import { s } from '@triaji/shared/i18n';

interface Booking {
  id: string;
  patient_name: string;
  patient_age: number;
  patient_sex: 'male' | 'female';
  time: string;
  condition_tags: string[];
  brs_score?: number;
  brs_level?: string;
}

interface BookingCardProps {
  booking: Booking;
  lang: Lang;
  isRtl: boolean;
  onViewSummary: () => void;
  onStartConsultation: () => void;
}

export default function BookingCard({
  booking,
  lang,
  isRtl,
  onViewSummary,
  onStartConsultation,
}: BookingCardProps) {
  const sexLabel = booking.patient_sex === 'male'
    ? s.doctorConsultation.male[lang]
    : s.doctorConsultation.female[lang];

  return (
    <View style={styles.card}>
      <View style={[styles.topRow, isRtl && styles.rowRtl]}>
        <View style={styles.patientInfo}>
          <Text style={[styles.patientName, isRtl && styles.textRtl]} numberOfLines={1}>
            {booking.patient_name}
          </Text>
          <Text style={[styles.patientMeta, isRtl && styles.textRtl]}>
            {booking.patient_age} {s.doctorConsultation.age[lang]} · {sexLabel} · {booking.time}
          </Text>
        </View>
        {booking.brs_level && (
          <View style={[
            styles.brsBadge,
            booking.brs_level === 'high' && styles.brsBadgeHigh,
            booking.brs_level === 'medium' && styles.brsBadgeMedium,
          ]}>
            <Text style={[
              styles.brsBadgeText,
              booking.brs_level === 'high' && styles.brsBadgeTextHigh,
              booking.brs_level === 'medium' && styles.brsBadgeTextMedium,
            ]}>
              {booking.brs_score ?? ''}
            </Text>
          </View>
        )}
      </View>

      {booking.condition_tags.length > 0 && (
        <View style={[styles.tagsRow, isRtl && styles.rowRtl]}>
          {booking.condition_tags.slice(0, 3).map((tag, i) => (
            <View key={i} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={[styles.actionsRow, isRtl && styles.rowRtl]}>
        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={onViewSummary}
          activeOpacity={0.7}
        >
          <Text style={styles.secondaryBtnText}>
            {s.doctor.viewSummary[lang]}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={onStartConsultation}
          activeOpacity={0.7}
        >
          <Text style={styles.primaryBtnText}>
            {s.doctor.startConsultation[lang]}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  rowRtl: {
    flexDirection: 'row-reverse',
  },
  patientInfo: {
    flex: 1,
  },
  patientName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A2F4A',
    fontFamily: 'Cairo-Bold',
  },
  patientMeta: {
    fontSize: 13,
    color: '#666',
    fontFamily: 'Cairo',
    marginTop: 2,
  },
  textRtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  brsBadge: {
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginLeft: 8,
  },
  brsBadgeHigh: {
    backgroundColor: '#FFEBEE',
  },
  brsBadgeMedium: {
    backgroundColor: '#FFF8E1',
  },
  brsBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2E7D32',
    fontFamily: 'Cairo-Bold',
  },
  brsBadgeTextHigh: {
    color: '#C62828',
  },
  brsBadgeTextMedium: {
    color: '#E65100',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  tag: {
    backgroundColor: '#F0F4F8',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagText: {
    fontSize: 12,
    color: '#4A5568',
    fontFamily: 'Cairo',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#1A2F4A',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: '#1A2F4A',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Cairo-SemiBold',
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: '#1A2F4A',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Cairo-SemiBold',
  },
});
