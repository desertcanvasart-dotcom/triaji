/**
 * FollowUpCard — shows an upcoming or overdue follow-up appointment.
 */

import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { Lang } from '@triaji/shared/i18n';
import { s } from '@triaji/shared/i18n';

interface FollowUpCardProps {
  doctorName: string;
  specialty: string;
  dueDate: string;
  isOverdue: boolean;
  lang: Lang;
  isRtl: boolean;
  onBook: () => void;
}

export default function FollowUpCard({
  doctorName,
  specialty,
  dueDate,
  isOverdue,
  lang,
  isRtl,
  onBook,
}: FollowUpCardProps) {
  const formattedDate = new Date(dueDate).toLocaleDateString(
    lang === 'ar' ? 'ar-EG' : 'en-US',
    { day: 'numeric', month: 'short', year: 'numeric' }
  );

  return (
    <View
      style={[
        styles.card,
        isOverdue && styles.cardOverdue,
      ]}
    >
      <View style={[styles.topRow, isRtl && styles.rowRtl]}>
        <View style={styles.doctorInfo}>
          <Text style={[styles.doctorName, isRtl && styles.textRtl]}>
            {doctorName}
          </Text>
          <Text style={[styles.specialty, isRtl && styles.textRtl]}>
            {specialty}
          </Text>
        </View>
        {isOverdue && (
          <View style={styles.overdueBadge}>
            <Text style={styles.overdueText}>
              {s.medicalRecord.overdueFollowUp[lang]}
            </Text>
          </View>
        )}
      </View>

      <View style={[styles.bottomRow, isRtl && styles.rowRtl]}>
        <Text style={[styles.dateText, isRtl && styles.textRtl]}>
          {formattedDate}
        </Text>
        <TouchableOpacity style={styles.bookBtn} onPress={onBook} activeOpacity={0.7}>
          <Text style={styles.bookBtnText}>
            {s.medicalRecord.bookNow[lang]}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#F0FAFA',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#B2DFDB',
  },
  cardOverdue: {
    backgroundColor: '#FFF8E1',
    borderColor: '#FFE082',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  rowRtl: {
    flexDirection: 'row-reverse',
  },
  doctorInfo: {
    flex: 1,
  },
  doctorName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A2F4A',
    fontFamily: 'Cairo-SemiBold',
  },
  specialty: {
    fontSize: 13,
    color: '#666',
    fontFamily: 'Cairo',
    marginTop: 2,
  },
  textRtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  overdueBadge: {
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  overdueText: {
    fontSize: 11,
    color: '#C62828',
    fontWeight: '600',
    fontFamily: 'Cairo-SemiBold',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 13,
    color: '#0D7A7A',
    fontFamily: 'Cairo',
  },
  bookBtn: {
    backgroundColor: '#0D7A7A',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  bookBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'Cairo-Bold',
  },
});
