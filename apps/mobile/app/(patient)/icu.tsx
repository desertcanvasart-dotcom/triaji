/**
 * Patient ICU Screen — READ ONLY. Shows nearby ICU beds with real-time updates.
 * Accessible from home screen emergency shortcut.
 * No transfer capability — patients can only view + call.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useLang } from '@/hooks/useLang';
import { useLocation } from '@/hooks/useLocation';
import { s } from '@triaji/shared/i18n';
import type { IcuSearchResult, IcuUnitType } from '@triaji/shared/types/icu';
import IcuResultCard from '@/components/icu/IcuResultCard';
import { createClient } from '@supabase/supabase-js';

const API_BASE_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'https://app.triajji.com';
const SUPABASE_URL = process.env['EXPO_PUBLIC_SUPABASE_URL'] ?? '';
const SUPABASE_ANON_KEY = process.env['EXPO_PUBLIC_SUPABASE_ANON_KEY'] ?? '';

const UNIT_TYPES: (IcuUnitType | 'all')[] = [
  'all',
  'general_icu',
  'cardiac_icu',
  'neonatal_icu',
  'paediatric_icu',
  'surgical_icu',
  'neurological_icu',
  'burns_icu',
  'respiratory_icu',
];

export default function PatientIcuScreen() {
  const { lang, isRtl } = useLang();
  const { location, loading: locLoading } = useLocation();
  const [results, setResults] = useState<IcuSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedType, setSelectedType] = useState<IcuUnitType | 'all'>('all');
  const supabaseRef = useRef(
    SUPABASE_URL && SUPABASE_ANON_KEY
      ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
      : null
  );

  const fetchResults = useCallback(async () => {
    if (!location) return;
    setLoading(true);

    try {
      const params = new URLSearchParams({
        lat: String(location.lat),
        lng: String(location.lng),
        radius_km: '50',
      });
      if (selectedType !== 'all') {
        params.set('unit_type', selectedType);
      }

      const res = await fetch(
        `${API_BASE_URL}/api/icu/search?${params.toString()}`
      );

      if (res.ok) {
        const data = await res.json();
        setResults(data.results ?? data ?? []);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [location, selectedType]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  // Supabase Realtime subscription for live bed count updates
  useEffect(() => {
    const client = supabaseRef.current;
    if (!client) return;

    const channel = client
      .channel('icu-beds-patient')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'icu_units',
        },
        (payload) => {
          const updated = payload.new as {
            id: string;
            available_beds: number;
            total_beds: number;
            updated_at: string;
          };

          setResults((prev) =>
            prev.map((r) =>
              r.icu_unit_id === updated.id
                ? {
                    ...r,
                    available_beds: updated.available_beds,
                    total_beds: updated.total_beds,
                    last_updated_at: updated.updated_at,
                  }
                : r
            )
          );
        }
      )
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }, []);

  const filteredResults =
    selectedType === 'all'
      ? results
      : results.filter((r) => r.unit_type === selectedType);

  const getFilterLabel = (type: IcuUnitType | 'all'): string => {
    if (type === 'all') return s.icu.allTypes[lang];
    return s.icu.unitTypes[type]?.[lang] ?? type;
  };

  const renderItem = ({ item }: { item: IcuSearchResult }) => (
    <IcuResultCard
      result={item}
      lang={lang}
      isRtl={isRtl}
      showTransferButton={false}
    />
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, isRtl && styles.textRtl]}>
          {s.icu.pageTitle[lang]}
        </Text>
        <Text style={[styles.headerSubtitle, isRtl && styles.textRtl]}>
          {s.icu.pageSubtitle[lang]}
        </Text>
      </View>

      {/* Unit type filter pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterScroll}
        style={styles.filterContainer}
      >
        {UNIT_TYPES.map((type) => (
          <TouchableOpacity
            key={type}
            style={[styles.filterPill, selectedType === type && styles.filterPillActive]}
            onPress={() => setSelectedType(type)}
          >
            <Text
              style={[
                styles.filterPillText,
                selectedType === type && styles.filterPillTextActive,
              ]}
              numberOfLines={1}
            >
              {getFilterLabel(type)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Results */}
      {locLoading || loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#0D7A7A" />
          <Text style={styles.loadingText}>{s.common.loading[lang]}</Text>
        </View>
      ) : filteredResults.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyIcon}>🏥</Text>
          <Text style={[styles.emptyText, isRtl && styles.textRtl]}>
            {s.icu.noBedsFound[lang]}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredResults}
          keyExtractor={(item) => item.icu_unit_id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
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
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    fontFamily: 'Cairo',
    marginTop: 4,
  },
  textRtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  filterContainer: {
    maxHeight: 52,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  filterScroll: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  filterPillActive: {
    backgroundColor: '#0D7A7A',
    borderColor: '#0D7A7A',
  },
  filterPillText: {
    fontSize: 13,
    color: '#666',
    fontFamily: 'Cairo-SemiBold',
    fontWeight: '600',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  loadingText: {
    fontSize: 14,
    color: '#888',
    fontFamily: 'Cairo',
    marginTop: 12,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 15,
    color: '#666',
    fontFamily: 'Cairo',
    textAlign: 'center',
    lineHeight: 22,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
});
