/**
 * Labs Index — shows recent lab results with search/browse.
 * Each result card shows lab name, date, test names, normal/abnormal badges.
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
import { isAuthenticated } from '@/lib/storage';
import { api } from '@/lib/api';
import { s } from '@triaji/shared/i18n';

interface LabTest {
  name: string;
  isNormal: boolean;
  isBorderline?: boolean;
}

interface LabResult {
  id: string;
  labName: string;
  date: string;
  tests: LabTest[];
  orderedBy?: string;
}

export default function LabsScreen() {
  const { lang, isRtl } = useLang();
  const [results, setResults] = useState<LabResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLabs = useCallback(async () => {
    if (!isAuthenticated()) {
      setLoading(false);
      return;
    }
    try {
      const data = await api.get('/api/patient/labs');
      setResults((data as { results: LabResult[] }).results ?? []);
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchLabs();
  }, [fetchLabs]);

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
      { day: 'numeric', month: 'short', year: 'numeric' }
    );

  const getStatusBadge = (test: LabTest) => {
    if (test.isBorderline) {
      return { bg: '#FFF8E1', color: '#E65100', label: s.mobileLabs.borderline[lang] };
    }
    if (test.isNormal) {
      return { bg: '#E8F5E9', color: '#2E7D32', label: s.mobileLabs.normal[lang] };
    }
    return { bg: '#FFEBEE', color: '#C62828', label: s.mobileLabs.abnormal[lang] };
  };

  const renderItem = ({ item }: { item: LabResult }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/(patient)/labs/results/${item.id}`)}
      activeOpacity={0.7}
    >
      <View style={[styles.cardHeader, isRtl && styles.rowRtl]}>
        <View style={styles.cardHeaderLeft}>
          <Text style={[styles.labName, isRtl && styles.textRtl]}>{item.labName}</Text>
          <Text style={[styles.date, isRtl && styles.textRtl]}>
            {formatDate(item.date)}
          </Text>
        </View>
        <Text style={styles.chevron}>{isRtl ? '\u2039' : '\u203A'}</Text>
      </View>

      {item.orderedBy && (
        <Text style={[styles.orderedBy, isRtl && styles.textRtl]}>
          {s.mobileLabs.orderedBy[lang]}: {item.orderedBy}
        </Text>
      )}

      {/* Test badges */}
      <View style={[styles.testRow, isRtl && styles.rowRtl]}>
        {item.tests.map((test, idx) => {
          const badge = getStatusBadge(test);
          return (
            <View key={idx} style={[styles.testBadge, { backgroundColor: badge.bg }]}>
              <Text style={[styles.testName, { color: badge.color }]}>{test.name}</Text>
              <Text style={[styles.testStatus, { color: badge.color }]}>
                {badge.label}
              </Text>
            </View>
          );
        })}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backBtn}>{isRtl ? '\u203A' : '\u2039'}</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, isRtl && styles.textRtl]}>
          {s.mobileLabs.title[lang]}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {results.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyTitle, isRtl && styles.textRtl]}>
            {s.mobileLabs.noResults[lang]}
          </Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchLabs();
              }}
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
    fontSize: 20,
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
  list: {
    padding: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
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
    alignItems: 'center',
    marginBottom: 4,
  },
  cardHeaderLeft: {
    flex: 1,
  },
  labName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A2F4A',
    fontFamily: 'Cairo-SemiBold',
  },
  date: {
    fontSize: 13,
    color: '#888',
    fontFamily: 'Cairo',
    marginTop: 2,
  },
  chevron: {
    fontSize: 24,
    color: '#CCC',
  },
  orderedBy: {
    fontSize: 12,
    color: '#999',
    fontFamily: 'Cairo',
    marginBottom: 8,
  },
  testRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  testBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  testName: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Cairo-SemiBold',
  },
  testStatus: {
    fontSize: 10,
    fontFamily: 'Cairo',
  },
  // Empty / auth
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
