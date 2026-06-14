/**
 * Doctor Patient Panel — GP patient list with health indicators.
 * Filters: "Needs Attention" | "All patients"
 * Each card shows status indicator (red/yellow/green).
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

const API_BASE_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'https://app.triajji.com';

type HealthStatus = 'critical' | 'warning' | 'compliant';

interface PatientItem {
  id: string;
  name: string;
  age: number;
  condition_summary: string;
  health_status: HealthStatus;
  has_active_booking: boolean;
}

interface PatientsResponse {
  patients: PatientItem[];
  has_gp_relationships: boolean;
}

const STATUS_COLORS: Record<HealthStatus, string> = {
  critical: '#EF4444',
  warning: '#F59E0B',
  compliant: '#22C55E',
};

export default function DoctorPatientsScreen() {
  const { lang, isRtl } = useLang();
  const { doctorId } = useAuth();
  const [patients, setPatients] = useState<PatientItem[]>([]);
  const [hasGpRelationships, setHasGpRelationships] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'attention' | 'all'>('attention');

  const fetchPatients = useCallback(async () => {
    try {
      const { storage } = await import('@/lib/storage');
      const token = storage.getString('doctor-token') ?? '';

      const res = await fetch(`${API_BASE_URL}/api/doctor/patients`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const json: PatientsResponse = await res.json();
        setPatients(json.patients ?? []);
        setHasGpRelationships(json.has_gp_relationships);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPatients();
  }, [fetchPatients]);

  const filteredPatients = filter === 'attention'
    ? patients.filter((p) => p.health_status === 'critical' || p.health_status === 'warning')
    : patients;

  const statusLabel = (status: HealthStatus): string => {
    switch (status) {
      case 'critical': return s.doctorPatients.criticalAlert[lang];
      case 'warning': return s.doctorPatients.warningAlert[lang];
      case 'compliant': return s.doctorPatients.compliant[lang];
    }
  };

  const renderPatientItem = ({ item }: { item: PatientItem }) => (
    <TouchableOpacity
      style={styles.patientCard}
      activeOpacity={0.7}
      onPress={() => router.push(`/(doctor)/patients/${item.id}`)}
    >
      <View style={[styles.patientRow, isRtl && styles.rowRtl]}>
        <View
          style={[styles.statusDot, { backgroundColor: STATUS_COLORS[item.health_status] }]}
        />
        <View style={styles.patientInfo}>
          <Text style={[styles.patientName, isRtl && styles.textRtl]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={[styles.patientMeta, isRtl && styles.textRtl]}>
            {item.age} {s.doctorConsultation.age[lang]} · {statusLabel(item.health_status)}
          </Text>
          {item.condition_summary ? (
            <Text style={[styles.conditionText, isRtl && styles.textRtl]} numberOfLines={2}>
              {item.condition_summary}
            </Text>
          ) : null}
        </View>
        <Text style={styles.chevron}>{isRtl ? '‹' : '›'}</Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1A2F4A" />
        <Text style={styles.loadingText}>{s.common.loading[lang]}</Text>
      </View>
    );
  }

  // No GP relationships guard
  if (!hasGpRelationships) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={[styles.headerTitle, isRtl && styles.textRtl]}>
            {s.tabs.patients[lang]}
          </Text>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>👥</Text>
          <Text style={[styles.emptyTitle, isRtl && styles.textRtl]}>
            {s.doctorPatients.noGpRelationships[lang]}
          </Text>
          <Text style={[styles.emptyDesc, isRtl && styles.textRtl]}>
            {s.doctorPatients.noGpDescription[lang]}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, isRtl && styles.textRtl]}>
          {s.tabs.patients[lang]}
        </Text>
      </View>

      {/* Tab Filters */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, filter === 'attention' && styles.tabActive]}
          onPress={() => setFilter('attention')}
        >
          <Text
            style={[
              styles.tabText,
              filter === 'attention' && styles.tabTextActive,
            ]}
          >
            🔴 {s.doctorPatients.needsAttention[lang]}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, filter === 'all' && styles.tabActive]}
          onPress={() => setFilter('all')}
        >
          <Text
            style={[
              styles.tabText,
              filter === 'all' && styles.tabTextActive,
            ]}
          >
            {s.doctorPatients.allPatients[lang]}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Patient List */}
      <FlatList
        data={filteredPatients}
        keyExtractor={(item) => item.id}
        renderItem={renderPatientItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyDesc, isRtl && styles.textRtl]}>
              {s.doctorPatients.noPatients[lang]}
            </Text>
          </View>
        }
      />
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
  header: {
    backgroundColor: '#1A2F4A',
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
  rowRtl: {
    flexDirection: 'row-reverse',
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#1A2F4A',
  },
  tabText: {
    fontSize: 14,
    color: '#888',
    fontFamily: 'Cairo-SemiBold',
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#1A2F4A',
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  patientCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  patientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  patientInfo: {
    flex: 1,
  },
  patientName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A2F4A',
    fontFamily: 'Cairo-Bold',
  },
  patientMeta: {
    fontSize: 13,
    color: '#666',
    fontFamily: 'Cairo',
    marginTop: 2,
  },
  conditionText: {
    fontSize: 13,
    color: '#888',
    fontFamily: 'Cairo',
    marginTop: 4,
    lineHeight: 20,
  },
  chevron: {
    fontSize: 22,
    color: '#CCC',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A2F4A',
    marginBottom: 8,
    fontFamily: 'Cairo-SemiBold',
  },
  emptyDesc: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    fontFamily: 'Cairo',
    lineHeight: 22,
  },
});
