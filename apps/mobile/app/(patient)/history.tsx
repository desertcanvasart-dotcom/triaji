/**
 * History Tab — enhanced patient encounter history timeline.
 * Groups by date with SectionList, filter chips, expandable details.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  SectionList,
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

type FilterType = 'all' | 'visits' | 'labs' | 'prescriptions' | 'imaging';

const FILTER_KEYS: FilterType[] = ['all', 'visits', 'labs', 'prescriptions', 'imaging'];

function getFilterLabel(filter: FilterType, lang: 'ar' | 'en'): string {
  const map: Record<FilterType, { ar: string; en: string }> = {
    all: s.mobileHistory.filterAll,
    visits: s.mobileHistory.filterVisits,
    labs: s.mobileHistory.filterLabs,
    prescriptions: s.mobileHistory.filterPrescriptions,
    imaging: s.mobileHistory.filterImaging,
  };
  return map[filter][lang];
}

export default function HistoryScreen() {
  const { lang, isRtl } = useLang();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

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

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Filter sessions
  const filteredSessions = useMemo(() => {
    if (filter === 'all') return sessions;
    return sessions.filter((session) => {
      const s = session as SessionSummary & {
        has_prescription?: boolean;
        has_lab?: boolean;
        has_imaging?: boolean;
        type?: string;
      };
      if (filter === 'visits') return s.type === 'visit' || s.outcome === 'booked';
      if (filter === 'labs') return s.has_lab;
      if (filter === 'prescriptions') return s.has_prescription;
      if (filter === 'imaging') return s.has_imaging;
      return true;
    });
  }, [sessions, filter]);

  // Group by date for SectionList
  const sections = useMemo(() => {
    const groups = new Map<string, SessionSummary[]>();
    for (const session of filteredSessions) {
      const dateKey = new Date(session.created_at).toLocaleDateString(
        lang === 'ar' ? 'ar-EG' : 'en-US',
        { day: 'numeric', month: 'long', year: 'numeric' }
      );
      if (!groups.has(dateKey)) groups.set(dateKey, []);
      groups.get(dateKey)!.push(session);
    }
    return Array.from(groups.entries()).map(([title, data]) => ({ title, data }));
  }, [filteredSessions, lang]);

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

  const renderSession = ({ item }: { item: SessionSummary }) => {
    const isExpanded = expandedIds.has(item.session_id);
    const extended = item as SessionSummary & {
      has_prescription?: boolean;
      has_lab?: boolean;
      has_imaging?: boolean;
      summary_text?: string;
    };

    return (
      <TouchableOpacity
        style={styles.sessionCard}
        onPress={() => toggleExpand(item.session_id)}
        activeOpacity={0.7}
      >
        {/* Header row */}
        <View style={[styles.sessionHeader, isRtl && styles.rowRtl]}>
          <View style={[styles.sessionLeft, isRtl && styles.rowRtl]}>
            <View style={styles.timelineDot} />
            <Text style={[styles.complaint, isRtl && styles.textRtl]} numberOfLines={isExpanded ? 0 : 1}>
              {item.chief_complaint_ar}
            </Text>
          </View>
          <View
            style={[
              styles.outcomeBadge,
              { backgroundColor: getOutcomeColor(item.outcome) + '20' },
            ]}
          >
            <Text
              style={[styles.outcomeText, { color: getOutcomeColor(item.outcome) }]}
            >
              {getOutcomeLabel(item.outcome)}
            </Text>
          </View>
        </View>

        {/* Meta row: doctor, specialty */}
        {(item.doctor_name_ar || item.specialty_name_ar) && (
          <View style={[styles.metaRow, isRtl && styles.rowRtl]}>
            {item.doctor_name_ar && (
              <Text style={[styles.meta, isRtl && styles.textRtl]}>
                {s.history.doctorLabel[lang]} {item.doctor_name_ar}
              </Text>
            )}
            {item.specialty_name_ar && (
              <Text style={[styles.meta, isRtl && styles.textRtl]}>
                {s.history.specialty[lang]} {item.specialty_name_ar}
              </Text>
            )}
          </View>
        )}

        {/* Type icons */}
        <View style={[styles.iconsRow, isRtl && styles.rowRtl]}>
          {extended.has_prescription && (
            <View style={styles.iconChip}>
              <Text style={styles.iconChipText}>
                {'\u{1F48A}'} {s.mobileHistory.hasPrescription[lang]}
              </Text>
            </View>
          )}
          {extended.has_lab && (
            <View style={styles.iconChip}>
              <Text style={styles.iconChipText}>
                {'\u{1F9EA}'} {s.mobileHistory.hasLab[lang]}
              </Text>
            </View>
          )}
          {extended.has_imaging && (
            <View style={styles.iconChip}>
              <Text style={styles.iconChipText}>
                {'\u{1FA7B}'} {s.mobileHistory.hasImaging[lang]}
              </Text>
            </View>
          )}
        </View>

        {/* Expanded details */}
        {isExpanded && (
          <View style={styles.expandedSection}>
            {/* Symptoms */}
            {item.symptoms_ar.length > 0 && (
              <View style={styles.expandedBlock}>
                <Text style={[styles.expandedLabel, isRtl && styles.textRtl]}>
                  {s.history.symptoms[lang]}
                </Text>
                <View style={styles.symptoms}>
                  {item.symptoms_ar.map((symptom, i) => (
                    <View key={i} style={styles.symptomTag}>
                      <Text style={styles.symptomText}>{symptom}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Summary */}
            {extended.summary_text && (
              <View style={styles.expandedBlock}>
                <Text style={[styles.expandedLabel, isRtl && styles.textRtl]}>
                  {s.mobileHistory.encounterSummary[lang]}
                </Text>
                <Text style={[styles.expandedText, isRtl && styles.textRtl]}>
                  {extended.summary_text}
                </Text>
              </View>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderSectionHeader = ({ section }: { section: { title: string } }) => (
    <View style={styles.sectionHeaderRow}>
      <Text style={[styles.sectionHeader, isRtl && styles.textRtl]}>
        {section.title}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, isRtl && styles.textRtl]}>
          {s.history.title[lang]}
        </Text>
      </View>

      {/* Filter Chips */}
      <View style={styles.filterContainer}>
        {FILTER_KEYS.map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f)}
          >
            <Text
              style={[
                styles.filterChipText,
                filter === f && styles.filterChipTextActive,
              ]}
            >
              {getFilterLabel(f, lang)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {sections.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyTitle, isRtl && styles.textRtl]}>
            {s.history.emptyTitle[lang]}
          </Text>
          <Text style={[styles.emptyDesc, isRtl && styles.textRtl]}>
            {s.history.emptyDescription[lang]}
          </Text>
          <TouchableOpacity
            style={styles.startBtn}
            onPress={() => router.push('/(patient)/chat')}
          >
            <Text style={styles.startBtnText}>{s.history.startNow[lang]}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.session_id}
          renderItem={renderSession}
          renderSectionHeader={renderSectionHeader}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
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
  // Filter chips
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
  },
  filterChipActive: {
    backgroundColor: '#0D7A7A',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    fontFamily: 'Cairo-SemiBold',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  // Section headers
  sectionHeaderRow: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: '#888',
    fontFamily: 'Cairo-Bold',
  },
  // List
  list: {
    padding: 16,
  },
  sessionCard: {
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
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  sessionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#0D7A7A',
    marginTop: 4,
  },
  complaint: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A2F4A',
    fontFamily: 'Cairo-SemiBold',
    flex: 1,
  },
  outcomeBadge: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginLeft: 8,
  },
  outcomeText: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: 'Cairo-SemiBold',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 6,
    paddingLeft: 18,
  },
  meta: {
    fontSize: 13,
    color: '#666',
    fontFamily: 'Cairo',
  },
  // Icon chips
  iconsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingLeft: 18,
  },
  iconChip: {
    backgroundColor: '#F0FAFA',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  iconChipText: {
    fontSize: 11,
    color: '#0D7A7A',
    fontWeight: '600',
    fontFamily: 'Cairo-SemiBold',
  },
  // Expanded
  expandedSection: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingLeft: 18,
  },
  expandedBlock: {
    marginBottom: 8,
  },
  expandedLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888',
    fontFamily: 'Cairo-SemiBold',
    marginBottom: 4,
  },
  expandedText: {
    fontSize: 14,
    color: '#333',
    fontFamily: 'Cairo',
    lineHeight: 22,
  },
  symptoms: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
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
  // Empty states
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
