/**
 * Patient Detail View — full patient profile for GP.
 * Shows vitals, medications, labs, protocol compliance,
 * and a freestanding clinical note textarea.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { useLang } from '@/hooks/useLang';
import { s } from '@triaji/shared/i18n';

const API_BASE_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'https://app.triajji.com';

interface Vital {
  label: string;
  value: string;
  unit: string;
  date: string;
}

interface Medication {
  name: string;
  dose: string;
  frequency: string;
}

interface LabResult {
  test_name: string;
  value: string;
  unit: string;
  is_abnormal: boolean;
  date: string;
}

interface PatientDetail {
  id: string;
  name: string;
  age: number;
  sex: 'male' | 'female';
  vitals: Vital[];
  medications: Medication[];
  lab_results: LabResult[];
  protocol_compliance: number | null;
  active_booking_id: string | null;
  expo_push_token?: string | null;
  gp_video_calls_enabled?: boolean;
  call_fee?: number;
}

export default function PatientDetailScreen() {
  const { patientId } = useLocalSearchParams<{ patientId: string }>();
  const { lang, isRtl } = useLang();
  const [patient, setPatient] = useState<PatientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [initiatingCall, setInitiatingCall] = useState(false);

  const fetchPatient = useCallback(async () => {
    try {
      const { storage } = await import('@/lib/storage');
      const token = storage.getString('doctor-token') ?? '';

      const res = await fetch(
        `${API_BASE_URL}/api/doctor/patients/${patientId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.ok) {
        const json = await res.json();
        setPatient(json);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    fetchPatient();
  }, [fetchPatient]);

  const handleSaveNote = async () => {
    if (!noteText.trim()) return;
    setSavingNote(true);

    try {
      const { storage } = await import('@/lib/storage');
      const token = storage.getString('doctor-token') ?? '';

      const res = await fetch(
        `${API_BASE_URL}/api/doctor/patients/${patientId}/notes`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ note: noteText.trim() }),
        }
      );

      if (res.ok) {
        Alert.alert('', s.doctorPatients.noteSaved[lang]);
        setNoteText('');
      } else {
        Alert.alert('', s.common.error[lang]);
      }
    } catch {
      Alert.alert('', s.common.error[lang]);
    } finally {
      setSavingNote(false);
    }
  };

  // ─── Video Call ─────────────────────────────────────────────────────────

  const handleVideoCall = () => {
    if (!patient) return;

    // Check if patient has the app installed
    if (!patient.expo_push_token) {
      Alert.alert('', s.videoCall.noAppInstalled[lang]);
      return;
    }

    const fee = patient.call_fee ?? 0;

    if (fee > 0) {
      Alert.alert(
        s.videoCall.callFee[lang],
        `${fee} ${lang === 'ar' ? 'جنيه' : 'EGP'}`,
        [
          { text: s.common.cancel[lang], style: 'cancel' },
          {
            text: s.videoCall.waiveFee[lang],
            onPress: () => initiateVideoCall(true),
          },
          {
            text: s.videoCall.payAndCall[lang],
            onPress: () => initiateVideoCall(false),
          },
        ]
      );
    } else {
      // Confirm before calling
      Alert.alert(
        s.videoCall.callGP[lang],
        patient.name,
        [
          { text: s.common.cancel[lang], style: 'cancel' },
          {
            text: s.common.confirm[lang],
            onPress: () => initiateVideoCall(false),
          },
        ]
      );
    }
  };

  const initiateVideoCall = async (waiveFee: boolean) => {
    if (!patient) return;
    setInitiatingCall(true);

    try {
      const { storage } = await import('@/lib/storage');
      const token = storage.getString('doctor-token') ?? '';

      const res = await fetch(`${API_BASE_URL}/api/telehealth/gp-room`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          patient_id: patient.id,
          waive_fee: waiveFee,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        router.push(`/(doctor)/video-call/${data.call_id}`);
      } else {
        const errorData = await res.json().catch(() => ({}));
        Alert.alert(
          s.common.error[lang],
          errorData.message ?? s.videoCall.couldNotReach[lang]
        );
      }
    } catch {
      Alert.alert(s.common.error[lang], s.videoCall.couldNotReach[lang]);
    } finally {
      setInitiatingCall(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color="#1A2F4A" />
        <Text style={styles.loadingText}>{s.common.loading[lang]}</Text>
      </View>
    );
  }

  if (!patient) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={styles.errorText}>{s.common.error[lang]}</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backLink}>{s.common.back[lang]}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const sexLabel = patient.sex === 'male'
    ? s.doctorConsultation.male[lang]
    : s.doctorConsultation.female[lang];

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.headerRow, isRtl && styles.rowRtl]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backBtn}>{isRtl ? '→' : '←'}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {patient.name}
          </Text>
          <View style={{ width: 32 }} />
        </View>
        <Text style={[styles.headerMeta, isRtl && styles.textRtl]}>
          {patient.age} {s.doctorConsultation.age[lang]} · {sexLabel}
        </Text>
      </View>

      <ScrollView
        style={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollInner}
      >
        {/* Vitals Summary */}
        <View style={styles.sectionCard}>
          <Text style={[styles.sectionTitle, isRtl && styles.textRtl]}>
            {s.doctorPatients.vitalsSummary[lang]}
          </Text>
          {patient.vitals.length === 0 ? (
            <Text style={[styles.emptyText, isRtl && styles.textRtl]}>
              {s.mobileRecord.noData[lang]}
            </Text>
          ) : (
            <View style={styles.vitalsGrid}>
              {patient.vitals.map((v, i) => (
                <View key={i} style={styles.vitalItem}>
                  <Text style={styles.vitalLabel}>{v.label}</Text>
                  <Text style={styles.vitalValue}>
                    {v.value} {v.unit}
                  </Text>
                  <Text style={styles.vitalDate}>{v.date}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Active Medications */}
        <View style={styles.sectionCard}>
          <Text style={[styles.sectionTitle, isRtl && styles.textRtl]}>
            {s.doctorConsultation.activeMedications[lang]}
          </Text>
          {patient.medications.length === 0 ? (
            <Text style={[styles.emptyText, isRtl && styles.textRtl]}>
              {s.doctorConsultation.noMedications[lang]}
            </Text>
          ) : (
            patient.medications.map((med, i) => (
              <View key={i} style={[styles.medRow, isRtl && styles.rowRtl]}>
                <Text style={[styles.medName, isRtl && styles.textRtl]}>
                  {med.name}
                </Text>
                <Text style={styles.medDose}>
                  {med.dose} · {med.frequency}
                </Text>
              </View>
            ))
          )}
        </View>

        {/* Lab History */}
        <View style={styles.sectionCard}>
          <Text style={[styles.sectionTitle, isRtl && styles.textRtl]}>
            {s.doctorPatients.labHistory[lang]}
          </Text>
          {patient.lab_results.length === 0 ? (
            <Text style={[styles.emptyText, isRtl && styles.textRtl]}>
              {s.doctorConsultation.noLabResults[lang]}
            </Text>
          ) : (
            patient.lab_results.map((lab, i) => (
              <View key={i} style={[styles.labRow, isRtl && styles.rowRtl]}>
                <View style={styles.labInfo}>
                  <Text style={[styles.labName, isRtl && styles.textRtl]}>
                    {lab.test_name}
                  </Text>
                  <Text style={[styles.labDate, isRtl && styles.textRtl]}>
                    {lab.date}
                  </Text>
                </View>
                <Text style={[
                  styles.labValue,
                  lab.is_abnormal && styles.labValueAbnormal,
                ]}>
                  {lab.value} {lab.unit}
                </Text>
              </View>
            ))
          )}
        </View>

        {/* Protocol Compliance */}
        {patient.protocol_compliance != null && (
          <View style={styles.sectionCard}>
            <Text style={[styles.sectionTitle, isRtl && styles.textRtl]}>
              {s.doctorPatients.protocolCompliance[lang]}
            </Text>
            <View style={styles.complianceBar}>
              <View
                style={[
                  styles.complianceFill,
                  { width: `${patient.protocol_compliance}%` },
                  patient.protocol_compliance < 50 && styles.complianceFillLow,
                  patient.protocol_compliance >= 50 && patient.protocol_compliance < 80 && styles.complianceFillMedium,
                ]}
              />
            </View>
            <Text style={styles.complianceText}>
              {patient.protocol_compliance}%
            </Text>
          </View>
        )}

        {/* GP Freestanding Note */}
        <View style={styles.sectionCard}>
          <Text style={[styles.sectionTitle, isRtl && styles.textRtl]}>
            {s.doctorPatients.clinicalNote[lang]}
          </Text>
          <TextInput
            style={[styles.noteInput, isRtl && styles.inputRtl]}
            placeholder={s.doctorPatients.clinicalNotePlaceholder[lang]}
            placeholderTextColor="#AAA"
            value={noteText}
            onChangeText={setNoteText}
            multiline
            numberOfLines={4}
          />
          <TouchableOpacity
            style={[styles.saveNoteBtn, savingNote && styles.btnDisabled]}
            onPress={handleSaveNote}
            disabled={savingNote || !noteText.trim()}
            activeOpacity={0.7}
          >
            <Text style={styles.saveNoteBtnText}>
              {s.doctorPatients.saveNote[lang]}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Video Call Button */}
        <TouchableOpacity
          style={[styles.videoCallBtn, initiatingCall && styles.videoCallBtnDisabled]}
          onPress={handleVideoCall}
          disabled={initiatingCall}
          activeOpacity={0.7}
        >
          {initiatingCall ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.videoCallBtnIcon}>📹</Text>
              <Text style={[styles.videoCallBtnText, isRtl && styles.textRtl]}>
                {s.videoCall.callGP[lang]}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Active Booking Navigation */}
        {patient.active_booking_id && (
          <TouchableOpacity
            style={styles.consultationBtn}
            onPress={() => router.push(`/(doctor)/consultation/${patient.active_booking_id}`)}
            activeOpacity={0.7}
          >
            <Text style={styles.consultationBtnText}>
              {s.doctorPatients.goToConsultation[lang]}
            </Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#888',
    fontFamily: 'Cairo',
    marginTop: 12,
  },
  errorText: {
    fontSize: 16,
    color: '#C62828',
    fontFamily: 'Cairo',
    marginBottom: 12,
  },
  backLink: {
    fontSize: 16,
    color: '#0D7A7A',
    fontFamily: 'Cairo-SemiBold',
  },
  header: {
    backgroundColor: '#1A2F4A',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowRtl: {
    flexDirection: 'row-reverse',
  },
  backBtn: {
    fontSize: 22,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    fontFamily: 'Cairo-Bold',
    flex: 1,
    textAlign: 'center',
  },
  headerMeta: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    fontFamily: 'Cairo',
    marginTop: 4,
  },
  textRtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  scrollContent: {
    flex: 1,
  },
  scrollInner: {
    padding: 16,
    gap: 12,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A2F4A',
    fontFamily: 'Cairo-SemiBold',
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    fontFamily: 'Cairo',
  },
  vitalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  vitalItem: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    minWidth: '45%',
    flex: 1,
  },
  vitalLabel: {
    fontSize: 12,
    color: '#888',
    fontFamily: 'Cairo',
    marginBottom: 4,
  },
  vitalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A2F4A',
    fontFamily: 'Cairo-Bold',
  },
  vitalDate: {
    fontSize: 11,
    color: '#AAA',
    fontFamily: 'Cairo',
    marginTop: 4,
  },
  medRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  medName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    fontFamily: 'Cairo-SemiBold',
    flex: 1,
  },
  medDose: {
    fontSize: 13,
    color: '#666',
    fontFamily: 'Cairo',
  },
  labRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  labInfo: {
    flex: 1,
  },
  labName: {
    fontSize: 14,
    color: '#333',
    fontFamily: 'Cairo',
  },
  labDate: {
    fontSize: 12,
    color: '#999',
    fontFamily: 'Cairo',
  },
  labValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2E7D32',
    fontFamily: 'Cairo-SemiBold',
  },
  labValueAbnormal: {
    color: '#C62828',
  },
  complianceBar: {
    height: 10,
    backgroundColor: '#F0F0F0',
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 6,
  },
  complianceFill: {
    height: '100%',
    backgroundColor: '#22C55E',
    borderRadius: 5,
  },
  complianceFillLow: {
    backgroundColor: '#EF4444',
  },
  complianceFillMedium: {
    backgroundColor: '#F59E0B',
  },
  complianceText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A2F4A',
    fontFamily: 'Cairo-Bold',
    textAlign: 'center',
  },
  noteInput: {
    backgroundColor: '#F9F9F9',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: 'Cairo',
    color: '#333',
    minHeight: 100,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#EEE',
    marginBottom: 10,
  },
  inputRtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  saveNoteBtn: {
    backgroundColor: '#0D7A7A',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  saveNoteBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'Cairo-SemiBold',
  },
  videoCallBtn: {
    backgroundColor: '#0D7A7A',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  videoCallBtnDisabled: {
    opacity: 0.5,
  },
  videoCallBtnIcon: {
    fontSize: 20,
  },
  videoCallBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Cairo-Bold',
  },
  consultationBtn: {
    backgroundColor: '#1A2F4A',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  consultationBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Cairo-SemiBold',
  },
});
