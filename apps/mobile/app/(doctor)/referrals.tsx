/**
 * Referral Management Screen — incoming and outgoing referrals.
 * Doctors can accept/decline incoming referrals and track outgoing ones.
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

interface Referral {
  id: string;
  patient_name: string;
  patient_age: number;
  referring_doctor_name?: string;
  referred_doctor_name?: string;
  specialty: string;
  urgency: 'routine' | 'urgent' | 'emergency';
  reason: string;
  status: 'sent' | 'accepted' | 'declined';
  created_at: string;
}

type TabType = 'incoming' | 'outgoing';

export default function ReferralsScreen() {
  const { lang, isRtl } = useLang();
  const [tab, setTab] = useState<TabType>('incoming');
  const [incoming, setIncoming] = useState<Referral[]>([]);
  const [outgoing, setOutgoing] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchReferrals = useCallback(async () => {
    try {
      const { storage } = await import('@/lib/storage');
      const token = storage.getString('doctor-token') ?? '';

      const [incRes, outRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/doctor/referrals?direction=incoming`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE_URL}/api/doctor/referrals?direction=outgoing`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (incRes.ok) {
        const json = await incRes.json();
        setIncoming(json.referrals ?? []);
      }
      if (outRes.ok) {
        const json = await outRes.json();
        setOutgoing(json.referrals ?? []);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchReferrals();
  }, [fetchReferrals]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchReferrals();
  }, [fetchReferrals]);

  const handleAction = async (referralId: string, action: 'accept' | 'decline') => {
    try {
      const { storage } = await import('@/lib/storage');
      const token = storage.getString('doctor-token') ?? '';

      const res = await fetch(`${API_BASE_URL}/api/doctor/referrals/${referralId}/${action}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        fetchReferrals();
      } else {
        Alert.alert('', s.common.error[lang]);
      }
    } catch {
      Alert.alert('', s.common.error[lang]);
    }
  };

  const urgencyColor = (urgency: string): string => {
    switch (urgency) {
      case 'emergency': return '#C62828';
      case 'urgent': return '#E65100';
      default: return '#1B5E20';
    }
  };

  const urgencyLabel = (urgency: string): string => {
    switch (urgency) {
      case 'emergency': return s.referral.emergency[lang];
      case 'urgent': return s.referral.urgent[lang];
      default: return s.referral.routine[lang];
    }
  };

  const statusLabel = (status: string): string => {
    switch (status) {
      case 'accepted': return s.doctorReferrals.accepted[lang];
      case 'declined': return s.doctorReferrals.declined[lang];
      default: return s.doctorReferrals.sent[lang];
    }
  };

  const data = tab === 'incoming' ? incoming : outgoing;

  const renderItem = ({ item }: { item: Referral }) => (
    <View style={styles.referralCard}>
      <View style={[styles.cardHeader, isRtl && styles.rowRtl]}>
        <View style={styles.cardInfo}>
          <Text style={[styles.patientName, isRtl && styles.textRtl]} numberOfLines={1}>
            {item.patient_name}
          </Text>
          <Text style={[styles.patientMeta, isRtl && styles.textRtl]}>
            {item.patient_age} {s.doctorConsultation.age[lang]} · {item.specialty}
          </Text>
        </View>
        <View style={[styles.urgencyBadge, { backgroundColor: urgencyColor(item.urgency) + '20' }]}>
          <Text style={[styles.urgencyText, { color: urgencyColor(item.urgency) }]}>
            {urgencyLabel(item.urgency)}
          </Text>
        </View>
      </View>

      {tab === 'incoming' && item.referring_doctor_name && (
        <Text style={[styles.doctorRef, isRtl && styles.textRtl]}>
          {s.doctorReferrals.from[lang]} {item.referring_doctor_name}
        </Text>
      )}
      {tab === 'outgoing' && item.referred_doctor_name && (
        <Text style={[styles.doctorRef, isRtl && styles.textRtl]}>
          {s.doctorReferrals.to[lang]} {item.referred_doctor_name}
        </Text>
      )}

      <Text style={[styles.reasonText, isRtl && styles.textRtl]} numberOfLines={2}>
        {item.reason}
      </Text>

      {tab === 'incoming' && item.status === 'sent' ? (
        <View style={[styles.actionsRow, isRtl && styles.rowRtl]}>
          <TouchableOpacity
            style={styles.declineBtn}
            onPress={() => handleAction(item.id, 'decline')}
          >
            <Text style={styles.declineBtnText}>
              {s.doctorReferrals.decline[lang]}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.acceptBtn}
            onPress={() => handleAction(item.id, 'accept')}
          >
            <Text style={styles.acceptBtnText}>
              {s.doctorReferrals.accept[lang]}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={[styles.statusRow, isRtl && styles.rowRtl]}>
          <Text style={styles.statusLabel}>{s.doctorReferrals.status[lang]}:</Text>
          <Text style={[
            styles.statusValue,
            item.status === 'accepted' && styles.statusAccepted,
            item.status === 'declined' && styles.statusDeclined,
          ]}>
            {statusLabel(item.status)}
          </Text>
        </View>
      )}
    </View>
  );

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
          {s.doctorReferrals.title[lang]}
        </Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, tab === 'incoming' && styles.tabActive]}
          onPress={() => setTab('incoming')}
        >
          <Text style={[styles.tabText, tab === 'incoming' && styles.tabTextActive]}>
            {s.doctorReferrals.incoming[lang]}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'outgoing' && styles.tabActive]}
          onPress={() => setTab('outgoing')}
        >
          <Text style={[styles.tabText, tab === 'outgoing' && styles.tabTextActive]}>
            {s.doctorReferrals.outgoing[lang]}
          </Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={[styles.emptyText, isRtl && styles.textRtl]}>
              {tab === 'incoming'
                ? s.doctorReferrals.noIncoming[lang]
                : s.doctorReferrals.noOutgoing[lang]}
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
  referralCard: {
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  cardInfo: {
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
  urgencyBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginLeft: 8,
  },
  urgencyText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'Cairo-Bold',
  },
  doctorRef: {
    fontSize: 13,
    color: '#0D7A7A',
    fontFamily: 'Cairo',
    marginBottom: 4,
  },
  reasonText: {
    fontSize: 14,
    color: '#555',
    fontFamily: 'Cairo',
    lineHeight: 21,
    marginBottom: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  declineBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#C62828',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  declineBtnText: {
    color: '#C62828',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Cairo-SemiBold',
  },
  acceptBtn: {
    flex: 1,
    backgroundColor: '#0D7A7A',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  acceptBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Cairo-SemiBold',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusLabel: {
    fontSize: 13,
    color: '#888',
    fontFamily: 'Cairo',
  },
  statusValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A2F4A',
    fontFamily: 'Cairo-SemiBold',
  },
  statusAccepted: {
    color: '#2E7D32',
  },
  statusDeclined: {
    color: '#C62828',
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
