/**
 * Booking Screen — slot picker for a specific doctor.
 */

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useLang } from '@/hooks/useLang';
import { api } from '@/lib/api';
import { getPatientName } from '@/lib/storage';
import { s } from '@triaji/shared/i18n';
import type { AvailableSlot } from '@triaji/shared/api';

export default function BookingScreen() {
  const { doctorId } = useLocalSearchParams<{ doctorId: string }>();
  const { lang, isRtl } = useLang();

  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [patientName, setPatientName] = useState(getPatientName() ?? '');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchSlots();
  }, []);

  const fetchSlots = async () => {
    if (!doctorId) return;
    try {
      const result = await api.getDoctorSlots(doctorId);
      setSlots(result.slots);
    } catch {
      Alert.alert(s.common.error[lang], s.common.tryAgain[lang]);
    } finally {
      setLoading(false);
    }
  };

  const handleBooking = async () => {
    if (!selectedSlot || !patientName.trim() || !phone.trim() || !doctorId) return;

    setSubmitting(true);
    try {
      const result = await api.createBooking({
        sessionId: '',
        doctorId,
        slotId: selectedSlot,
        patientName: patientName.trim(),
        phoneNumber: phone.trim(),
      });

      router.replace({
        pathname: '/booking/confirmation',
        params: {
          bookingId: result.bookingId,
          doctorName: result.doctorNameAr,
          date: result.dateAr,
          time: result.timeAr,
          address: result.clinicAddressAr ?? '',
          fee: result.consultationFeeEgp?.toString() ?? '',
        },
      });
    } catch {
      Alert.alert(s.booking.bookingFailed[lang], s.booking.slotConflict[lang]);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0D7A7A" />
      </View>
    );
  }

  const renderSlot = ({ item }: { item: AvailableSlot }) => {
    const isSelected = selectedSlot === item.id;
    return (
      <TouchableOpacity
        style={[styles.slotCard, isSelected && styles.slotCardSelected]}
        onPress={() => setSelectedSlot(item.id)}
      >
        <Text
          style={[
            styles.slotDay,
            isSelected && styles.slotTextSelected,
            isRtl && styles.textRtl,
          ]}
        >
          {item.dayAr}
        </Text>
        <Text
          style={[
            styles.slotDate,
            isSelected && styles.slotTextSelected,
            isRtl && styles.textRtl,
          ]}
        >
          {item.dateAr}
        </Text>
        <Text
          style={[
            styles.slotTime,
            isSelected && styles.slotTextSelected,
          ]}
        >
          {item.timeAr}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backBtn}>{isRtl ? '→' : '←'}</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, isRtl && styles.textRtl]}>
          {s.booking.slotPickerTitle[lang]}
        </Text>
      </View>

      {slots.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, isRtl && styles.textRtl]}>
            {s.booking.noSlots[lang]}
          </Text>
        </View>
      ) : (
        <>
          {/* Slots */}
          <FlatList
            data={slots}
            keyExtractor={(item) => item.id}
            renderItem={renderSlot}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.slotsList}
            style={styles.slotsContainer}
          />

          {/* Patient form */}
          {selectedSlot && (
            <View style={styles.form}>
              <Text style={[styles.formTitle, isRtl && styles.textRtl]}>
                {s.booking.patientFormTitle[lang]}
              </Text>

              <Text style={[styles.label, isRtl && styles.textRtl]}>
                {s.booking.nameLabel[lang]}
              </Text>
              <TextInput
                style={[styles.input, isRtl && styles.inputRtl]}
                value={patientName}
                onChangeText={setPatientName}
                placeholder={s.booking.namePlaceholder[lang]}
              />

              <Text style={[styles.label, isRtl && styles.textRtl]}>
                {s.booking.phoneLabel[lang]}
              </Text>
              <TextInput
                style={[styles.input, isRtl && styles.inputRtl]}
                value={phone}
                onChangeText={setPhone}
                placeholder={s.booking.phonePlaceholder[lang]}
                keyboardType="phone-pad"
                maxLength={11}
              />

              <TouchableOpacity
                style={[styles.bookBtn, submitting && styles.bookBtnDisabled]}
                onPress={handleBooking}
                disabled={submitting || !patientName.trim() || !phone.trim()}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.bookBtnText}>
                    {s.booking.confirmBooking[lang]}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0D7A7A',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
    gap: 12,
  },
  backBtn: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    fontFamily: 'Cairo-Bold',
  },
  textRtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  inputRtl: {
    textAlign: 'right',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#888',
    fontFamily: 'Cairo',
  },
  slotsContainer: {
    maxHeight: 140,
  },
  slotsList: {
    padding: 16,
    gap: 10,
  },
  slotCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    minWidth: 120,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E0E0E0',
  },
  slotCardSelected: {
    borderColor: '#0D7A7A',
    backgroundColor: '#E0F2F1',
  },
  slotDay: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'Cairo',
  },
  slotDate: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A2F4A',
    marginVertical: 4,
    fontFamily: 'Cairo-SemiBold',
  },
  slotTime: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0D7A7A',
    fontFamily: 'Cairo-Bold',
  },
  slotTextSelected: {
    color: '#0D7A7A',
  },
  form: {
    padding: 20,
    gap: 12,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A2F4A',
    marginBottom: 8,
    fontFamily: 'Cairo-Bold',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A2F4A',
    fontFamily: 'Cairo-SemiBold',
  },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
  },
  bookBtn: {
    backgroundColor: '#0D7A7A',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  bookBtnDisabled: {
    opacity: 0.6,
  },
  bookBtnText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'Cairo-Bold',
  },
});
