/**
 * Prescription Status Tracker — 5-step vertical timeline showing
 * prescription fulfillment status from sent to collected.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useLang } from '@/hooks/useLang';
import { api } from '@/lib/api';
import { s } from '@triaji/shared/i18n';

type PrescriptionStep = 'sent' | 'received' | 'preparing' | 'ready' | 'collected';

interface StepData {
  key: PrescriptionStep;
  timestamp?: string;
  completed: boolean;
}

interface PrescriptionDetail {
  id: string;
  status: PrescriptionStep;
  pharmacyName: string;
  pharmacyAddress: string;
  pharmacyLat?: number;
  pharmacyLng?: number;
  medications: { name: string; dose: string }[];
  estimatedReadyTime?: string;
  steps: StepData[];
}

const STEP_ORDER: PrescriptionStep[] = ['sent', 'received', 'preparing', 'ready', 'collected'];

function getStepLabel(step: PrescriptionStep, lang: 'ar' | 'en'): string {
  const map: Record<PrescriptionStep, { ar: string; en: string }> = {
    sent: s.mobilePharmacy.sent,
    received: s.mobilePharmacy.received,
    preparing: s.mobilePharmacy.preparing,
    ready: s.mobilePharmacy.ready,
    collected: s.mobilePharmacy.collected,
  };
  return map[step][lang];
}

function getStepIcon(step: PrescriptionStep, completed: boolean, isCurrent: boolean): string {
  if (completed) return '\u2705';
  if (isCurrent) return '\u{1F504}';
  return '\u26AA';
}

export default function PrescriptionTrackerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { lang, isRtl } = useLang();
  const [prescription, setPrescription] = useState<PrescriptionDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPrescription = useCallback(async () => {
    try {
      const data = await api.get(`/api/patient/pharmacy/prescription/${id}`);
      const rx = data as PrescriptionDetail;

      // Build steps from status if not provided by API
      if (!rx.steps || rx.steps.length === 0) {
        const currentIdx = STEP_ORDER.indexOf(rx.status);
        rx.steps = STEP_ORDER.map((step, idx) => ({
          key: step,
          completed: idx <= currentIdx,
          timestamp: idx <= currentIdx ? undefined : undefined,
        }));
      }

      setPrescription(rx);
    } catch {
      Alert.alert(s.common.error[lang]);
    } finally {
      setLoading(false);
    }
  }, [id, lang]);

  useEffect(() => {
    fetchPrescription();
  }, [fetchPrescription]);

  const handleOpenMaps = useCallback(() => {
    if (!prescription) return;

    let url: string;
    if (prescription.pharmacyLat && prescription.pharmacyLng) {
      const label = encodeURIComponent(prescription.pharmacyName);
      url = Platform.select({
        ios: `maps:0,0?q=${label}@${prescription.pharmacyLat},${prescription.pharmacyLng}`,
        android: `geo:${prescription.pharmacyLat},${prescription.pharmacyLng}?q=${label}`,
      }) ?? `https://www.google.com/maps/search/?api=1&query=${prescription.pharmacyLat},${prescription.pharmacyLng}`;
    } else {
      const query = encodeURIComponent(prescription.pharmacyAddress);
      url = `https://www.google.com/maps/search/?api=1&query=${query}`;
    }

    Linking.openURL(url).catch(() => {
      Alert.alert(s.common.error[lang]);
    });
  }, [prescription, lang]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0D7A7A" />
      </View>
    );
  }

  if (!prescription) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{s.common.error[lang]}</Text>
      </View>
    );
  }

  const formatTime = (ts?: string) => {
    if (!ts) return '';
    return new Date(ts).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const currentStepIdx = STEP_ORDER.indexOf(prescription.status);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backBtn}>{isRtl ? '\u203A' : '\u2039'}</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, isRtl && styles.textRtl]}>
          {s.mobilePharmacy.prescriptionStatus[lang]}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Warning banner */}
        <View style={styles.warningBanner}>
          <Text style={[styles.warningText, isRtl && styles.textRtl]}>
            {'\u26A0\uFE0F'} {s.mobilePharmacy.bringPrescription[lang]}
          </Text>
        </View>

        {/* Vertical timeline */}
        <View style={styles.timeline}>
          {STEP_ORDER.map((step, idx) => {
            const stepData = prescription.steps[idx];
            const isCurrent = idx === currentStepIdx;
            const isCompleted = stepData?.completed ?? (idx <= currentStepIdx);
            const isLast = idx === STEP_ORDER.length - 1;
            const icon = getStepIcon(step, isCompleted, isCurrent);

            return (
              <View key={step} style={[styles.timelineStep, isRtl && styles.timelineStepRtl]}>
                {/* Line + dot column */}
                <View style={styles.timelineDotColumn}>
                  <Text style={[styles.timelineIcon, isCurrent && styles.timelineIconCurrent]}>
                    {icon}
                  </Text>
                  {!isLast && (
                    <View
                      style={[
                        styles.timelineLine,
                        isCompleted && styles.timelineLineCompleted,
                      ]}
                    />
                  )}
                </View>

                {/* Content */}
                <View style={styles.timelineContent}>
                  <Text
                    style={[
                      styles.stepLabel,
                      isCompleted && styles.stepLabelCompleted,
                      isCurrent && styles.stepLabelCurrent,
                      isRtl && styles.textRtl,
                    ]}
                  >
                    {getStepLabel(step, lang)}
                  </Text>
                  {stepData?.timestamp && (
                    <Text style={[styles.stepTime, isRtl && styles.textRtl]}>
                      {formatTime(stepData.timestamp)}
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {/* Pharmacy info */}
        <View style={styles.infoCard}>
          <Text style={[styles.infoTitle, isRtl && styles.textRtl]}>
            {s.mobilePharmacy.pharmacyName[lang]}
          </Text>
          <Text style={[styles.infoValue, isRtl && styles.textRtl]}>
            {prescription.pharmacyName}
          </Text>

          <Text style={[styles.infoTitle, isRtl && styles.textRtl]}>
            {s.mobilePharmacy.pharmacyAddress[lang]}
          </Text>
          <Text style={[styles.infoValue, isRtl && styles.textRtl]}>
            {prescription.pharmacyAddress}
          </Text>

          {prescription.estimatedReadyTime && (
            <>
              <Text style={[styles.infoTitle, isRtl && styles.textRtl]}>
                {s.mobilePharmacy.estimatedReady[lang]}
              </Text>
              <Text style={[styles.infoValue, isRtl && styles.textRtl]}>
                {formatTime(prescription.estimatedReadyTime)}
              </Text>
            </>
          )}
        </View>

        {/* Open in Maps */}
        <TouchableOpacity
          style={styles.mapsBtn}
          onPress={handleOpenMaps}
          activeOpacity={0.7}
        >
          <Text style={styles.mapsBtnText}>
            {'\u{1F4CD}'} {s.mobilePharmacy.openInMaps[lang]}
          </Text>
        </TouchableOpacity>

        {/* Medications list */}
        <View style={styles.medsCard}>
          <Text style={[styles.medsTitle, isRtl && styles.textRtl]}>
            {s.mobilePharmacy.medications[lang]}
          </Text>
          {prescription.medications.map((med, idx) => (
            <View key={idx} style={[styles.medRow, isRtl && styles.rowRtl]}>
              <Text style={styles.medIcon}>{'\u{1F48A}'}</Text>
              <View style={styles.medInfo}>
                <Text style={[styles.medName, isRtl && styles.textRtl]}>{med.name}</Text>
                <Text style={[styles.medDose, isRtl && styles.textRtl]}>{med.dose}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    backgroundColor: '#0D7A7A',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    fontSize: 28,
    color: '#FFFFFF',
    fontWeight: '300',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    fontFamily: 'Cairo-Bold',
    flex: 1,
  },
  headerSpacer: {
    width: 40,
  },
  textRtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  rowRtl: {
    flexDirection: 'row-reverse',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#C62828',
    fontFamily: 'Cairo-SemiBold',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  // Warning banner
  warningBanner: {
    backgroundColor: '#FFF8E1',
    borderWidth: 1,
    borderColor: '#FFE082',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  warningText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E65100',
    fontFamily: 'Cairo-SemiBold',
  },
  // Timeline
  timeline: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  timelineStep: {
    flexDirection: 'row',
    minHeight: 56,
  },
  timelineStepRtl: {
    flexDirection: 'row-reverse',
  },
  timelineDotColumn: {
    width: 32,
    alignItems: 'center',
  },
  timelineIcon: {
    fontSize: 18,
  },
  timelineIconCurrent: {
    fontSize: 22,
  },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: '#E0E0E0',
    marginVertical: 4,
  },
  timelineLineCompleted: {
    backgroundColor: '#0D7A7A',
  },
  timelineContent: {
    flex: 1,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  stepLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#999',
    fontFamily: 'Cairo',
  },
  stepLabelCompleted: {
    color: '#1A2F4A',
    fontWeight: '600',
    fontFamily: 'Cairo-SemiBold',
  },
  stepLabelCurrent: {
    color: '#0D7A7A',
    fontWeight: '700',
    fontFamily: 'Cairo-Bold',
  },
  stepTime: {
    fontSize: 12,
    color: '#888',
    fontFamily: 'Cairo',
    marginTop: 2,
  },
  // Pharmacy info
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  infoTitle: {
    fontSize: 12,
    color: '#999',
    fontFamily: 'Cairo',
    marginTop: 8,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A2F4A',
    fontFamily: 'Cairo-SemiBold',
    marginTop: 2,
  },
  // Maps button
  mapsBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#0D7A7A',
  },
  mapsBtnText: {
    color: '#0D7A7A',
    fontSize: 15,
    fontWeight: '700',
    fontFamily: 'Cairo-Bold',
  },
  // Medications
  medsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  medsTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A2F4A',
    fontFamily: 'Cairo-SemiBold',
    marginBottom: 10,
  },
  medRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  medIcon: {
    fontSize: 18,
  },
  medInfo: {
    flex: 1,
  },
  medName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A2F4A',
    fontFamily: 'Cairo-SemiBold',
  },
  medDose: {
    fontSize: 13,
    color: '#888',
    fontFamily: 'Cairo',
    marginTop: 2,
  },
});
