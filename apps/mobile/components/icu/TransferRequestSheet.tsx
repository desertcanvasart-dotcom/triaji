/**
 * TransferRequestSheet — modal bottom sheet for requesting ICU transfer.
 * Used by doctor ICU screen only.
 */

import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  Alert,
  ActivityIndicator,
  Linking,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import type { IcuSearchResult } from '@triaji/shared/types/icu';
import { s } from '@triaji/shared/i18n';
import type { Lang } from '@triaji/shared/i18n';

const API_BASE_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'https://app.triajji.com';

interface TransferRequestSheetProps {
  result: IcuSearchResult;
  lang: Lang;
  isRtl: boolean;
  onClose: () => void;
  onSubmitted: (transferId: string) => void;
}

type Urgency = 'urgent' | 'emergency';
type Sex = 'male' | 'female';

export default function TransferRequestSheet({
  result,
  lang,
  isRtl,
  onClose,
  onSubmitted,
}: TransferRequestSheetProps) {
  const [patientName, setPatientName] = useState('');
  const [patientAge, setPatientAge] = useState(30);
  const [patientSex, setPatientSex] = useState<Sex>('male');
  const [familyPhone, setFamilyPhone] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [clinicalSummary, setClinicalSummary] = useState('');
  const [urgency, setUrgency] = useState<Urgency>('urgent');
  const [currentLocation, setCurrentLocation] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const hospitalName =
    lang === 'ar' ? result.hospital_name_ar : (result.hospital_name_en || result.hospital_name_ar);

  const unitTypeKey = result.unit_type as keyof typeof s.icu.unitTypes;
  const unitTypeName = s.icu.unitTypes[unitTypeKey]?.[lang] ?? result.unit_type;

  const canSubmit = patientName.trim() && diagnosis.trim() && clinicalSummary.trim();

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);

    try {
      const { storage } = await import('@/lib/storage');
      const token = storage.getString('doctor-token') ?? '';

      const res = await fetch(`${API_BASE_URL}/api/icu/transfer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          icu_unit_id: result.icu_unit_id,
          receiving_tenant_id: result.tenant_id,
          patient_name_ar: patientName.trim(),
          patient_age: patientAge,
          patient_sex: patientSex,
          patient_phone: familyPhone.trim() || null,
          diagnosis_ar: diagnosis.trim(),
          clinical_summary_ar: clinicalSummary.trim(),
          urgency,
          current_location_ar: currentLocation.trim(),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const transferId = data.id ?? data.transfer_id ?? 'N/A';
        Alert.alert(
          s.icu.transferSent[lang],
          `${s.icu.awaitingResponse[lang]}\nID: ${transferId}`,
          [{ text: s.common.close[lang], onPress: () => onSubmitted(transferId) }]
        );
      } else {
        const errData = await res.json().catch(() => ({}));
        Alert.alert(s.common.error[lang], errData.error || s.common.error[lang]);
      }
    } catch {
      Alert.alert(s.common.error[lang], s.common.tryAgain[lang]);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCallHospital = () => {
    if (result.phone_direct) {
      Linking.openURL(`tel:${result.phone_direct}`);
    }
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <View style={styles.sheet}>
          {/* Handle bar */}
          <View style={styles.handleBar} />

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Header */}
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, isRtl && styles.textRtl]}>
                {s.icu.transferRequest[lang]}
              </Text>
              <TouchableOpacity onPress={onClose}>
                <Text style={styles.closeBtn}>{s.common.close[lang]}</Text>
              </TouchableOpacity>
            </View>

            {/* Hospital info */}
            <View style={styles.hospitalInfo}>
              <Text style={[styles.hospitalLabel, isRtl && styles.textRtl]}>
                {hospitalName} — {unitTypeName}
              </Text>
              <Text style={[styles.bedInfo, isRtl && styles.textRtl]}>
                {result.available_beds} {s.icu.bedsAvailable[lang]}
              </Text>
            </View>

            {/* Patient name */}
            <Text style={[styles.fieldLabel, isRtl && styles.textRtl]}>
              {s.icu.patientName[lang]} *
            </Text>
            <TextInput
              style={[styles.input, isRtl && styles.inputRtl]}
              value={patientName}
              onChangeText={setPatientName}
              placeholder={s.icu.patientName[lang]}
              placeholderTextColor="#AAA"
            />

            {/* Age stepper */}
            <Text style={[styles.fieldLabel, isRtl && styles.textRtl]}>
              {s.icu.patientAge[lang]}
            </Text>
            <View style={[styles.stepperRow, isRtl && styles.rowRtl]}>
              <TouchableOpacity
                style={styles.stepperBtn}
                onPress={() => setPatientAge((a) => Math.max(0, a - 1))}
              >
                <Text style={styles.stepperBtnText}>-</Text>
              </TouchableOpacity>
              <Text style={styles.stepperValue}>{patientAge}</Text>
              <TouchableOpacity
                style={styles.stepperBtn}
                onPress={() => setPatientAge((a) => Math.min(120, a + 1))}
              >
                <Text style={styles.stepperBtnText}>+</Text>
              </TouchableOpacity>
            </View>

            {/* Sex pills */}
            <Text style={[styles.fieldLabel, isRtl && styles.textRtl]}>
              {s.icu.patientSex[lang]}
            </Text>
            <View style={[styles.pillRow, isRtl && styles.rowRtl]}>
              <TouchableOpacity
                style={[styles.pill, patientSex === 'male' && styles.pillActive]}
                onPress={() => setPatientSex('male')}
              >
                <Text
                  style={[
                    styles.pillText,
                    patientSex === 'male' && styles.pillTextActive,
                  ]}
                >
                  {s.icu.male[lang]}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.pill, patientSex === 'female' && styles.pillActive]}
                onPress={() => setPatientSex('female')}
              >
                <Text
                  style={[
                    styles.pillText,
                    patientSex === 'female' && styles.pillTextActive,
                  ]}
                >
                  {s.icu.female[lang]}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Family phone */}
            <Text style={[styles.fieldLabel, isRtl && styles.textRtl]}>
              {s.icu.familyPhone[lang]}
            </Text>
            <TextInput
              style={[styles.input, isRtl && styles.inputRtl]}
              value={familyPhone}
              onChangeText={setFamilyPhone}
              placeholder="01XXXXXXXXX"
              placeholderTextColor="#AAA"
              keyboardType="phone-pad"
            />

            {/* Diagnosis */}
            <Text style={[styles.fieldLabel, isRtl && styles.textRtl]}>
              {s.icu.diagnosis[lang]} *
            </Text>
            <TextInput
              style={[styles.input, isRtl && styles.inputRtl]}
              value={diagnosis}
              onChangeText={setDiagnosis}
              placeholder={s.icu.diagnosis[lang]}
              placeholderTextColor="#AAA"
            />

            {/* Clinical summary */}
            <Text style={[styles.fieldLabel, isRtl && styles.textRtl]}>
              {s.icu.clinicalSummary[lang]} *
            </Text>
            <TextInput
              style={[styles.textArea, isRtl && styles.inputRtl]}
              value={clinicalSummary}
              onChangeText={setClinicalSummary}
              placeholder={s.icu.clinicalSummary[lang]}
              placeholderTextColor="#AAA"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            {/* Urgency pills */}
            <Text style={[styles.fieldLabel, isRtl && styles.textRtl]}>
              {lang === 'ar' ? 'الاستعجال' : 'Urgency'}
            </Text>
            <View style={[styles.pillRow, isRtl && styles.rowRtl]}>
              <TouchableOpacity
                style={[styles.pill, urgency === 'urgent' && styles.pillActive]}
                onPress={() => setUrgency('urgent')}
              >
                <Text
                  style={[
                    styles.pillText,
                    urgency === 'urgent' && styles.pillTextActive,
                  ]}
                >
                  {s.icu.urgentTransfer[lang]}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.pill,
                  urgency === 'emergency' && styles.pillEmergencyActive,
                ]}
                onPress={() => setUrgency('emergency')}
              >
                <Text
                  style={[
                    styles.pillText,
                    urgency === 'emergency' && styles.pillTextActive,
                  ]}
                >
                  {s.icu.emergencyTransfer[lang]}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Emergency warning */}
            {urgency === 'emergency' && (
              <TouchableOpacity
                style={styles.emergencyWarning}
                onPress={handleCallHospital}
              >
                <Text style={styles.emergencyWarningText}>
                  {s.icu.callDirectFirst[lang]}
                </Text>
                {result.phone_direct && (
                  <Text style={styles.emergencyPhone}>
                    {result.phone_direct}
                  </Text>
                )}
              </TouchableOpacity>
            )}

            {/* Current location */}
            <Text style={[styles.fieldLabel, isRtl && styles.textRtl]}>
              {s.icu.currentLocation[lang]}
            </Text>
            <TextInput
              style={[styles.input, isRtl && styles.inputRtl]}
              value={currentLocation}
              onChangeText={setCurrentLocation}
              placeholder={s.icu.currentLocation[lang]}
              placeholderTextColor="#AAA"
            />

            {/* Submit button */}
            <TouchableOpacity
              style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={!canSubmit || submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.submitBtnText}>
                  {s.icu.sendTransferRequest[lang]}
                </Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    paddingBottom: 32,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#DDD',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A2F4A',
    fontFamily: 'Cairo-Bold',
  },
  closeBtn: {
    fontSize: 14,
    color: '#0D7A7A',
    fontWeight: '600',
    fontFamily: 'Cairo-SemiBold',
  },
  hospitalInfo: {
    backgroundColor: '#F0F9F9',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  hospitalLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A2F4A',
    fontFamily: 'Cairo-SemiBold',
  },
  bedInfo: {
    fontSize: 13,
    color: '#0D7A7A',
    fontFamily: 'Cairo',
    marginTop: 2,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#444',
    fontFamily: 'Cairo-SemiBold',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1A2F4A',
    fontFamily: 'Cairo',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  inputRtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  textArea: {
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1A2F4A',
    fontFamily: 'Cairo',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    minHeight: 100,
  },
  textRtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  rowRtl: {
    flexDirection: 'row-reverse',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  stepperBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E0F2F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnText: {
    fontSize: 22,
    fontWeight: '600',
    color: '#0D7A7A',
  },
  stepperValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A2F4A',
    minWidth: 40,
    textAlign: 'center',
    fontFamily: 'Cairo-Bold',
  },
  pillRow: {
    flexDirection: 'row',
    gap: 10,
  },
  pill: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  pillActive: {
    backgroundColor: '#0D7A7A',
    borderColor: '#0D7A7A',
  },
  pillEmergencyActive: {
    backgroundColor: '#C62828',
    borderColor: '#C62828',
  },
  pillText: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'Cairo-SemiBold',
    fontWeight: '600',
  },
  pillTextActive: {
    color: '#FFFFFF',
  },
  emergencyWarning: {
    backgroundColor: '#FFEBEE',
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#FFCDD2',
    alignItems: 'center',
  },
  emergencyWarningText: {
    fontSize: 14,
    color: '#C62828',
    fontWeight: '600',
    fontFamily: 'Cairo-SemiBold',
    textAlign: 'center',
  },
  emergencyPhone: {
    fontSize: 16,
    color: '#C62828',
    fontWeight: '700',
    fontFamily: 'Cairo-Bold',
    marginTop: 4,
  },
  submitBtn: {
    backgroundColor: '#0D7A7A',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  submitBtnDisabled: {
    backgroundColor: '#B2DFDB',
  },
  submitBtnText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '700',
    fontFamily: 'Cairo-Bold',
  },
});
