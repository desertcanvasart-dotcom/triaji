/**
 * VitalsSheet — bottom sheet / modal for quick vitals entry.
 * Uses @gorhom/bottom-sheet if available, otherwise falls back to Modal.
 */

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import type { Lang } from '@triaji/shared/i18n';
import { s } from '@triaji/shared/i18n';
import { api } from '@/lib/api';

interface VitalsSheetProps {
  visible: boolean;
  onClose: () => void;
  lang: Lang;
  isRtl: boolean;
}

export default function VitalsSheet({ visible, onClose, lang, isRtl }: VitalsSheetProps) {
  const [weight, setWeight] = useState('');
  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');
  const [glucose, setGlucose] = useState('');
  const [glucoseType, setGlucoseType] = useState<'fasting' | 'postprandial'>('fasting');
  const [saving, setSaving] = useState(false);

  const handleStepper = useCallback(
    (current: string, setter: (v: string) => void, step: number) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      const val = parseFloat(current) || 0;
      const newVal = Math.max(0, val + step);
      setter(String(newVal));
    },
    []
  );

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const vitals: Record<string, unknown> = {};
      if (weight) vitals.weight = parseFloat(weight);
      if (systolic && diastolic) {
        vitals.bloodPressure = {
          systolic: parseInt(systolic, 10),
          diastolic: parseInt(diastolic, 10),
        };
      }
      if (glucose) {
        vitals.bloodGlucose = {
          value: parseFloat(glucose),
          type: glucoseType,
        };
      }

      if (Object.keys(vitals).length === 0) {
        onClose();
        return;
      }

      await api.saveVitals(vitals);

      Alert.alert(s.mobileVitals.saved[lang]);
      setWeight('');
      setSystolic('');
      setDiastolic('');
      setGlucose('');
      setGlucoseType('fasting');
      onClose();
    } catch {
      Alert.alert(s.common.error[lang]);
    } finally {
      setSaving(false);
    }
  }, [weight, systolic, diastolic, glucose, glucoseType, lang, onClose]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.cancelText}>{s.common.close[lang]}</Text>
          </TouchableOpacity>
          <Text style={[styles.title, isRtl && styles.textRtl]}>
            {s.mobileVitals.logVitals[lang]}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.form}>
          {/* Weight */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, isRtl && styles.textRtl]}>
              {s.mobileVitals.weight[lang]} ({s.mobileVitals.kg[lang]})
            </Text>
            <View style={[styles.stepperRow, isRtl && styles.rowRtl]}>
              <TouchableOpacity
                style={styles.stepperBtn}
                onPress={() => handleStepper(weight, setWeight, -0.5)}
              >
                <Text style={styles.stepperBtnText}>-</Text>
              </TouchableOpacity>
              <TextInput
                style={[styles.stepperInput, isRtl && styles.textRtl]}
                value={weight}
                onChangeText={setWeight}
                keyboardType="decimal-pad"
                placeholder="70"
                placeholderTextColor="#CCC"
              />
              <TouchableOpacity
                style={styles.stepperBtn}
                onPress={() => handleStepper(weight, setWeight, 0.5)}
              >
                <Text style={styles.stepperBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Blood Pressure */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, isRtl && styles.textRtl]}>
              {s.mobileVitals.bloodPressure[lang]} ({s.mobileVitals.mmHg[lang]})
            </Text>
            <View style={[styles.bpRow, isRtl && styles.rowRtl]}>
              <View style={styles.bpField}>
                <Text style={styles.bpSubLabel}>{s.mobileVitals.systolic[lang]}</Text>
                <TextInput
                  style={[styles.bpInput, isRtl && styles.textRtl]}
                  value={systolic}
                  onChangeText={setSystolic}
                  keyboardType="number-pad"
                  placeholder="120"
                  placeholderTextColor="#CCC"
                />
              </View>
              <Text style={styles.bpSeparator}>/</Text>
              <View style={styles.bpField}>
                <Text style={styles.bpSubLabel}>{s.mobileVitals.diastolic[lang]}</Text>
                <TextInput
                  style={[styles.bpInput, isRtl && styles.textRtl]}
                  value={diastolic}
                  onChangeText={setDiastolic}
                  keyboardType="number-pad"
                  placeholder="80"
                  placeholderTextColor="#CCC"
                />
              </View>
            </View>
          </View>

          {/* Blood Glucose */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, isRtl && styles.textRtl]}>
              {s.mobileVitals.bloodGlucose[lang]} ({s.mobileVitals.mgDl[lang]})
            </Text>
            <TextInput
              style={[styles.glucoseInput, isRtl && styles.textRtl]}
              value={glucose}
              onChangeText={setGlucose}
              keyboardType="decimal-pad"
              placeholder="100"
              placeholderTextColor="#CCC"
            />
            <View style={[styles.toggleRow, isRtl && styles.rowRtl]}>
              <TouchableOpacity
                style={[
                  styles.toggleBtn,
                  glucoseType === 'fasting' && styles.toggleBtnActive,
                ]}
                onPress={() => setGlucoseType('fasting')}
              >
                <Text
                  style={[
                    styles.toggleText,
                    glucoseType === 'fasting' && styles.toggleTextActive,
                  ]}
                >
                  {s.mobileVitals.fasting[lang]}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.toggleBtn,
                  glucoseType === 'postprandial' && styles.toggleBtnActive,
                ]}
                onPress={() => setGlucoseType('postprandial')}
              >
                <Text
                  style={[
                    styles.toggleText,
                    glucoseType === 'postprandial' && styles.toggleTextActive,
                  ]}
                >
                  {s.mobileVitals.postprandial[lang]}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Save */}
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.7}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.saveBtnText}>{s.mobileVitals.save[lang]}</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  cancelText: {
    fontSize: 16,
    color: '#0D7A7A',
    fontWeight: '600',
    fontFamily: 'Cairo-SemiBold',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A2F4A',
    fontFamily: 'Cairo-Bold',
  },
  headerSpacer: {
    width: 60,
  },
  textRtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  rowRtl: {
    flexDirection: 'row-reverse',
  },
  form: {
    padding: 16,
    paddingBottom: 40,
  },
  fieldGroup: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A2F4A',
    fontFamily: 'Cairo-SemiBold',
    marginBottom: 10,
  },
  // Stepper
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  stepperBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E0F2F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0D7A7A',
  },
  stepperInput: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A2F4A',
    fontFamily: 'Cairo-Bold',
    textAlign: 'center',
    minWidth: 80,
    borderBottomWidth: 2,
    borderBottomColor: '#0D7A7A',
    paddingVertical: 4,
  },
  // BP
  bpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  bpField: {
    alignItems: 'center',
  },
  bpSubLabel: {
    fontSize: 12,
    color: '#888',
    fontFamily: 'Cairo',
    marginBottom: 4,
  },
  bpInput: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A2F4A',
    fontFamily: 'Cairo-Bold',
    textAlign: 'center',
    minWidth: 70,
    borderBottomWidth: 2,
    borderBottomColor: '#0D7A7A',
    paddingVertical: 4,
  },
  bpSeparator: {
    fontSize: 28,
    color: '#CCC',
    marginTop: 16,
  },
  // Glucose
  glucoseInput: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A2F4A',
    fontFamily: 'Cairo-Bold',
    textAlign: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#0D7A7A',
    paddingVertical: 4,
    marginBottom: 12,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
  },
  toggleBtnActive: {
    backgroundColor: '#0D7A7A',
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    fontFamily: 'Cairo-SemiBold',
  },
  toggleTextActive: {
    color: '#FFFFFF',
  },
  // Save
  saveBtn: {
    backgroundColor: '#0D7A7A',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Cairo-Bold',
  },
});
