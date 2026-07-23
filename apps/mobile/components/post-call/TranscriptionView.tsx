/**
 * TranscriptionView — Formatted call transcription with speaker labels.
 * Doctor lines rendered bold, patient lines normal.
 * Shows loading state while transcription is processing.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import type { Lang } from '@triaji/shared/i18n';
import { s } from '@triaji/shared/i18n';

const API_BASE_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'https://app.doctortrio.online';

// ─── Types ──────────────────────────────────────────────────────────────────

interface TranscriptionViewProps {
  callId: string;
  lang: Lang;
}

interface TranscriptionSegment {
  speaker: 'doctor' | 'patient';
  text: string;
  timestamp_ms?: number;
}

interface TranscriptionData {
  status: 'pending' | 'processing' | 'ready';
  segments: TranscriptionSegment[];
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function TranscriptionView({ callId, lang }: TranscriptionViewProps) {
  const isRtl = lang === 'ar';

  const [data, setData] = useState<TranscriptionData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchTranscription = useCallback(async () => {
    try {
      const { storage } = await import('@/lib/storage');
      const token = storage.getString('doctor-token') ?? '';

      const res = await fetch(
        `${API_BASE_URL}/api/telehealth/gp-call/${callId}/transcription`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (res.ok) {
        const result: TranscriptionData = await res.json();
        setData(result);
      }
    } catch {
      // Silent
    } finally {
      setLoading(false);
    }
  }, [callId]);

  useEffect(() => {
    fetchTranscription();
  }, [fetchTranscription]);

  // ─── Format timestamp ─────────────────────────────────────────────────

  const formatTimestamp = (ms?: number): string => {
    if (ms == null) return '';
    const totalSeconds = Math.floor(ms / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // ─── Render ───────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#1A2F4A" />
        <Text style={styles.loadingText}>{s.common.loading[lang]}</Text>
      </View>
    );
  }

  // Not ready or no data
  if (!data || data.status !== 'ready' || !data.segments?.length) {
    const statusMessage =
      data?.status === 'processing'
        ? s.videoCall.transcriptionProcessing[lang]
        : s.videoCall.noTranscription[lang];

    return (
      <View style={styles.centerContainer}>
        {data?.status === 'processing' && (
          <ActivityIndicator size="small" color="#1565C0" style={{ marginBottom: 8 }} />
        )}
        <Text style={[styles.statusText, isRtl && styles.textRtl]}>{statusMessage}</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollInner}
      showsVerticalScrollIndicator={false}
    >
      {/* Title */}
      <Text style={[styles.title, isRtl && styles.textRtl]}>
        {s.videoCall.transcriptionTitle[lang]}
      </Text>

      {/* Segments */}
      {data.segments.map((segment, index) => {
        const isDoctor = segment.speaker === 'doctor';
        const speakerLabel = isDoctor
          ? s.videoCall.doctorSpeaker[lang]
          : s.videoCall.patientSpeaker[lang];
        const timestamp = formatTimestamp(segment.timestamp_ms);

        return (
          <View
            key={`${index}-${segment.timestamp_ms ?? index}`}
            style={[
              styles.segmentContainer,
              isDoctor ? styles.doctorSegment : styles.patientSegment,
            ]}
          >
            {/* Speaker header */}
            <View style={[styles.speakerRow, isRtl && styles.rowRtl]}>
              <View
                style={[
                  styles.speakerDot,
                  { backgroundColor: isDoctor ? '#1A2F4A' : '#0D7A7A' },
                ]}
              />
              <Text
                style={[
                  styles.speakerName,
                  isDoctor && styles.speakerNameBold,
                  isRtl && styles.textRtl,
                ]}
              >
                {speakerLabel}
              </Text>
              {timestamp ? (
                <Text style={styles.timestamp}>{timestamp}</Text>
              ) : null}
            </View>

            {/* Text */}
            <Text
              style={[
                styles.segmentText,
                isDoctor && styles.segmentTextBold,
                isRtl && styles.textRtl,
              ]}
            >
              {segment.text}
            </Text>
          </View>
        );
      })}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: '#888',
    fontFamily: 'Cairo',
  },
  statusText: {
    fontSize: 15,
    color: '#666',
    fontFamily: 'Cairo',
    textAlign: 'center',
  },
  scrollInner: {
    padding: 16,
    gap: 8,
  },
  textRtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  rowRtl: {
    flexDirection: 'row-reverse',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A2F4A',
    fontFamily: 'Cairo-Bold',
    marginBottom: 8,
  },

  // Segment
  segmentContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 3,
  },
  doctorSegment: {
    borderLeftColor: '#1A2F4A',
  },
  patientSegment: {
    borderLeftColor: '#0D7A7A',
  },
  speakerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  speakerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  speakerName: {
    fontSize: 13,
    color: '#666',
    fontFamily: 'Cairo',
    flex: 1,
  },
  speakerNameBold: {
    fontWeight: '700',
    color: '#1A2F4A',
    fontFamily: 'Cairo-Bold',
  },
  timestamp: {
    fontSize: 11,
    color: '#AAA',
    fontFamily: 'Cairo',
  },
  segmentText: {
    fontSize: 15,
    color: '#444',
    fontFamily: 'Cairo',
    lineHeight: 24,
  },
  segmentTextBold: {
    fontWeight: '600',
    color: '#1A2F4A',
    fontFamily: 'Cairo-SemiBold',
  },
});
