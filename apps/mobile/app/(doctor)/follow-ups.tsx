/**
 * Overdue Follow-ups Screen — lists patients with overdue follow-ups.
 * Doctors can send WhatsApp reminders to patients.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { Stack } from 'expo-router';
import { useLang } from '@/hooks/useLang';
import { s } from '@triaji/shared/i18n';

const API_BASE_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'https://app.triajji.com';

interface OverdueFollowUp {
  id: string;
  patient_name: string;
  patient_age: number;
  days_overdue: number;
  original_reason: string;
  patient_phone?: string;
}

export default function FollowUpsScreen() {
  const { lang, isRtl } = useLang();
  const [followUps, setFollowUps] = useState<OverdueFollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sendingIds, setSendingIds] = useState<Set<string>>(new Set());

  const fetchFollowUps = useCallback(async () => {
    try {
      const { storage } = await import('@/lib/storage');
      const token = storage.getString('doctor-token') ?? '';

      const res = await fetch(`${API_BASE_URL}/api/doctor/follow-ups/overdue`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const json = await res.json();
        setFollowUps(json.follow_ups ?? []);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchFollowUps();
  }, [fetchFollowUps]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchFollowUps();
  }, [fetchFollowUps]);

  const handleSendReminder = async (followUp: OverdueFollowUp) => {
    setSendingIds((prev) => new Set(prev).add(followUp.id));

    try {
      const { storage } = await import('@/lib/storage');
      const token = storage.getString('doctor-token') ?? '';

      const res = await fetch(
        `${API_BASE_URL}/api/doctor/follow-ups/${followUp.id}/remind`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (res.ok) {
        Alert.alert('', s.doctorFollowUps.reminderSent[lang]);
      } else {
        Alert.alert('', s.common.error[lang]);
      }
    } catch {
      Alert.alert('', s.common.error[lang]);
    } finally {
      setSendingIds((prev) => {
        const next = new Set(prev);
        next.delete(followUp.id);
        return next;
      });
    }
  };

  const renderItem = ({ item }: { item: OverdueFollowUp }) => {
    const isSending = sendingIds.has(item.id);

    return (
      <View style={styles.card}>
        <View style={[styles.cardTop, isRtl && styles.rowRtl]}>
          <View style={styles.patientInfo}>
            <Text style={[styles.patientName, isRtl && styles.textRtl]} numberOfLines={1}>
              {item.patient_name}
            </Text>
            <Text style={[styles.patientMeta, isRtl && styles.textRtl]}>
              {item.patient_age} {s.doctorConsultation.age[lang]}
            </Text>
          </View>
          <View style={styles.overdueBadge}>
            <Text style={styles.overdueText}>
              {item.days_overdue} {s.doctorFollowUps.daysOverdue[lang]}
            </Text>
          </View>
        </View>

        <Text style={[styles.reasonLabel, isRtl && styles.textRtl]}>
          {s.doctorFollowUps.originalReason[lang]}:
        </Text>
        <Text style={[styles.reasonText, isRtl && styles.textRtl]} numberOfLines={2}>
          {item.original_reason}
        </Text>

        <TouchableOpacity
          style={[styles.reminderBtn, isSending && styles.reminderBtnDisabled]}
          onPress={() => handleSendReminder(item)}
          disabled={isSending}
          activeOpacity={0.7}
        >
          <Text style={styles.reminderBtnText}>
            {isSending
              ? s.doctorFollowUps.sending[lang]
              : s.doctorFollowUps.sendReminder[lang]}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color="#1A2F4A" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, isRtl && styles.textRtl]}>
          {s.doctorFollowUps.title[lang]}
        </Text>
      </View>

      {/* List */}
      <FlatList
        data={followUps}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>✅</Text>
            <Text style={[styles.emptyText, isRtl && styles.textRtl]}>
              {s.doctorFollowUps.noOverdue[lang]}
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
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
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
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
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
  overdueBadge: {
    backgroundColor: '#FFF8E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#FFE082',
    marginLeft: 8,
  },
  overdueText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#E65100',
    fontFamily: 'Cairo-Bold',
  },
  reasonLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
    fontFamily: 'Cairo-SemiBold',
    marginBottom: 4,
  },
  reasonText: {
    fontSize: 14,
    color: '#333',
    fontFamily: 'Cairo',
    lineHeight: 21,
    marginBottom: 12,
  },
  reminderBtn: {
    backgroundColor: '#0D7A7A',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  reminderBtnDisabled: {
    opacity: 0.6,
  },
  reminderBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'Cairo-SemiBold',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
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
