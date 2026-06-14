/**
 * PostCallForm — Doctor post-call clinical form.
 * Fetches call data + transcription status, pre-fills from Claude extraction.
 * Provides action buttons: prescription, labs, follow-up, save notes.
 * Creates health_records with document_type='gp_video_consultation'.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import type { Lang } from '@triaji/shared/i18n';
import { s } from '@triaji/shared/i18n';

const API_BASE_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'https://app.triajji.com';

// ─── Types ──────────────────────────────────────────────────────────────────

interface PostCallFormProps {
  callId: string;
  lang: Lang;
}

interface CallData {
  id: string;
  patient_name: string;
  patient_age: number | null;
  duration_seconds: number;
  structured_notes_ar: string | null;
  transcription_status: 'pending' | 'processing' | 'ready' | null;
  ai_chief_complaint: string | null;
  ai_assessment: string | null;
  ai_plan: string | null;
  gp_video_call_id: string;
  patient_id: string;
  doctor_account_id: string;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function PostCallForm({ callId, lang }: PostCallFormProps) {
  const isRtl = lang === 'ar';

  // Data state
  const [callData, setCallData] = useState<CallData | null>(null);
  const [loading, setLoading] = useState(true);

  // Editable fields
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [assessment, setAssessment] = useState('');
  const [plan, setPlan] = useState('');
  const [doctorNotes, setDoctorNotes] = useState('');

  // Follow-up scheduling
  const [showFollowUpPicker, setShowFollowUpPicker] = useState(false);
  const [followUpDate, setFollowUpDate] = useState<Date | null>(null);

  // Saving state
  const [saving, setSaving] = useState(false);
  const [saveAction, setSaveAction] = useState<string | null>(null);

  // ─── Helpers ────────────────────────────────────────────────────────────

  const getToken = async (): Promise<string> => {
    const { storage } = await import('@/lib/storage');
    return storage.getString('doctor-token') ?? '';
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // ─── Fetch call data ───────────────────────────────────────────────────

  const fetchCallData = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE_URL}/api/telehealth/gp-call/${callId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) return;

      const data: CallData = await res.json();
      setCallData(data);

      // Pre-fill from in-call draft notes
      if (data.structured_notes_ar) {
        setDoctorNotes(data.structured_notes_ar);
      }

      // Pre-fill from AI extraction if transcription is ready
      if (data.transcription_status === 'ready') {
        if (data.ai_chief_complaint) setChiefComplaint(data.ai_chief_complaint);
        if (data.ai_assessment) setAssessment(data.ai_assessment);
        if (data.ai_plan) setPlan(data.ai_plan);
      }
    } catch {
      // Silent
    } finally {
      setLoading(false);
    }
  }, [callId]);

  useEffect(() => {
    fetchCallData();
  }, [fetchCallData]);

  // ─── Save clinical notes → health_records ─────────────────────────────

  const saveNotes = async (action: 'notes_only' | 'prescription' | 'labs' | 'follow_up') => {
    setSaving(true);
    setSaveAction(action);

    try {
      const token = await getToken();

      // Create health record
      const healthRecord = {
        patient_id: callData?.patient_id,
        document_type: 'gp_video_consultation',
        gp_video_call_id: callData?.gp_video_call_id ?? callId,
        chief_complaint: chiefComplaint || null,
        assessment: assessment || null,
        plan: plan || null,
        doctor_notes: doctorNotes || null,
        follow_up_date: followUpDate?.toISOString() ?? null,
      };

      const res = await fetch(`${API_BASE_URL}/api/telehealth/gp-call/${callId}/clinical-notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(healthRecord),
      });

      if (!res.ok) {
        Alert.alert('', s.common.error[lang]);
        return;
      }

      // Navigate based on action
      switch (action) {
        case 'prescription':
          router.push({
            pathname: '/(doctor)/prescription/new',
            params: { callId, patientId: callData?.patient_id ?? '' },
          });
          break;

        case 'labs':
          router.push({
            pathname: '/(doctor)/lab-order/new',
            params: { callId, patientId: callData?.patient_id ?? '' },
          });
          break;

        case 'follow_up':
          if (followUpDate) {
            // Save follow-up schedule via separate endpoint
            await fetch(`${API_BASE_URL}/api/gp/follow-up`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                patient_id: callData?.patient_id,
                doctor_account_id: callData?.doctor_account_id,
                scheduled_date: followUpDate.toISOString(),
                source: 'video_call',
                source_id: callId,
              }),
            });

            Alert.alert('', s.videoCall.followUpSaved[lang], [
              { text: s.common.confirm[lang], onPress: () => router.replace('/(doctor)') },
            ]);
          } else {
            setShowFollowUpPicker(true);
          }
          break;

        case 'notes_only':
        default:
          Alert.alert('', s.videoCall.noteSavedSuccess[lang], [
            { text: s.common.confirm[lang], onPress: () => router.replace('/(doctor)') },
          ]);
          break;
      }
    } catch {
      Alert.alert('', s.common.error[lang]);
    } finally {
      setSaving(false);
      setSaveAction(null);
    }
  };

  // ─── Follow-up date handler ───────────────────────────────────────────

  const handleFollowUpDateChange = (_event: unknown, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowFollowUpPicker(false);
    }
    if (selectedDate) {
      setFollowUpDate(selectedDate);
    }
  };

  const confirmFollowUp = () => {
    setShowFollowUpPicker(false);
    if (followUpDate) {
      saveNotes('follow_up');
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#1A2F4A" />
        <Text style={styles.loadingText}>{s.common.loading[lang]}</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollInner}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* ── Header: Patient info ── */}
      <View style={styles.headerCard}>
        <Text style={[styles.patientName, isRtl && styles.textRtl]}>
          {callData?.patient_name ?? '—'}
        </Text>
        <View style={[styles.metaRow, isRtl && styles.rowRtl]}>
          {callData?.patient_age != null && (
            <Text style={styles.metaText}>
              {s.videoCall.patientAge[lang]}: {callData.patient_age} {s.videoCall.years[lang]}
            </Text>
          )}
          {callData && (
            <Text style={styles.metaText}>
              {s.videoCall.duration[lang]}: {formatDuration(callData.duration_seconds)}
            </Text>
          )}
        </View>
      </View>

      {/* ── Transcription status banner ── */}
      {callData?.transcription_status === 'processing' && (
        <View style={styles.processingBanner}>
          <ActivityIndicator size="small" color="#1565C0" />
          <Text style={[styles.processingText, isRtl && styles.textRtl]}>
            {s.videoCall.transcriptionProcessing[lang]}
          </Text>
        </View>
      )}

      {callData?.transcription_status === 'ready' && (
        <TouchableOpacity
          style={styles.readyBanner}
          onPress={() =>
            router.push({
              pathname: '/(doctor)/video-call/transcription/[callId]' as never,
              params: { callId },
            })
          }
          activeOpacity={0.7}
        >
          <Text style={[styles.readyText, isRtl && styles.textRtl]}>
            {s.videoCall.transcriptionReady[lang]}
          </Text>
          <Text style={styles.viewLink}>{s.videoCall.viewTranscription[lang]} &rarr;</Text>
        </TouchableOpacity>
      )}

      {/* ── AI-Extracted Notes (if transcription ready) ── */}
      {callData?.transcription_status === 'ready' && (
        <View style={styles.sectionCard}>
          <Text style={[styles.sectionTitle, isRtl && styles.textRtl]}>
            {s.videoCall.aiExtractedNotes[lang]}
          </Text>

          {/* Chief Complaint */}
          <Text style={[styles.fieldLabel, isRtl && styles.textRtl]}>
            {s.videoCall.chiefComplaint[lang]}
          </Text>
          <TextInput
            style={[styles.fieldInput, isRtl && styles.inputRtl]}
            value={chiefComplaint}
            onChangeText={setChiefComplaint}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            placeholderTextColor="#AAA"
          />

          {/* Assessment */}
          <Text style={[styles.fieldLabel, isRtl && styles.textRtl]}>
            {s.videoCall.assessment[lang]}
          </Text>
          <TextInput
            style={[styles.fieldInput, isRtl && styles.inputRtl]}
            value={assessment}
            onChangeText={setAssessment}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            placeholderTextColor="#AAA"
          />

          {/* Plan */}
          <Text style={[styles.fieldLabel, isRtl && styles.textRtl]}>
            {s.videoCall.planLabel[lang]}
          </Text>
          <TextInput
            style={[styles.fieldInput, isRtl && styles.inputRtl]}
            value={plan}
            onChangeText={setPlan}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            placeholderTextColor="#AAA"
          />
        </View>
      )}

      {/* ── No recording: empty note fields ── */}
      {!callData?.transcription_status && (
        <View style={styles.sectionCard}>
          <Text style={[styles.sectionTitle, isRtl && styles.textRtl]}>
            {s.videoCall.extractedNotes[lang]}
          </Text>

          <Text style={[styles.fieldLabel, isRtl && styles.textRtl]}>
            {s.videoCall.chiefComplaint[lang]}
          </Text>
          <TextInput
            style={[styles.fieldInput, isRtl && styles.inputRtl]}
            value={chiefComplaint}
            onChangeText={setChiefComplaint}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            placeholderTextColor="#AAA"
          />

          <Text style={[styles.fieldLabel, isRtl && styles.textRtl]}>
            {s.videoCall.assessment[lang]}
          </Text>
          <TextInput
            style={[styles.fieldInput, isRtl && styles.inputRtl]}
            value={assessment}
            onChangeText={setAssessment}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            placeholderTextColor="#AAA"
          />

          <Text style={[styles.fieldLabel, isRtl && styles.textRtl]}>
            {s.videoCall.planLabel[lang]}
          </Text>
          <TextInput
            style={[styles.fieldInput, isRtl && styles.inputRtl]}
            value={plan}
            onChangeText={setPlan}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            placeholderTextColor="#AAA"
          />
        </View>
      )}

      {/* ── Doctor's own notes ── */}
      <View style={styles.sectionCard}>
        <Text style={[styles.sectionTitle, isRtl && styles.textRtl]}>
          {s.videoCall.doctorNotes[lang]}
        </Text>
        <TextInput
          style={[styles.notesInput, isRtl && styles.inputRtl]}
          placeholder={s.videoCall.editNotes[lang]}
          placeholderTextColor="#AAA"
          value={doctorNotes}
          onChangeText={setDoctorNotes}
          multiline
          numberOfLines={6}
          textAlignVertical="top"
        />
      </View>

      {/* ── 4 Action Buttons ── */}
      <View style={styles.actionsGrid}>
        {/* Prescription */}
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => saveNotes('prescription')}
          disabled={saving}
          activeOpacity={0.7}
        >
          {saving && saveAction === 'prescription' ? (
            <ActivityIndicator size="small" color="#1A2F4A" />
          ) : (
            <>
              <Text style={styles.actionIcon}>💊</Text>
              <Text style={[styles.actionLabel, isRtl && styles.textRtl]}>
                {s.videoCall.writePrescription[lang]}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Labs */}
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => saveNotes('labs')}
          disabled={saving}
          activeOpacity={0.7}
        >
          {saving && saveAction === 'labs' ? (
            <ActivityIndicator size="small" color="#1A2F4A" />
          ) : (
            <>
              <Text style={styles.actionIcon}>🧪</Text>
              <Text style={[styles.actionLabel, isRtl && styles.textRtl]}>
                {s.videoCall.orderLabs[lang]}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Follow-up */}
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => {
            if (followUpDate) {
              saveNotes('follow_up');
            } else {
              setShowFollowUpPicker(true);
            }
          }}
          disabled={saving}
          activeOpacity={0.7}
        >
          {saving && saveAction === 'follow_up' ? (
            <ActivityIndicator size="small" color="#1A2F4A" />
          ) : (
            <>
              <Text style={styles.actionIcon}>📅</Text>
              <Text style={[styles.actionLabel, isRtl && styles.textRtl]}>
                {s.videoCall.scheduleFollowUp[lang]}
              </Text>
              {followUpDate && (
                <Text style={styles.followUpDateLabel}>
                  {followUpDate.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US')}
                </Text>
              )}
            </>
          )}
        </TouchableOpacity>

        {/* Save notes only */}
        <TouchableOpacity
          style={[styles.actionBtn, styles.saveOnlyBtn]}
          onPress={() => saveNotes('notes_only')}
          disabled={saving}
          activeOpacity={0.7}
        >
          {saving && saveAction === 'notes_only' ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.actionIcon}>📝</Text>
              <Text style={[styles.actionLabel, styles.saveOnlyLabel, isRtl && styles.textRtl]}>
                {s.videoCall.saveNotesOnly[lang]}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Follow-up Date Picker ── */}
      {showFollowUpPicker && (
        <View style={styles.datePickerContainer}>
          <Text style={[styles.datePickerTitle, isRtl && styles.textRtl]}>
            {s.videoCall.selectDate[lang]}
          </Text>
          <DateTimePicker
            value={followUpDate ?? new Date(Date.now() + 7 * 24 * 3600 * 1000)}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            minimumDate={new Date(Date.now() + 24 * 3600 * 1000)}
            onChange={handleFollowUpDateChange}
            locale={lang === 'ar' ? 'ar-EG' : 'en-US'}
          />
          {Platform.OS === 'ios' && (
            <TouchableOpacity style={styles.confirmDateBtn} onPress={confirmFollowUp}>
              <Text style={styles.confirmDateText}>{s.common.confirm[lang]}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#888',
    fontFamily: 'Cairo',
  },
  scrollInner: {
    padding: 16,
    gap: 14,
  },
  textRtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  rowRtl: {
    flexDirection: 'row-reverse',
  },
  inputRtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  // Header card
  headerCard: {
    backgroundColor: '#1A2F4A',
    borderRadius: 14,
    padding: 18,
  },
  patientName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    fontFamily: 'Cairo-Bold',
  },
  metaRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 6,
  },
  metaText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    fontFamily: 'Cairo',
  },

  // Transcription banners
  processingBanner: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  processingText: {
    fontSize: 14,
    color: '#1565C0',
    fontFamily: 'Cairo-SemiBold',
    flex: 1,
  },
  readyBanner: {
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  readyText: {
    fontSize: 14,
    color: '#2E7D32',
    fontFamily: 'Cairo-SemiBold',
    fontWeight: '600',
    flex: 1,
  },
  viewLink: {
    fontSize: 13,
    color: '#2E7D32',
    fontFamily: 'Cairo',
    textDecorationLine: 'underline',
  },

  // Section card
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
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    fontFamily: 'Cairo-SemiBold',
    marginBottom: 4,
    marginTop: 8,
  },
  fieldInput: {
    backgroundColor: '#F9F9F9',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: 'Cairo',
    color: '#333',
    minHeight: 70,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#EEE',
  },
  notesInput: {
    backgroundColor: '#F9F9F9',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: 'Cairo',
    color: '#333',
    minHeight: 120,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#EEE',
  },

  // Action buttons grid
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionBtn: {
    width: '48%' as unknown as number,
    flexGrow: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    minHeight: 90,
    justifyContent: 'center',
  },
  saveOnlyBtn: {
    backgroundColor: '#0D7A7A',
    borderColor: '#0D7A7A',
  },
  actionIcon: {
    fontSize: 24,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1A2F4A',
    fontFamily: 'Cairo-SemiBold',
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  saveOnlyLabel: {
    color: '#FFFFFF',
  },
  followUpDateLabel: {
    fontSize: 11,
    color: '#0D7A7A',
    fontFamily: 'Cairo',
    marginTop: 2,
  },

  // Date picker
  datePickerContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
  },
  datePickerTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A2F4A',
    fontFamily: 'Cairo-SemiBold',
    marginBottom: 10,
  },
  confirmDateBtn: {
    backgroundColor: '#0D7A7A',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  confirmDateText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'Cairo-SemiBold',
  },
});
