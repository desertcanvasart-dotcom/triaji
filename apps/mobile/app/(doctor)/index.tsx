/**
 * Doctor Dashboard — full implementation.
 * Shows greeting, today's appointments, alerts, quick actions, and ICU panel.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { useLang } from '@/hooks/useLang';
import { useAuth } from '@/hooks/useAuth';
import { s } from '@triaji/shared/i18n';
import BookingCard from '@/components/doctor/BookingCard';
import OverdueAlert from '@/components/doctor/OverdueAlert';

const API_BASE_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'https://app.triajji.com';

interface DashboardBooking {
  id: string;
  patient_name: string;
  patient_age: number;
  patient_sex: 'male' | 'female';
  time: string;
  condition_tags: string[];
  brs_score?: number;
  brs_level?: string;
}

interface DashboardData {
  appointments: DashboardBooking[];
  overdue_follow_ups: number;
  new_lab_results: number;
}

export default function DoctorDashboardScreen() {
  const { lang, isRtl } = useLang();
  const { doctorName, doctorId } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notifCount, setNotifCount] = useState(0);

  const today = new Date();
  const dateStr = today.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const fetchDashboard = useCallback(async () => {
    try {
      const { storage } = await import('@/lib/storage');
      const token = storage.getString('doctor-token') ?? '';

      const res = await fetch(`${API_BASE_URL}/api/doctor/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const json = await res.json();
        setData(json);
        setNotifCount((json.overdue_follow_ups ?? 0) + (json.new_lab_results ?? 0));
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDashboard();
  }, [fetchDashboard]);

  const handleViewSummary = useCallback((bookingId: string) => {
    router.push(`/(doctor)/consultation/${bookingId}`);
  }, []);

  const handleStartConsultation = useCallback((bookingId: string) => {
    router.push(`/(doctor)/consultation/${bookingId}`);
  }, []);

  const renderHeader = () => (
    <View>
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.headerRow, isRtl && styles.rowRtl]}>
          <View style={styles.headerTextContainer}>
            <Text style={[styles.greeting, isRtl && styles.textRtl]}>
              {s.doctorDashboard.greetingDoc[lang]} {doctorName ?? ''} 👨‍⚕️
            </Text>
            <Text style={[styles.dateText, isRtl && styles.textRtl]}>
              {dateStr}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.notifBell}
            onPress={() => router.push('/(doctor)/follow-ups')}
          >
            <Text style={styles.bellIcon}>🔔</Text>
            {notifCount > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>{notifCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Alerts Row */}
      <View style={styles.alertsRow}>
        <OverdueAlert
          count={data?.overdue_follow_ups ?? 0}
          type="follow_up"
          lang={lang}
          isRtl={isRtl}
          onPress={() => router.push('/(doctor)/follow-ups')}
        />
        <OverdueAlert
          count={data?.new_lab_results ?? 0}
          type="lab_result"
          lang={lang}
          isRtl={isRtl}
          onPress={() => {
            // Navigate to a lab results view (placeholder)
          }}
        />
      </View>

      {/* Quick Intake Button */}
      <TouchableOpacity style={styles.quickIntakeBtn} activeOpacity={0.7}>
        <Text style={styles.quickIntakeIcon}>⚡</Text>
        <Text style={styles.quickIntakeText}>
          {s.doctorDashboard.quickIntake[lang]}
        </Text>
      </TouchableOpacity>

      {/* ICU Panel */}
      <TouchableOpacity
        style={styles.icuPanel}
        activeOpacity={0.7}
        onPress={() => router.push('/(doctor)/icu')}
      >
        <Text style={styles.icuIcon}>🏥</Text>
        <View style={styles.icuTextContainer}>
          <Text style={[styles.icuTitle, isRtl && styles.textRtl]}>
            {s.doctorDashboard.icuTitle[lang]}
          </Text>
          <Text style={[styles.icuCta, isRtl && styles.textRtl]}>
            {s.doctorDashboard.icuSearch[lang]}
          </Text>
        </View>
        <Text style={styles.icuChevron}>{isRtl ? '‹' : '›'}</Text>
      </TouchableOpacity>

      {/* Today's Appointments Title */}
      <Text style={[styles.sectionTitle, isRtl && styles.textRtl]}>
        {s.doctorDashboard.todayAppointments[lang]}
      </Text>
    </View>
  );

  const renderBookingItem = ({ item }: { item: DashboardBooking }) => (
    <BookingCard
      booking={item}
      lang={lang}
      isRtl={isRtl}
      onViewSummary={() => handleViewSummary(item.id)}
      onStartConsultation={() => handleStartConsultation(item.id)}
    />
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>📋</Text>
      <Text style={[styles.emptyText, isRtl && styles.textRtl]}>
        {s.doctorDashboard.noTodayAppts[lang]}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1A2F4A" />
        <Text style={styles.loadingText}>{s.common.loading[lang]}</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={data?.appointments ?? []}
      keyExtractor={(item) => item.id}
      renderItem={renderBookingItem}
      ListHeaderComponent={renderHeader}
      ListEmptyComponent={renderEmpty}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    />
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
  header: {
    backgroundColor: '#1A2F4A',
    paddingTop: 60,
    paddingBottom: 20,
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
  headerTextContainer: {
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
    color: 'rgba(255,255,255,0.75)',
    fontFamily: 'Cairo',
    marginTop: 4,
  },
  textRtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  notifBell: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellIcon: {
    fontSize: 22,
  },
  notifBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  notifBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  alertsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  quickIntakeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0D7A7A',
    borderRadius: 14,
    paddingVertical: 14,
    marginHorizontal: 16,
    marginTop: 12,
    gap: 8,
  },
  quickIntakeIcon: {
    fontSize: 18,
  },
  quickIntakeText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Cairo-SemiBold',
  },
  icuPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
    gap: 12,
  },
  icuIcon: {
    fontSize: 28,
  },
  icuTextContainer: {
    flex: 1,
  },
  icuTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#DC2626',
    fontFamily: 'Cairo-Bold',
  },
  icuCta: {
    fontSize: 13,
    color: '#991B1B',
    fontFamily: 'Cairo',
    marginTop: 2,
  },
  icuChevron: {
    fontSize: 24,
    color: '#DC2626',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A2F4A',
    fontFamily: 'Cairo-SemiBold',
    paddingHorizontal: 16,
    marginTop: 20,
    marginBottom: 8,
  },
  listContent: {
    paddingBottom: 32,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 15,
    color: '#888',
    fontFamily: 'Cairo',
    textAlign: 'center',
  },
});
