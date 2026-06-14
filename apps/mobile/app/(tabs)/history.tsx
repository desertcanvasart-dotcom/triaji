/**
 * History Tab — Patient session history timeline.
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
import { useLang } from '@/hooks/useLang';
import { isAuthenticated } from '@/lib/storage';
import { api } from '@/lib/api';
import { s } from '@triaji/shared/i18n';
import type { SessionSummary } from '@triaji/shared/api';
import { router } from 'expo-router';

export default function HistoryScreen() {
  const { lang, isRtl } = useLang();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHistory = useCallback(async () => {
    if (!isAuthenticated()) {
      setLoading(false);
      return;
    }
    try {
      const result = await api.getHistory();
      setSessions(result.sessions);
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchHistory();
  };

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

  const getOutcomeLabel = (outcome: string): string => {
    const map: Record<string, { ar: string; en: string }> = {
      booked: s.history.outcomeBooked,
      escalated: s.history.outcomeEscalated,
      no_booking: s.history.outcomeNoBooking,
      cancelled: s.history.outcomeCancelled,
    };
    return (map[outcome] ?? s.history.outcomeNoBooking)[lang];
  };

  const getOutcomeColor = (outcome: string): string => {
    if (outcome === 'escalated') return '#C62828';
    if (outcome === 'booked') return '#0D7A7A';
    return '#999';
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const renderSession = ({ item }: { item: SessionSummary }) => (
    <View style={styles.sessionCard}>
      <View style={[styles.sessionHeader, isRtl && styles.rowRtl]}>
        <Text style={[styles.sessionDate, isRtl && styles.textRtl]}>
          {formatDate(item.created_at)}
        </Text>
        <View
          style={[
            styles.outcomeBadge,
            { backgroundColor: getOutcomeColor(item.outcome) + '20' },
          ]}
        >
          <Text
            style={[
              styles.outcomeText,
              { color: getOutcomeColor(item.outcome) },
            ]}
          >
            {getOutcomeLabel(item.outcome)}
          </Text>
        </View>
      </View>

      <Text style={[styles.complaint, isRtl && styles.textRtl]}>
        {item.chief_complaint_ar}
      </Text>

      {item.specialty_name_ar && (
        <Text style={[styles.meta, isRtl && styles.textRtl]}>
          {s.history.specialty[lang]} {item.specialty_name_ar}
        </Text>
      )}

      {item.doctor_name_ar && (
        <Text style={[styles.meta, isRtl && styles.textRtl]}>
          {s.history.doctorLabel[lang]} {item.doctor_name_ar}
        </Text>
      )}

      {item.symptoms_ar.length > 0 && (
        <View style={styles.symptoms}>
          {item.symptoms_ar.map((symptom, i) => (
            <View key={i} style={styles.symptomTag}>
              <Text style={styles.symptomText}>{symptom}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, isRtl && styles.textRtl]}>
          {s.history.title[lang]}
        </Text>
      </View>

      {sessions.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyTitle, isRtl && styles.textRtl]}>
            {s.history.emptyTitle[lang]}
          </Text>
          <Text style={[styles.emptyDesc, isRtl && styles.textRtl]}>
            {s.history.emptyDescription[lang]}
          </Text>
          <TouchableOpacity
            style={styles.startBtn}
            onPress={() => router.push('/(tabs)/chat')}
          >
            <Text style={styles.startBtnText}>
              {s.history.startNow[lang]}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(item) => item.session_id}
          renderItem={renderSession}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#0D7A7A"
            />
          }
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
  rowRtl: {
    flexDirection: 'row-reverse',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    padding: 16,
  },
  sessionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sessionDate: {
    fontSize: 13,
    color: '#888',
    fontFamily: 'Cairo',
  },
  outcomeBadge: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  outcomeText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Cairo-SemiBold',
  },
  complaint: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A2F4A',
    marginBottom: 8,
    fontFamily: 'Cairo-SemiBold',
  },
  meta: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
    fontFamily: 'Cairo',
  },
  symptoms: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  symptomTag: {
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  symptomText: {
    fontSize: 12,
    color: '#2E7D32',
  },
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
  emptyDesc: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    fontFamily: 'Cairo',
  },
  startBtn: {
    backgroundColor: '#0D7A7A',
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  startBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Cairo-Bold',
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
