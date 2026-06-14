/**
 * Medical Record Dashboard — full patient longitudinal record.
 * Sections: AllergyBanner, summary cards, active medications, vital trends,
 * follow-up appointments, protocol compliance, log vitals, share record.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Share,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useLang } from '@/hooks/useLang';
import { isAuthenticated } from '@/lib/storage';
import { api } from '@/lib/api';
import { s } from '@triaji/shared/i18n';
import { cacheData, getCachedData } from '@/lib/storage/cache';

import AllergyBanner from '@/components/medical-record/AllergyBanner';
import MedicationCard from '@/components/medical-record/MedicationCard';
import VitalTrendChart from '@/components/medical-record/VitalTrendChart';
import FollowUpCard from '@/components/medical-record/FollowUpCard';
import ProtocolCompliance from '@/components/medical-record/ProtocolCompliance';
import VitalsSheet from '@/components/shared/VitalsSheet';
import OfflineBanner from '@/components/shared/OfflineBanner';

interface Medication {
  name: string;
  dosage: string;
  dose: string;
  frequency: string;
  adherencePct?: number;
}

interface FollowUp {
  id: string;
  doctorName: string;
  doctorId?: string;
  specialty: string;
  date: string;
  isOverdue: boolean;
}

interface VitalSeries {
  label: string;
  unit: string;
  data: { date: string; value: number }[];
  normalRange?: { min: number; max: number };
}

interface ProtocolData {
  condition: string;
  compliancePct: number;
  overdueItems: string[];
}

interface MedicalRecordData {
  allergies: string[];
  medications: Medication[];
  conditions: string[];
  followUps: FollowUp[];
  vitalSeries: VitalSeries[];
  protocols: ProtocolData[];
  summary: {
    riskLevel?: string;
    medicationCount?: number;
    nextAppointment?: string;
    latestHba1c?: number;
  };
}

const CACHE_KEY = 'medical-record';
const CACHE_MAX_HOURS = 2;

export default function MedicalRecordScreen() {
  const { lang, isRtl } = useLang();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [record, setRecord] = useState<MedicalRecordData | null>(null);
  const [vitalsVisible, setVitalsVisible] = useState(false);
  const [sharing, setSharing] = useState(false);

  const fetchRecord = useCallback(async () => {
    if (!isAuthenticated()) {
      setLoading(false);
      return;
    }
    try {
      const result = await api.getMedicalRecord();
      setRecord(result as MedicalRecordData);
      cacheData(CACHE_KEY, result);
    } catch {
      // Try cached data
      const cached = getCachedData<MedicalRecordData>(CACHE_KEY, CACHE_MAX_HOURS);
      if (cached) setRecord(cached);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // Show cached data immediately, then refresh
    const cached = getCachedData<MedicalRecordData>(CACHE_KEY, CACHE_MAX_HOURS);
    if (cached) {
      setRecord(cached);
      setLoading(false);
    }
    fetchRecord();
  }, [fetchRecord]);

  const handleShare = useCallback(async () => {
    setSharing(true);
    try {
      const response = await api.post('/api/patient/record/share', { ttlHours: 24 });
      const shareUrl = (response as { url: string }).url;
      await Share.share({
        message: `${s.medicalRecord.sharedRecord[lang]}: ${shareUrl}`,
        url: shareUrl,
      });
      Alert.alert(s.mobileRecord.shareLinkCreated[lang]);
    } catch {
      Alert.alert(s.common.error[lang]);
    } finally {
      setSharing(false);
    }
  }, [lang]);

  const handleBookFollowUp = useCallback(
    (doctorId?: string) => {
      if (doctorId) {
        router.push({ pathname: '/(patient)/chat', params: { doctorId } });
      } else {
        router.push('/(patient)/chat');
      }
    },
    []
  );

  if (!isAuthenticated()) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={[styles.emptyTitle, isRtl && styles.textRtl]}>
          {s.history.loginRequired[lang]}
        </Text>
        <TouchableOpacity
          style={styles.loginBtn}
          onPress={() => router.push('/(auth)/otp')}
        >
          <Text style={styles.loginBtnText}>{s.login.title[lang]}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0D7A7A" />
      </View>
    );
  }

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString(
      lang === 'ar' ? 'ar-EG' : 'en-US',
      { day: 'numeric', month: 'short' }
    );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, isRtl && styles.textRtl]}>
          {s.medicalRecord.pageTitle[lang]}
        </Text>
      </View>

      {/* Offline Banner */}
      <OfflineBanner lang={lang} isRtl={isRtl} />

      {/* Allergy Banner (sticky at top) */}
      {record?.allergies && record.allergies.length > 0 && (
        <AllergyBanner allergies={record.allergies} lang={lang} />
      )}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchRecord();
            }}
            tintColor="#0D7A7A"
          />
        }
      >
        {/* Summary Cards (horizontal scroll) */}
        {record?.summary && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.summaryRow}
          >
            {record.summary.riskLevel != null && (
              <View style={styles.summaryCard}>
                <Text style={[styles.summaryLabel, isRtl && styles.textRtl]}>
                  {s.mobileRecord.summaryRisk[lang]}
                </Text>
                <Text style={[styles.summaryValue, isRtl && styles.textRtl]}>
                  {record.summary.riskLevel}
                </Text>
              </View>
            )}
            {record.summary.medicationCount != null && (
              <View style={styles.summaryCard}>
                <Text style={[styles.summaryLabel, isRtl && styles.textRtl]}>
                  {s.mobileRecord.summaryMeds[lang]}
                </Text>
                <Text style={[styles.summaryValue, isRtl && styles.textRtl]}>
                  {record.summary.medicationCount}
                </Text>
              </View>
            )}
            {record.summary.nextAppointment && (
              <View style={styles.summaryCard}>
                <Text style={[styles.summaryLabel, isRtl && styles.textRtl]}>
                  {s.mobileRecord.summaryNextAppt[lang]}
                </Text>
                <Text style={[styles.summaryValue, isRtl && styles.textRtl]}>
                  {formatDate(record.summary.nextAppointment)}
                </Text>
              </View>
            )}
            {record.summary.latestHba1c != null && (
              <View style={styles.summaryCard}>
                <Text style={[styles.summaryLabel, isRtl && styles.textRtl]}>
                  {s.mobileRecord.summaryHba1c[lang]}
                </Text>
                <Text style={[styles.summaryValue, isRtl && styles.textRtl]}>
                  {record.summary.latestHba1c}%
                </Text>
              </View>
            )}
          </ScrollView>
        )}

        {/* Active Medications */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isRtl && styles.textRtl]}>
            {s.medicalRecord.activeMedications[lang]}
          </Text>
          {record?.medications && record.medications.length > 0 ? (
            record.medications.map((med, i) => (
              <MedicationCard
                key={i}
                name={med.name}
                dose={med.dose || med.dosage}
                frequency={med.frequency || ''}
                adherencePct={med.adherencePct}
                lang={lang}
                isRtl={isRtl}
              />
            ))
          ) : (
            <Text style={[styles.emptyText, isRtl && styles.textRtl]}>
              {s.medicalRecord.noMedications[lang]}
            </Text>
          )}
        </View>

        {/* Vital Trend Charts */}
        {record?.vitalSeries && record.vitalSeries.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isRtl && styles.textRtl]}>
              {s.mobileRecord.vitalTrends[lang]}
            </Text>
            {record.vitalSeries.map((series, i) => (
              <VitalTrendChart
                key={i}
                data={series.data}
                label={series.label}
                unit={series.unit}
                normalRange={series.normalRange}
                lang={lang}
              />
            ))}
          </View>
        )}

        {/* Follow-up Appointments */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isRtl && styles.textRtl]}>
            {s.medicalRecord.upcomingFollowUps[lang]}
          </Text>
          {record?.followUps && record.followUps.length > 0 ? (
            record.followUps.map((fu) => (
              <FollowUpCard
                key={fu.id || fu.date}
                doctorName={fu.doctorName}
                specialty={fu.specialty}
                dueDate={fu.date}
                isOverdue={fu.isOverdue}
                lang={lang}
                isRtl={isRtl}
                onBook={() => handleBookFollowUp(fu.doctorId)}
              />
            ))
          ) : (
            <Text style={[styles.emptyText, isRtl && styles.textRtl]}>
              {s.medicalRecord.noFollowUps[lang]}
            </Text>
          )}
        </View>

        {/* Protocol Compliance */}
        {record?.protocols && record.protocols.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isRtl && styles.textRtl]}>
              {s.mobileRecord.protocolCompliance[lang]}
            </Text>
            {record.protocols.map((protocol, i) => (
              <ProtocolCompliance
                key={i}
                condition={protocol.condition}
                compliancePct={protocol.compliancePct}
                overdueItems={protocol.overdueItems}
                lang={lang}
                isRtl={isRtl}
              />
            ))}
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => setVitalsVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.actionBtnIcon}>{'\u{1F4CA}'}</Text>
            <Text style={[styles.actionBtnText, isRtl && styles.textRtl]}>
              {s.medicalRecord.logVitals[lang]}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnSecondary]}
            onPress={handleShare}
            disabled={sharing}
            activeOpacity={0.7}
          >
            {sharing ? (
              <ActivityIndicator color="#0D7A7A" size="small" />
            ) : (
              <>
                <Text style={styles.actionBtnIcon}>{'\u{1F517}'}</Text>
                <Text style={[styles.actionBtnTextSecondary, isRtl && styles.textRtl]}>
                  {s.mobileRecord.shareRecord[lang]}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Ask Triajji FAB */}
      <TouchableOpacity
        style={[styles.fab, isRtl ? styles.fabRtl : styles.fabLtr]}
        onPress={() => router.push('/(patient)/health-assistant')}
        activeOpacity={0.85}
      >
        <Text style={styles.fabEmoji}>{'\u2728'}</Text>
        <Text style={styles.fabText}>
          {s.healthAssistant.askTriajji[lang]}
        </Text>
      </TouchableOpacity>

      {/* Vitals Sheet */}
      <VitalsSheet
        visible={vitalsVisible}
        onClose={() => {
          setVitalsVisible(false);
          fetchRecord();
        }}
        lang={lang}
        isRtl={isRtl}
      />
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
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    fontFamily: 'Cairo-Bold',
  },
  textRtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Summary cards
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
    paddingBottom: 12,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    minWidth: 120,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#888',
    fontFamily: 'Cairo',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0D7A7A',
    fontFamily: 'Cairo-Bold',
  },
  // Sections
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A2F4A',
    fontFamily: 'Cairo-SemiBold',
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    fontFamily: 'Cairo',
  },
  // Action buttons
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: '#0D7A7A',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  actionBtnSecondary: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#0D7A7A',
  },
  actionBtnIcon: {
    fontSize: 18,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Cairo-Bold',
  },
  actionBtnTextSecondary: {
    color: '#0D7A7A',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Cairo-Bold',
  },
  // FAB
  fab: {
    position: 'absolute',
    bottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0D7A7A',
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingVertical: 14,
    shadowColor: '#0D7A7A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  fabLtr: {
    right: 20,
  },
  fabRtl: {
    left: 20,
  },
  fabEmoji: {
    fontSize: 18,
  },
  fabText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Cairo-Bold',
  },

  // Auth states
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A2F4A',
    marginBottom: 8,
    fontFamily: 'Cairo-SemiBold',
  },
  loginBtn: {
    backgroundColor: '#0D7A7A',
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 14,
    marginTop: 16,
  },
  loginBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Cairo-Bold',
  },
});
