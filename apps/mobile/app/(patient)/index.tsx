/**
 * Patient Home Screen — greeting, alerts, upcoming appointments,
 * current medications, and quick action buttons.
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
  FlatList,
} from 'react-native';
import { router } from 'expo-router';
import { useLang } from '@/hooks/useLang';
import { useAuth } from '@/hooks/useAuth';
import { isAuthenticated } from '@/lib/storage';
import { s } from '@triaji/shared/i18n';
import AlertCard from '@/components/shared/AlertCard';

const API_BASE_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'https://app.doctortrio.online';

interface EligibilityResult {
  eligible: boolean;
}

interface HomeData {
  alerts: {
    id: string;
    type: 'overdue_followup' | 'protocol_alert' | 'medication_reminder';
    title_ar: string;
    title_en: string;
    description_ar: string;
    description_en: string;
    severity: 'warning' | 'info' | 'error';
  }[];
  upcomingBookings: {
    id: string;
    doctor_name_ar: string;
    doctor_name_en?: string;
    specialty_ar: string;
    specialty_en?: string;
    appointment_date: string;
    appointment_time: string;
  }[];
  medications: {
    id: string;
    name: string;
    dosage: string;
    frequency_ar: string;
    frequency_en: string;
  }[];
  protocolAlerts: {
    id: string;
    protocol_name_ar: string;
    protocol_name_en: string;
    message_ar: string;
    message_en: string;
  }[];
}

export default function PatientHomeScreen() {
  const { lang, isRtl } = useLang();
  const { patientName, authenticated } = useAuth();
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [assistantEligible, setAssistantEligible] = useState(false);

  const fetchHomeData = useCallback(async () => {
    if (!isAuthenticated()) {
      setLoading(false);
      return;
    }

    try {
      const { getPatientToken } = await import('@/lib/storage');
      const token = getPatientToken();
      const headers = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      // Home data and assistant eligibility are independent — fetch in parallel.
      // Eligibility is non-critical, so its failure must not sink the home load.
      const [res, eligRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/patient/home`, { headers }),
        fetch(`${API_BASE_URL}/api/health-assistant/eligibility`, { headers }).catch(
          () => null,
        ),
      ]);

      if (res.ok) {
        setData(await res.json());
      }

      if (eligRes?.ok) {
        const eligData = (await eligRes.json()) as EligibilityResult;
        setAssistantEligible(eligData.eligible);
      }
    } catch {
      // Silently fail — show empty state
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchHomeData();
  }, [fetchHomeData]);

  const formatDate = (dateStr: string): string => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      });
    } catch {
      return dateStr;
    }
  };

  const todayFormatted = new Date().toLocaleDateString(
    lang === 'ar' ? 'ar-EG' : 'en-US',
    { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
  );

  const getAlertIcon = (type: string): string => {
    switch (type) {
      case 'overdue_followup':
        return '📅';
      case 'protocol_alert':
        return '🔬';
      case 'medication_reminder':
        return '💊';
      default:
        return '🔔';
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.headerRow, isRtl && styles.rowRtl]}>
          <View style={styles.headerLeft}>
            <Text style={[styles.greeting, isRtl && styles.textRtl]}>
              {s.patientHome.greeting[lang]},{' '}
              {patientName ?? (lang === 'ar' ? 'ضيف' : 'Guest')} 👋
            </Text>
            <Text style={[styles.dateText, isRtl && styles.textRtl]}>
              {todayFormatted}
            </Text>
          </View>
          <TouchableOpacity style={styles.notifBtn}>
            <Text style={styles.notifIcon}>🔔</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchHomeData();
            }}
            tintColor="#0D7A7A"
          />
        }
      >
        {/* Quick Actions */}
        <View style={[styles.ctaRow, isRtl && styles.rowRtl]}>
          <TouchableOpacity
            style={styles.ctaPrimary}
            onPress={() => router.push('/(patient)/chat')}
          >
            <Text style={styles.ctaIcon}>💬</Text>
            <Text style={[styles.ctaText, isRtl && styles.textRtl]}>
              {s.patientHome.startTriage[lang]}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.ctaSecondary}
            onPress={() => router.push('/booking/icu')}
          >
            <Text style={styles.ctaIcon}>🚨</Text>
            <Text style={[styles.ctaSecondaryText, isRtl && styles.textRtl]}>
              {s.patientHome.icuEmergency[lang]}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Ask DoctorTrio — Health Assistant (shown when eligible) */}
        {assistantEligible && (
          <TouchableOpacity
            style={styles.askDoctorTrioCard}
            onPress={() => router.push('/(patient)/health-assistant')}
            activeOpacity={0.8}
          >
            <View style={[styles.askDoctorTrioRow, isRtl && styles.rowRtl]}>
              <Text style={styles.askDoctorTrioEmoji}>{'\u2728'}</Text>
              <View style={styles.askDoctorTrioContent}>
                <Text style={[styles.askDoctorTrioTitle, isRtl && styles.textRtl]}>
                  {s.healthAssistant.askDoctorTrio[lang]}
                </Text>
                <Text style={[styles.askDoctorTrioSub, isRtl && styles.textRtl]}>
                  {s.healthAssistant.subtitle[lang]}
                </Text>
              </View>
              <Text style={styles.askDoctorTrioArrow}>{isRtl ? '←' : '→'}</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Alerts */}
        {data?.alerts && data.alerts.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isRtl && styles.textRtl]}>
              {s.patientHome.alerts[lang]}
            </Text>
            {data.alerts.map((alert) => (
              <AlertCard
                key={alert.id}
                icon={getAlertIcon(alert.type)}
                title={lang === 'ar' ? alert.title_ar : alert.title_en}
                description={
                  lang === 'ar' ? alert.description_ar : alert.description_en
                }
                variant={alert.severity}
                isRtl={isRtl}
              />
            ))}
          </View>
        )}

        {/* Protocol Alerts */}
        {data?.protocolAlerts && data.protocolAlerts.length > 0 && (
          <View style={styles.section}>
            {data.protocolAlerts.map((pa) => (
              <AlertCard
                key={pa.id}
                icon="🔬"
                title={
                  lang === 'ar' ? pa.protocol_name_ar : pa.protocol_name_en
                }
                description={lang === 'ar' ? pa.message_ar : pa.message_en}
                variant="warning"
                isRtl={isRtl}
              />
            ))}
          </View>
        )}

        {/* Upcoming Appointments */}
        <View style={styles.section}>
          <View style={[styles.sectionHeader, isRtl && styles.rowRtl]}>
            <Text style={[styles.sectionTitle, isRtl && styles.textRtl]}>
              {s.patientHome.upcomingAppointments[lang]}
            </Text>
            {data?.upcomingBookings && data.upcomingBookings.length > 0 && (
              <TouchableOpacity
                onPress={() => router.push('/(patient)/history')}
              >
                <Text style={styles.viewAllLink}>
                  {s.patientHome.viewAll[lang]}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {data?.upcomingBookings && data.upcomingBookings.length > 0 ? (
            data.upcomingBookings.slice(0, 3).map((booking) => (
              <View key={booking.id} style={styles.appointmentCard}>
                <View style={[styles.apptRow, isRtl && styles.rowRtl]}>
                  <View style={styles.apptDateBadge}>
                    <Text style={styles.apptDateText}>
                      {formatDate(booking.appointment_date)}
                    </Text>
                    <Text style={styles.apptTimeText}>
                      {booking.appointment_time}
                    </Text>
                  </View>
                  <View style={styles.apptInfo}>
                    <Text style={[styles.apptDoctor, isRtl && styles.textRtl]}>
                      {s.patientHome.withDoctor[lang]}{' '}
                      {lang === 'ar'
                        ? booking.doctor_name_ar
                        : (booking.doctor_name_en ?? booking.doctor_name_ar)}
                    </Text>
                    <Text style={[styles.apptSpecialty, isRtl && styles.textRtl]}>
                      {lang === 'ar'
                        ? booking.specialty_ar
                        : (booking.specialty_en ?? booking.specialty_ar)}
                    </Text>
                  </View>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>📅</Text>
              <Text style={[styles.emptyText, isRtl && styles.textRtl]}>
                {s.patientHome.noAppointments[lang]}
              </Text>
            </View>
          )}
        </View>

        {/* Current Medications */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isRtl && styles.textRtl]}>
            {s.patientHome.currentMedications[lang]}
          </Text>

          {data?.medications && data.medications.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.medsScroll}
            >
              {data.medications.map((med) => (
                <View key={med.id} style={styles.medCard}>
                  <Text style={styles.medIcon}>💊</Text>
                  <Text style={[styles.medName, isRtl && styles.textRtl]} numberOfLines={1}>
                    {med.name}
                  </Text>
                  <Text style={[styles.medDosage, isRtl && styles.textRtl]} numberOfLines={1}>
                    {med.dosage}
                  </Text>
                  <Text style={[styles.medFreq, isRtl && styles.textRtl]} numberOfLines={1}>
                    {lang === 'ar' ? med.frequency_ar : med.frequency_en}
                  </Text>
                </View>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>💊</Text>
              <Text style={[styles.emptyText, isRtl && styles.textRtl]}>
                {s.patientHome.noMedications[lang]}
              </Text>
            </View>
          )}
        </View>

        {/* Disclaimer */}
        <View style={styles.disclaimerCard}>
          <Text style={[styles.disclaimerText, isRtl && styles.textRtl]}>
            {s.common.disclaimer[lang]}
          </Text>
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
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  rowRtl: {
    flexDirection: 'row-reverse',
  },
  headerLeft: {
    flex: 1,
  },
  greeting: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    fontFamily: 'Cairo-Bold',
  },
  dateText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    fontFamily: 'Cairo',
    marginTop: 4,
  },
  notifBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifIcon: {
    fontSize: 20,
  },
  textRtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },

  // Quick Actions
  ctaRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  ctaPrimary: {
    flex: 2,
    backgroundColor: '#0D7A7A',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#0D7A7A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  ctaSecondary: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#FFCDD2',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  ctaIcon: {
    fontSize: 28,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Cairo-Bold',
    textAlign: 'center',
  },
  ctaSecondaryText: {
    color: '#C62828',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Cairo-SemiBold',
    textAlign: 'center',
  },

  // Ask DoctorTrio card
  askDoctorTrioCard: {
    backgroundColor: '#0D7A7A',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#0D7A7A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  askDoctorTrioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  askDoctorTrioEmoji: {
    fontSize: 28,
  },
  askDoctorTrioContent: {
    flex: 1,
  },
  askDoctorTrioTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'Cairo-Bold',
  },
  askDoctorTrioSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    fontFamily: 'Cairo',
    marginTop: 2,
  },
  askDoctorTrioArrow: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.7)',
  },

  // Sections
  section: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A2F4A',
    fontFamily: 'Cairo-Bold',
    marginBottom: 8,
  },
  viewAllLink: {
    fontSize: 13,
    color: '#0D7A7A',
    fontWeight: '600',
    fontFamily: 'Cairo-SemiBold',
  },

  // Appointments
  appointmentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  apptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  apptDateBadge: {
    backgroundColor: '#E0F2F1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    minWidth: 70,
  },
  apptDateText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0D7A7A',
    fontFamily: 'Cairo-SemiBold',
  },
  apptTimeText: {
    fontSize: 11,
    color: '#0D7A7A',
    fontFamily: 'Cairo',
  },
  apptInfo: {
    flex: 1,
  },
  apptDoctor: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A2F4A',
    fontFamily: 'Cairo-SemiBold',
  },
  apptSpecialty: {
    fontSize: 13,
    color: '#888',
    fontFamily: 'Cairo',
  },

  // Medications
  medsScroll: {
    gap: 10,
    paddingRight: 8,
  },
  medCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    width: 140,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  medIcon: {
    fontSize: 24,
    marginBottom: 6,
  },
  medName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A2F4A',
    fontFamily: 'Cairo-SemiBold',
    textAlign: 'center',
  },
  medDosage: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'Cairo',
    textAlign: 'center',
  },
  medFreq: {
    fontSize: 11,
    color: '#0D7A7A',
    fontFamily: 'Cairo',
    textAlign: 'center',
    marginTop: 4,
  },

  // Empty states
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    fontFamily: 'Cairo',
    textAlign: 'center',
  },

  // Disclaimer
  disclaimerCard: {
    backgroundColor: '#FFF8E1',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  disclaimerText: {
    fontSize: 12,
    color: '#795548',
    lineHeight: 20,
    fontFamily: 'Cairo',
    textAlign: 'center',
  },
});
