/**
 * PrescriptionForm — simplified mobile prescription form.
 * Each row: drug name, dose, frequency, duration.
 * Max 5 medications. Sends to pharmacy API.
 */

import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Switch,
  Alert,
  Modal,
} from 'react-native';
import type { Lang } from '@triaji/shared/i18n';
import { s } from '@triaji/shared/i18n';

const API_BASE_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'https://app.triajji.com';

const FREQUENCY_OPTIONS = ['once', 'twice', 'thrice'] as const;
const DURATION_OPTIONS = [3, 5, 7, 10, 14, 30] as const;

type FrequencyKey = (typeof FREQUENCY_OPTIONS)[number];

interface MedicationRow {
  drugName: string;
  dose: string;
  frequency: FrequencyKey;
  duration: number;
}

interface PrescriptionFormProps {
  patientId: string;
  patientName: string;
  bookingId: string;
  lang: Lang;
  isRtl: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const EMPTY_ROW: MedicationRow = {
  drugName: '',
  dose: '',
  frequency: 'once',
  duration: 7,
};

export default function PrescriptionForm({
  patientId,
  patientName,
  bookingId,
  lang,
  isRtl,
  onClose,
  onSaved,
}: PrescriptionFormProps) {
  const [medications, setMedications] = useState<MedicationRow[]>([{ ...EMPTY_ROW }]);
  const [instructions, setInstructions] = useState('');
  const [followUpReason, setFollowUpReason] = useState('');
  const [followUpDateText, setFollowUpDateText] = useState('');
  const [sendWhatsApp, setSendWhatsApp] = useState(true);
  const [sending, setSending] = useState(false);

  const frequencyLabel = (f: FrequencyKey): string => {
    switch (f) {
      case 'once': return s.prescription.onceDaily[lang];
      case 'twice': return s.prescription.twiceDaily[lang];
      case 'thrice': return s.prescription.thriceDaily[lang];
    }
  };

  const updateMedication = (index: number, field: keyof MedicationRow, value: string | number) => {
    setMedications((prev) =>
      prev.map((m, i) => (i === index ? { ...m, [field]: value } : m))
    );
  };

  const addMedication = () => {
    if (medications.length >= 5) {
      Alert.alert('', s.prescription.maxMedications[lang]);
      return;
    }
    setMedications((prev) => [...prev, { ...EMPTY_ROW }]);
  };

  const removeMedication = (index: number) => {
    if (medications.length <= 1) return;
    setMedications((prev) => prev.filter((_, i) => i !== index));
  };

  const cycleFrequency = (index: number) => {
    const current = medications[index]?.frequency ?? 'once';
    const currentIdx = FREQUENCY_OPTIONS.indexOf(current);
    const next = FREQUENCY_OPTIONS[(currentIdx + 1) % FREQUENCY_OPTIONS.length] ?? 'once';
    updateMedication(index, 'frequency', next);
  };

  const cycleDuration = (index: number) => {
    const current = medications[index]?.duration ?? 7;
    const currentIdx = DURATION_OPTIONS.indexOf(current as typeof DURATION_OPTIONS[number]);
    const nextIdx = (currentIdx + 1) % DURATION_OPTIONS.length;
    const next = DURATION_OPTIONS[nextIdx] ?? 7;
    updateMedication(index, 'duration', next);
  };

  const handleSubmit = async () => {
    const validMeds = medications.filter((m) => m.drugName.trim() && m.dose.trim());
    if (validMeds.length === 0) return;

    setSending(true);
    try {
      const { storage } = await import('@/lib/storage');
      const token = storage.getString('doctor-token') ?? '';

      await fetch(`${API_BASE_URL}/api/doctor/prescription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          patient_id: patientId,
          booking_id: bookingId,
          medications: validMeds.map((m) => ({
            drug_name: m.drugName.trim(),
            dose: m.dose.trim(),
            frequency: m.frequency,
            duration_days: m.duration,
          })),
          instructions: instructions.trim() || undefined,
          follow_up_date: followUpDateText.trim() || undefined,
          follow_up_reason: followUpReason.trim() || undefined,
          send_whatsapp: sendWhatsApp,
        }),
      });

      Alert.alert('', s.prescription.sent[lang]);
      onSaved();
    } catch {
      Alert.alert('', s.common.error[lang]);
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        {/* Header */}
        <View style={[styles.modalHeader, isRtl && styles.rowRtl]}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.closeBtn}>{s.common.close[lang]}</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>{s.prescription.title[lang]}</Text>
          <View style={{ width: 50 }} />
        </View>

        <Text style={[styles.patientLabel, isRtl && styles.textRtl]}>
          {s.prescription.forPatient[lang]} {patientName}
        </Text>

        <ScrollView
          style={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Medication rows */}
          {medications.map((med, index) => (
            <View key={index} style={styles.medRow}>
              <View style={[styles.medHeader, isRtl && styles.rowRtl]}>
                <Text style={styles.medNumber}>#{index + 1}</Text>
                {medications.length > 1 && (
                  <TouchableOpacity onPress={() => removeMedication(index)}>
                    <Text style={styles.removeBtn}>{s.prescription.removeMedication[lang]}</Text>
                  </TouchableOpacity>
                )}
              </View>

              <TextInput
                style={[styles.input, isRtl && styles.inputRtl]}
                placeholder={s.prescription.drugNamePlaceholder[lang]}
                placeholderTextColor="#AAA"
                value={med.drugName}
                onChangeText={(v) => updateMedication(index, 'drugName', v)}
              />
              <TextInput
                style={[styles.input, isRtl && styles.inputRtl]}
                placeholder={s.prescription.dosePlaceholder[lang]}
                placeholderTextColor="#AAA"
                value={med.dose}
                onChangeText={(v) => updateMedication(index, 'dose', v)}
              />

              <View style={[styles.pickerRow, isRtl && styles.rowRtl]}>
                <TouchableOpacity
                  style={styles.pickerBtn}
                  onPress={() => cycleFrequency(index)}
                >
                  <Text style={styles.pickerLabel}>{s.prescription.frequency[lang]}</Text>
                  <Text style={styles.pickerValue}>{frequencyLabel(med.frequency)}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.pickerBtn}
                  onPress={() => cycleDuration(index)}
                >
                  <Text style={styles.pickerLabel}>{s.prescription.duration[lang]}</Text>
                  <Text style={styles.pickerValue}>
                    {med.duration} {s.prescription.days[lang]}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {medications.length < 5 && (
            <TouchableOpacity style={styles.addMedBtn} onPress={addMedication}>
              <Text style={styles.addMedText}>+ {s.prescription.addMedication[lang]}</Text>
            </TouchableOpacity>
          )}

          {/* Instructions */}
          <Text style={[styles.fieldLabel, isRtl && styles.textRtl]}>
            {s.prescription.instructions[lang]}
          </Text>
          <TextInput
            style={[styles.input, styles.textArea, isRtl && styles.inputRtl]}
            placeholder={s.prescription.instructionsPlaceholder[lang]}
            placeholderTextColor="#AAA"
            value={instructions}
            onChangeText={setInstructions}
            multiline
            numberOfLines={3}
          />

          {/* Follow-up date */}
          <Text style={[styles.fieldLabel, isRtl && styles.textRtl]}>
            {s.prescription.followUpDate[lang]}
          </Text>
          <TextInput
            style={[styles.input, isRtl && styles.inputRtl]}
            placeholder={lang === 'ar' ? 'مثال: 2026-04-15' : 'e.g. 2026-04-15'}
            placeholderTextColor="#AAA"
            value={followUpDateText}
            onChangeText={setFollowUpDateText}
            keyboardType="numbers-and-punctuation"
          />

          {/* Follow-up reason */}
          <TextInput
            style={[styles.input, isRtl && styles.inputRtl]}
            placeholder={s.prescription.followUpReason[lang]}
            placeholderTextColor="#AAA"
            value={followUpReason}
            onChangeText={setFollowUpReason}
          />

          {/* WhatsApp toggle */}
          <View style={[styles.toggleRow, isRtl && styles.rowRtl]}>
            <Text style={[styles.toggleLabel, isRtl && styles.textRtl]}>
              {s.prescription.sendViaWhatsApp[lang]}
            </Text>
            <Switch
              value={sendWhatsApp}
              onValueChange={setSendWhatsApp}
              trackColor={{ true: '#0D7A7A', false: '#CCC' }}
              thumbColor="#FFF"
            />
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitBtn, sending && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={sending}
            activeOpacity={0.7}
          >
            <Text style={styles.submitBtnText}>
              {sending ? s.prescription.sending[lang] : s.prescription.sendToPharmacy[lang]}
            </Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 12,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  rowRtl: {
    flexDirection: 'row-reverse',
  },
  closeBtn: {
    fontSize: 16,
    color: '#0D7A7A',
    fontFamily: 'Cairo-SemiBold',
    fontWeight: '600',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A2F4A',
    fontFamily: 'Cairo-Bold',
  },
  patientLabel: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'Cairo',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  textRtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  scrollContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  medRow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  medHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  medNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A2F4A',
    fontFamily: 'Cairo-Bold',
  },
  removeBtn: {
    fontSize: 13,
    color: '#C62828',
    fontFamily: 'Cairo',
  },
  input: {
    backgroundColor: '#F9F9F9',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: 'Cairo',
    color: '#333',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#EEE',
  },
  inputRtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  pickerRow: {
    flexDirection: 'row',
    gap: 8,
  },
  pickerBtn: {
    flex: 1,
    backgroundColor: '#F0F4F8',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  pickerLabel: {
    fontSize: 11,
    color: '#888',
    fontFamily: 'Cairo',
    marginBottom: 2,
  },
  pickerValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A2F4A',
    fontFamily: 'Cairo-SemiBold',
  },
  addMedBtn: {
    borderWidth: 1,
    borderColor: '#0D7A7A',
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 20,
  },
  addMedText: {
    color: '#0D7A7A',
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'Cairo-SemiBold',
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    fontFamily: 'Cairo-SemiBold',
    marginBottom: 6,
    marginTop: 4,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    marginBottom: 20,
  },
  toggleLabel: {
    fontSize: 15,
    color: '#1A2F4A',
    fontFamily: 'Cairo',
  },
  submitBtn: {
    backgroundColor: '#0D7A7A',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Cairo-SemiBold',
  },
});
