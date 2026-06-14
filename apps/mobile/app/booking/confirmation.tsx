/**
 * Booking Confirmation Screen — shows booking details after successful booking.
 */

import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useLang } from '@/hooks/useLang';
import { s } from '@triaji/shared/i18n';

export default function ConfirmationScreen() {
  const { lang, isRtl } = useLang();
  const params = useLocalSearchParams<{
    bookingId: string;
    doctorName: string;
    date: string;
    time: string;
    address: string;
    fee: string;
  }>();

  return (
    <View style={styles.container}>
      <View style={styles.successIcon}>
        <Text style={styles.checkmark}>✓</Text>
      </View>

      <Text style={[styles.title, isRtl && styles.textRtl]}>
        {s.booking.bookingSuccess[lang]}
      </Text>

      <View style={styles.detailsCard}>
        <Text style={[styles.detailsTitle, isRtl && styles.textRtl]}>
          {s.booking.appointmentDetails[lang]}
        </Text>

        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, isRtl && styles.textRtl]}>
            {s.booking.doctor[lang]}
          </Text>
          <Text style={[styles.detailValue, isRtl && styles.textRtl]}>
            {params.doctorName}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, isRtl && styles.textRtl]}>
            {s.booking.date[lang]}
          </Text>
          <Text style={[styles.detailValue, isRtl && styles.textRtl]}>
            {params.date}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, isRtl && styles.textRtl]}>
            {s.booking.time[lang]}
          </Text>
          <Text style={[styles.detailValue, isRtl && styles.textRtl]}>
            {params.time}
          </Text>
        </View>

        {params.address ? (
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, isRtl && styles.textRtl]}>
              {s.booking.address[lang]}
            </Text>
            <Text style={[styles.detailValue, isRtl && styles.textRtl]}>
              {params.address}
            </Text>
          </View>
        ) : null}

        {params.fee ? (
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, isRtl && styles.textRtl]}>
              {s.booking.consultationFee[lang]}
            </Text>
            <Text style={[styles.detailValue, isRtl && styles.textRtl]}>
              {params.fee} {s.booking.fee[lang]}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => router.replace('/(patient)/chat')}
        >
          <Text style={styles.primaryBtnText}>
            {s.booking.newSession[lang]}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => router.replace('/(patient)/history')}
        >
          <Text style={styles.secondaryBtnText}>
            {s.history.title[lang]}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingTop: 100,
    alignItems: 'center',
  },
  textRtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  checkmark: {
    fontSize: 40,
    color: '#2E7D32',
    fontWeight: 'bold',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A2F4A',
    marginBottom: 32,
    fontFamily: 'Cairo-Bold',
  },
  detailsCard: {
    backgroundColor: '#F5F5F5',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    marginBottom: 32,
  },
  detailsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A2F4A',
    marginBottom: 16,
    fontFamily: 'Cairo-Bold',
  },
  detailRow: {
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 13,
    color: '#888',
    marginBottom: 2,
    fontFamily: 'Cairo',
  },
  detailValue: {
    fontSize: 16,
    color: '#1A2F4A',
    fontWeight: '600',
    fontFamily: 'Cairo-SemiBold',
  },
  actions: {
    width: '100%',
    gap: 12,
  },
  primaryBtn: {
    backgroundColor: '#0D7A7A',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Cairo-Bold',
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: '#0D7A7A',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: '#0D7A7A',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Cairo-SemiBold',
  },
});
