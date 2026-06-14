/**
 * CallHistoryList — Video call history for GP screen and patient detail.
 * Doctor view: shows date, duration, complaint summary, post-call actions, transcription link.
 * Patient view: simplified, no transcription access.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import type { Lang } from '@triaji/shared/i18n';
import { s } from '@triaji/shared/i18n';

const API_BASE_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'https://app.triajji.com';

// ─── Types ──────────────────────────────────────────────────────────────────

interface CallHistoryListProps {
  patientId?: string;
  doctorAccountId?: string;
  lang: Lang;
}

interface CallHistoryItem {
  id: string;
  created_at: string;
  duration_seconds: number;
  status: 'completed' | 'missed' | 'declined' | 'cancelled';
  complaint_summary: string | null;
  has_prescription: boolean;
  has_lab_order: boolean;
  has_follow_up: boolean;
  has_notes: boolean;
  transcription_status: 'pending' | 'processing' | 'ready' | null;
  patient_name?: string;
  doctor_name?: string;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function CallHistoryList({
  patientId,
  doctorAccountId,
  lang,
}: CallHistoryListProps) {
  const isRtl = lang === 'ar';
  const isDoctor = !!doctorAccountId;

  const [calls, setCalls] = useState<CallHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // ─── Fetch call history ─────────────────────────────────────────────

  const fetchCalls = useCallback(async () => {
    try {
      const { storage } = await import('@/lib/storage');
      const tokenKey = isDoctor ? 'doctor-token' : 'patient-token';
      const token = storage.getString(tokenKey) ?? '';

      const params = new URLSearchParams();
      if (patientId) params.set('patient_id', patientId);
      if (doctorAccountId) params.set('doctor_account_id', doctorAccountId);

      const res = await fetch(
        `${API_BASE_URL}/api/telehealth/gp-call/history?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (res.ok) {
        const data: CallHistoryItem[] = await res.json();
        setCalls(data);
      }
    } catch {
      // Silent
    } finally {
      setLoading(false);
    }
  }, [patientId, doctorAccountId, isDoctor]);

  useEffect(() => {
    fetchCalls();
  }, [fetchCalls]);

  // ─── Helpers ────────────────────────────────────────────────────────

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (iso: string): string => {
    const date = new Date(iso);
    return date.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // ─── Render item ──────────────────────────────────────────────────────

  const renderCallItem = ({ item }: { item: CallHistoryItem }) => {
    const actions: string[] = [];
    if (item.has_prescription) actions.push(s.videoCall.prescriptionIssued[lang]);
    if (item.has_lab_order) actions.push(s.videoCall.labsOrdered[lang]);
    if (item.has_follow_up) actions.push(s.videoCall.followUpScheduled[lang]);
    if (item.has_notes) actions.push(s.videoCall.savedNotes[lang]);

    return (
      <TouchableOpacity
        style={styles.callCard}
        onPress={() => {
          if (isDoctor) {
            router.push({
              pathname: '/(doctor)/video-call/post-call/[callId]' as never,
              params: { callId: item.id },
            });
          }
        }}
        activeOpacity={isDoctor ? 0.7 : 1}
        disabled={!isDoctor}
      >
        {/* Date + duration row */}
        <View style={[styles.callRow, isRtl && styles.rowRtl]}>
          <Text style={[styles.callDate, isRtl && styles.textRtl]}>
            {formatDate(item.created_at)}
          </Text>
          <View style={[styles.durationBadge, statusBadgeColor(item.status)]}>
            <Text style={styles.durationText}>
              {item.status === 'completed'
                ? formatDuration(item.duration_seconds)
                : statusLabel(item.status, lang)}
            </Text>
          </View>
        </View>

        {/* Complaint summary */}
        {item.complaint_summary && (
          <View style={styles.complaintRow}>
            <Text style={[styles.complaintLabel, isRtl && styles.textRtl]}>
              {s.videoCall.complaintSummary[lang]}
            </Text>
            <Text
              style={[styles.complaintText, isRtl && styles.textRtl]}
              numberOfLines={2}
            >
              {item.complaint_summary}
            </Text>
          </View>
        )}

        {/* Actions taken (doctor view only shows full details) */}
        {actions.length > 0 && (
          <View style={styles.actionsRow}>
            <Text style={[styles.actionsLabel, isRtl && styles.textRtl]}>
              {s.videoCall.actionsPerformed[lang]}
            </Text>
            <View style={[styles.actionTags, isRtl && styles.rowRtl]}>
              {actions.map((action, i) => (
                <View key={i} style={styles.actionTag}>
                  <Text style={styles.actionTagText}>{action}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Transcription link (doctor only) */}
        {isDoctor && item.transcription_status === 'ready' && (
          <TouchableOpacity
            style={styles.transcriptionLink}
            onPress={() =>
              router.push({
                pathname: '/(doctor)/video-call/transcription/[callId]' as never,
                params: { callId: item.id },
              })
            }
          >
            <Text style={[styles.transcriptionLinkText, isRtl && styles.textRtl]}>
              {s.videoCall.viewTranscription[lang]} &rarr;
            </Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  // ─── Main render ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="small" color="#1A2F4A" />
      </View>
    );
  }

  if (calls.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={[styles.emptyText, isRtl && styles.textRtl]}>
          {s.videoCall.callHistoryEmpty[lang]}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionTitle, isRtl && styles.textRtl]}>
        {s.videoCall.callHistory[lang]}
      </Text>

      <FlatList
        data={calls}
        keyExtractor={(item) => item.id}
        renderItem={renderCallItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        scrollEnabled={false} // Typically inside a ScrollView
      />
    </View>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function statusBadgeColor(status: CallHistoryItem['status']) {
  switch (status) {
    case 'completed':
      return { backgroundColor: '#E8F5E9' };
    case 'missed':
      return { backgroundColor: '#FFF3E0' };
    case 'declined':
    case 'cancelled':
      return { backgroundColor: '#FFEBEE' };
    default:
      return { backgroundColor: '#F5F5F5' };
  }
}

function statusLabel(status: CallHistoryItem['status'], lang: Lang): string {
  switch (status) {
    case 'missed':
      return lang === 'ar' ? 'فائتة' : 'Missed';
    case 'declined':
      return lang === 'ar' ? 'مرفوضة' : 'Declined';
    case 'cancelled':
      return lang === 'ar' ? 'ملغاة' : 'Cancelled';
    default:
      return '';
  }
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
  },
  centerContainer: {
    padding: 24,
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#888',
    fontFamily: 'Cairo',
  },
  textRtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  rowRtl: {
    flexDirection: 'row-reverse',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A2F4A',
    fontFamily: 'Cairo-SemiBold',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  listContent: {
    gap: 10,
  },
  callCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  callRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  callDate: {
    fontSize: 13,
    color: '#666',
    fontFamily: 'Cairo',
    flex: 1,
  },
  durationBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  durationText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    fontFamily: 'Cairo-SemiBold',
  },
  complaintRow: {
    marginTop: 10,
  },
  complaintLabel: {
    fontSize: 11,
    color: '#888',
    fontFamily: 'Cairo',
    marginBottom: 2,
  },
  complaintText: {
    fontSize: 14,
    color: '#1A2F4A',
    fontFamily: 'Cairo',
    lineHeight: 20,
  },
  actionsRow: {
    marginTop: 10,
  },
  actionsLabel: {
    fontSize: 11,
    color: '#888',
    fontFamily: 'Cairo',
    marginBottom: 4,
  },
  actionTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  actionTag: {
    backgroundColor: '#E8F5E9',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  actionTagText: {
    fontSize: 11,
    color: '#2E7D32',
    fontFamily: 'Cairo-SemiBold',
    fontWeight: '600',
  },
  transcriptionLink: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  transcriptionLinkText: {
    fontSize: 13,
    color: '#0D7A7A',
    fontFamily: 'Cairo-SemiBold',
    fontWeight: '600',
  },
});
