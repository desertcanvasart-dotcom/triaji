/**
 * Consultation Screen — pre-consultation view with patient data.
 * Shows patient header, BRS, allergies, chronic conditions,
 * medications, labs, previous notes, and action buttons.
 *
 * Phase 24: Added medication interaction banner at top.
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
import PatientSummary from '@/components/doctor/PatientSummary';
import PrescriptionForm from '@/components/doctor/PrescriptionForm';

const API_BASE_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'https://app.doctortrio.online';

// ─── Types ───────────────────────────────────────────────────────────────────

interface LabResult {
  test_name: string;
  value: string;
  unit: string;
  is_abnormal: boolean;
  date: string;
}

interface DoctorNote {
  doctor_name: string;
  note: string;
  date: string;
}

interface ConsultationData {
  patient_id: string;
  patient_name: string;
  patient_age: number;
  patient_sex: 'male' | 'female';
  appointment_time: string;
  brs_score?: number;
  brs_level?: string;
  allergies: string[];
  chronic_conditions: string[];
  medications: string[];
  recent_lab_results: LabResult[];
  previous_notes: DoctorNote[];
}

interface InteractionResult {
  drugA: string;
  drugB: string;
  severity: 'contraindicated' | 'major' | 'moderate' | 'minor';
  mechanismAr: string;
  mechanismEn: string;
  consequenceAr: string;
  consequenceEn: string;
  recommendationAr: string;
  recommendationEn: string;
  egyptNoteAr?: string;
  source: string;
}

interface CheckResult {
  interactions: InteractionResult[];
  highestSeverity: 'contraindicated' | 'major' | 'moderate' | 'minor' | null;
  hasBlocker: boolean;
  checkSource: string;
}

// ─── Interaction Strings ────────────────────────────────────────────────────

const INTERACTION_STRINGS = {
  existingInteractions: {
    ar: 'تفاعلات في أدوية المريض الحالية',
    en: "Interactions in patient's current medications",
  },
  checkingInteractions: {
    ar: 'جاري فحص التفاعلات بين أدوية المريض...',
    en: "Checking patient's medication interactions...",
  },
  mechanism: { ar: 'الآلية:', en: 'Mechanism:' },
  recommendation: { ar: 'التوصية:', en: 'Recommendation:' },
  severityLabels: {
    contraindicated: { ar: 'ممنوع الجمع', en: 'Contraindicated' },
    major: { ar: 'تفاعل خطير', en: 'Major' },
    moderate: { ar: 'تفاعل متوسط', en: 'Moderate' },
    minor: { ar: 'تفاعل بسيط', en: 'Minor' },
  },
} as const;

function severityColors(severity: InteractionResult['severity']): {
  bg: string;
  border: string;
  text: string;
  badgeBg: string;
  badgeText: string;
} {
  switch (severity) {
    case 'contraindicated':
    case 'major':
      return { bg: '#FEF2F2', border: '#FCA5A5', text: '#991B1B', badgeBg: '#DC2626', badgeText: '#FFFFFF' };
    case 'moderate':
      return { bg: '#FFFBEB', border: '#FCD34D', text: '#92400E', badgeBg: '#F59E0B', badgeText: '#FFFFFF' };
    case 'minor':
    default:
      return { bg: '#F9FAFB', border: '#E5E7EB', text: '#374151', badgeBg: '#E5E7EB', badgeText: '#374151' };
  }
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function ConsultationScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const { lang, isRtl } = useLang();
  const [data, setData] = useState<ConsultationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPrescription, setShowPrescription] = useState(false);
  const [showFollowUpPicker, setShowFollowUpPicker] = useState(false);
  const [followUpDateText, setFollowUpDateText] = useState('');
  const [followUpReason, setFollowUpReason] = useState('');
  const [savingFollowUp, setSavingFollowUp] = useState(false);

  // ── Interaction State ──────────────────────────────────────────────────────
  const [interactionsLoading, setInteractionsLoading] = useState(false);
  const [existingInteractions, setExistingInteractions] = useState<InteractionResult[]>([]);

  const fetchConsultation = useCallback(async () => {
    try {
      const { storage } = await import('@/lib/storage');
      const token = storage.getString('doctor-token') ?? '';

      const res = await fetch(
        `${API_BASE_URL}/api/doctor/consultation/${bookingId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    fetchConsultation();
  }, [fetchConsultation]);

  // ── Check Existing Medication Interactions ────────────────────────────────

  const checkMedicationInteractions = useCallback(async (patientId: string, medications: string[]) => {
    if (medications.length < 2) return;
    setInteractionsLoading(true);

    try {
      const { storage } = await import('@/lib/storage');
      const token = storage.getString('doctor-token') ?? '';
      const allInteractions: InteractionResult[] = [];
      const checked = new Set<string>();

      for (let i = 0; i < medications.length; i++) {
        const drugName = medications[i];
        const otherDrugs = medications
          .filter((_, j) => j !== i)
          .map((m) => ({ nameAr: m, nameEn: null as string | null }));

        // Deduplicate
        const pairKey = [drugName, ...otherDrugs.map((d) => d.nameAr)].sort().join('|');
        if (checked.has(pairKey)) continue;
        checked.add(pairKey);

        try {
          const res = await fetch(`${API_BASE_URL}/api/interactions/check`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              newDrug: { nameAr: drugName, nameEn: null },
              existingDrugs: otherDrugs,
              patientId,
              doctorAccountId: 'pre-consultation-check',
            }),
          });

          if (res.ok) {
            const result: CheckResult = await res.json();
            for (const interaction of result.interactions) {
              const key = [interaction.drugA, interaction.drugB].sort().join(':');
              if (!allInteractions.some((i) => [i.drugA, i.drugB].sort().join(':') === key)) {
                allInteractions.push(interaction);
              }
            }
          }
        } catch {
          // Individual check failed
        }
      }

      // Sort by severity
      const order = { contraindicated: 4, major: 3, moderate: 2, minor: 1 };
      allInteractions.sort((a, b) => (order[b.severity] ?? 0) - (order[a.severity] ?? 0));
      setExistingInteractions(allInteractions);
    } catch {
      // Silently fail
    } finally {
      setInteractionsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (data?.patient_id && data.medications.length >= 2) {
      checkMedicationInteractions(data.patient_id, data.medications);
    }
  }, [data?.patient_id, data?.medications, checkMedicationInteractions]);

  const handleSaveFollowUp = async () => {
    if (!followUpDateText.trim()) return;
    setSavingFollowUp(true);
    try {
      const { storage } = await import('@/lib/storage');
      const token = storage.getString('doctor-token') ?? '';

      await fetch(`${API_BASE_URL}/api/doctor/follow-up`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          booking_id: bookingId,
          patient_id: data?.patient_id,
          date: followUpDateText.trim(),
          reason: followUpReason.trim(),
        }),
      });

      Alert.alert('', s.doctorConsultation.followUpSaved[lang]);
      setShowFollowUpPicker(false);
      setFollowUpDateText('');
      setFollowUpReason('');
    } catch {
      Alert.alert('', s.common.error[lang]);
    } finally {
      setSavingFollowUp(false);
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

  if (!data) {
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

  // ── Interaction Banner Colors ─────────────────────────────────────────────

  const highestSeverity = existingInteractions.length > 0 ? existingInteractions[0].severity : null;
  const bannerBg =
    highestSeverity === 'contraindicated' || highestSeverity === 'major'
      ? '#FEF2F2'
      : highestSeverity === 'moderate'
        ? '#FFFBEB'
        : '#F9FAFB';
  const bannerBorder =
    highestSeverity === 'contraindicated' || highestSeverity === 'major'
      ? '#FCA5A5'
      : highestSeverity === 'moderate'
        ? '#FCD34D'
        : '#E5E7EB';
  const bannerTitleColor =
    highestSeverity === 'contraindicated' || highestSeverity === 'major'
      ? '#991B1B'
      : highestSeverity === 'moderate'
        ? '#92400E'
        : '#374151';

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.headerRow, isRtl && styles.rowRtl]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backBtn}>{isRtl ? '\u2192' : '\u2190'}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {s.doctorConsultation.title[lang]}
          </Text>
          <View style={{ width: 32 }} />
        </View>
      </View>

      <ScrollView
        style={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollInner}
      >
        {/* Interaction Loading Indicator */}
        {interactionsLoading && (
          <View style={[styles.interactionLoadingBanner, isRtl && { direction: 'rtl' }]}>
            <ActivityIndicator size="small" color="#0D7A7A" />
            <Text style={[styles.interactionLoadingText, isRtl && styles.textRtl]}>
              {INTERACTION_STRINGS.checkingInteractions[lang]}
            </Text>
          </View>
        )}

        {/* Medication Interaction Banner */}
        {existingInteractions.length > 0 && (
          <View
            style={[
              styles.interactionBanner,
              { backgroundColor: bannerBg, borderColor: bannerBorder },
            ]}
          >
            <View style={[styles.interactionBannerHeader, isRtl && styles.rowRtl]}>
              <Text style={{ fontSize: 16 }}>{'\u26A0\uFE0F'}</Text>
              <Text style={[styles.interactionBannerTitle, { color: bannerTitleColor }, isRtl && styles.textRtl]}>
                {INTERACTION_STRINGS.existingInteractions[lang]}
              </Text>
              <View style={styles.interactionCountBadge}>
                <Text style={styles.interactionCountText}>
                  {existingInteractions.length}
                </Text>
              </View>
            </View>

            {existingInteractions.map((interaction, idx) => {
              const colors = severityColors(interaction.severity);
              const mechanism = lang === 'ar' ? interaction.mechanismAr : interaction.mechanismEn;
              const recommendation = lang === 'ar' ? interaction.recommendationAr : interaction.recommendationEn;
              const severityLabel = INTERACTION_STRINGS.severityLabels[interaction.severity][lang];

              return (
                <View
                  key={`${interaction.drugA}-${interaction.drugB}-${idx}`}
                  style={[
                    styles.interactionItem,
                    { backgroundColor: colors.bg, borderColor: colors.border },
                  ]}
                >
                  <View style={[styles.interactionItemHeader, isRtl && styles.rowRtl]}>
                    <View style={[styles.severityBadge, { backgroundColor: colors.badgeBg }]}>
                      <Text style={[styles.severityBadgeText, { color: colors.badgeText }]}>
                        {severityLabel}
                      </Text>
                    </View>
                    <Text style={[styles.interactionDrugPair, { color: colors.text }, isRtl && styles.textRtl]}>
                      {interaction.drugA} + {interaction.drugB}
                    </Text>
                  </View>

                  {mechanism ? (
                    <Text style={[styles.interactionDetail, { color: colors.text }, isRtl && styles.textRtl]}>
                      <Text style={styles.interactionDetailLabel}>
                        {INTERACTION_STRINGS.mechanism[lang]}{' '}
                      </Text>
                      {mechanism}
                    </Text>
                  ) : null}

                  {recommendation ? (
                    <Text style={[styles.interactionDetail, { color: colors.text }, isRtl && styles.textRtl]}>
                      <Text style={styles.interactionDetailLabel}>
                        {INTERACTION_STRINGS.recommendation[lang]}{' '}
                      </Text>
                      {recommendation}
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}

        {/* Patient Summary Card */}
        <PatientSummary
          patient={{
            name: data.patient_name,
            age: data.patient_age,
            sex: data.patient_sex,
            brs_score: data.brs_score,
            brs_level: data.brs_level,
            allergies: data.allergies,
            chronic_conditions: data.chronic_conditions,
            medications: data.medications,
          }}
          lang={lang}
          isRtl={isRtl}
        />

        {/* Appointment Time */}
        <View style={styles.infoCard}>
          <Text style={[styles.sectionLabel, isRtl && styles.textRtl]}>
            {s.doctorConsultation.appointmentTime[lang]}
          </Text>
          <Text style={[styles.infoValue, isRtl && styles.textRtl]}>
            {data.appointment_time}
          </Text>
        </View>

        {/* Recent Lab Results */}
        <View style={styles.sectionCard}>
          <Text style={[styles.sectionTitle, isRtl && styles.textRtl]}>
            {s.doctorConsultation.recentLabResults[lang]}
          </Text>
          {data.recent_lab_results.length === 0 ? (
            <Text style={[styles.emptyText, isRtl && styles.textRtl]}>
              {s.doctorConsultation.noLabResults[lang]}
            </Text>
          ) : (
            data.recent_lab_results.slice(0, 3).map((lab, i) => (
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

        {/* Previous Doctor Notes */}
        <View style={styles.sectionCard}>
          <Text style={[styles.sectionTitle, isRtl && styles.textRtl]}>
            {s.doctorConsultation.previousNotes[lang]}
          </Text>
          {data.previous_notes.length === 0 ? (
            <Text style={[styles.emptyText, isRtl && styles.textRtl]}>
              {s.doctorConsultation.noPreviousNotes[lang]}
            </Text>
          ) : (
            data.previous_notes.map((note, i) => (
              <View key={i} style={styles.noteItem}>
                <Text style={[styles.noteDoctor, isRtl && styles.textRtl]}>
                  {note.doctor_name} — {note.date}
                </Text>
                <Text style={[styles.noteText, isRtl && styles.textRtl]}>
                  {note.note}
                </Text>
              </View>
            ))
          )}
        </View>

        {/* Follow-up picker (inline) */}
        {showFollowUpPicker && (
          <View style={styles.sectionCard}>
            <Text style={[styles.sectionTitle, isRtl && styles.textRtl]}>
              {s.doctorConsultation.scheduleFollowUp[lang]}
            </Text>
            <TextInput
              style={[styles.followUpInput, isRtl && styles.textRtl]}
              placeholder={lang === 'ar' ? 'مثال: 2026-04-15' : 'e.g. 2026-04-15'}
              placeholderTextColor="#AAA"
              value={followUpDateText}
              onChangeText={setFollowUpDateText}
              keyboardType="numbers-and-punctuation"
            />
            <TextInput
              style={[styles.followUpInput, isRtl && styles.textRtl]}
              placeholder={s.doctorConsultation.followUpReasonPlaceholder[lang]}
              placeholderTextColor="#AAA"
              value={followUpReason}
              onChangeText={setFollowUpReason}
            />
            <TouchableOpacity
              style={[styles.saveFollowUpBtn, savingFollowUp && styles.btnDisabled]}
              onPress={handleSaveFollowUp}
              disabled={savingFollowUp || !followUpDateText.trim()}
            >
              <Text style={styles.saveFollowUpBtnText}>
                {s.doctorConsultation.saveFollowUp[lang]}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => setShowPrescription(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.actionIcon}>{'\uD83D\uDC8A'}</Text>
            <Text style={styles.actionText}>
              {s.doctorConsultation.writePrescription[lang]}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnOutline]}
            activeOpacity={0.7}
            onPress={() => Alert.alert('', s.doctorConsultation.useWebForLabs[lang])}
          >
            <Text style={styles.actionIcon}>{'\uD83E\uDDEA'}</Text>
            <Text style={styles.actionTextOutline}>
              {s.doctorConsultation.orderLabs[lang]}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnOutline]}
            onPress={() => setShowFollowUpPicker(!showFollowUpPicker)}
            activeOpacity={0.7}
          >
            <Text style={styles.actionIcon}>{'\uD83D\uDCC5'}</Text>
            <Text style={styles.actionTextOutline}>
              {s.doctorConsultation.scheduleFollowUp[lang]}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnOutline]}
            activeOpacity={0.7}
            onPress={() => Alert.alert('', s.doctorConsultation.useWebForReferrals[lang])}
          >
            <Text style={styles.actionIcon}>{'\uD83D\uDD00'}</Text>
            <Text style={styles.actionTextOutline}>
              {s.doctorConsultation.referPatient[lang]}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Prescription Modal */}
      {showPrescription && data && (
        <PrescriptionForm
          patientId={data.patient_id}
          patientName={data.patient_name}
          bookingId={bookingId ?? ''}
          lang={lang}
          isRtl={isRtl}
          onClose={() => setShowPrescription(false)}
          onSaved={() => setShowPrescription(false)}
        />
      )}
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
    paddingBottom: 40,
    gap: 12,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
    fontFamily: 'Cairo-SemiBold',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 15,
    color: '#1A2F4A',
    fontFamily: 'Cairo',
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
  noteItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    paddingVertical: 8,
  },
  noteDoctor: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    fontFamily: 'Cairo-SemiBold',
    marginBottom: 4,
  },
  noteText: {
    fontSize: 14,
    color: '#333',
    fontFamily: 'Cairo',
    lineHeight: 22,
  },
  followUpInput: {
    backgroundColor: '#F9F9F9',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: 'Cairo',
    color: '#333',
    borderWidth: 1,
    borderColor: '#EEE',
    marginBottom: 8,
  },
  saveFollowUpBtn: {
    backgroundColor: '#0D7A7A',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  saveFollowUpBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'Cairo-SemiBold',
  },
  actionsContainer: {
    gap: 10,
  },
  actionBtn: {
    backgroundColor: '#1A2F4A',
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionBtnOutline: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#1A2F4A',
  },
  actionIcon: {
    fontSize: 18,
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'Cairo-SemiBold',
  },
  actionTextOutline: {
    color: '#1A2F4A',
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'Cairo-SemiBold',
  },

  // ── Interaction Styles ──────────────────────────────────────────────────
  interactionLoadingBanner: {
    backgroundColor: '#F0FDFA',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#99F6E4',
  },
  interactionLoadingText: {
    fontSize: 13,
    color: '#0D7A7A',
    fontFamily: 'Cairo',
    flex: 1,
  },
  interactionBanner: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 2,
  },
  interactionBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  interactionBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Cairo-Bold',
    flex: 1,
  },
  interactionCountBadge: {
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  interactionCountText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    fontFamily: 'Cairo-SemiBold',
  },
  interactionItem: {
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    marginBottom: 6,
  },
  interactionItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  severityBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  severityBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: 'Cairo-SemiBold',
  },
  interactionDrugPair: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Cairo-SemiBold',
    flex: 1,
  },
  interactionDetail: {
    fontSize: 12,
    fontFamily: 'Cairo',
    lineHeight: 18,
    opacity: 0.85,
  },
  interactionDetailLabel: {
    fontWeight: '600',
    fontFamily: 'Cairo-SemiBold',
  },
});
