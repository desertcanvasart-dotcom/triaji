/**
 * GP Screen — shows the patient's primary care doctor relationship.
 * If GP exists: doctor card with actions. If not: empty state with CTA.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { useLang } from '@/hooks/useLang';
import { useAuth } from '@/hooks/useAuth';
import { s } from '@triaji/shared/i18n';
import AvailabilityBadge from '@/components/gp/AvailabilityBadge';

const API_BASE_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'https://app.triajji.com';

interface GpData {
  id: string;
  doctor_id: string;
  doctor_account_id: string;
  doctor_name_ar: string;
  doctor_name_en?: string;
  specialty_ar: string;
  specialty_en?: string;
  avatar_url?: string;
  since: string;
  status: 'active' | 'pending';
  gp_video_calls_enabled?: boolean;
  call_fee?: number;
}

interface CallHistoryItem {
  id: string;
  started_at: string;
  duration_seconds: number;
  status: string;
}

export default function GpScreen() {
  const { lang, isRtl } = useLang();
  const { authenticated } = useAuth();
  const [gp, setGp] = useState<GpData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [callHistory, setCallHistory] = useState<CallHistoryItem[]>([]);
  const [initiatingCall, setInitiatingCall] = useState(false);

  const fetchGp = useCallback(async () => {
    if (!authenticated) {
      setLoading(false);
      return;
    }

    try {
      const { getPatientToken } = await import('@/lib/storage');
      const token = getPatientToken();

      const res = await fetch(`${API_BASE_URL}/api/patient/gp`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (res.ok) {
        const data = await res.json();
        setGp(data.gp ?? data ?? null);
      } else {
        setGp(null);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [authenticated]);

  useEffect(() => {
    fetchGp();
  }, [fetchGp]);

  const handleEndRelationship = () => {
    Alert.alert(
      s.mobileGp.endConfirmTitle[lang],
      s.mobileGp.endConfirmBody[lang],
      [
        { text: s.common.cancel[lang], style: 'cancel' },
        {
          text: s.common.confirm[lang],
          style: 'destructive',
          onPress: async () => {
            try {
              const { getPatientToken } = await import('@/lib/storage');
              const token = getPatientToken();

              await fetch(`${API_BASE_URL}/api/patient/gp`, {
                method: 'DELETE',
                headers: {
                  Authorization: `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
              });

              setGp(null);
            } catch {
              Alert.alert(s.common.error[lang], s.common.tryAgain[lang]);
            }
          },
        },
      ]
    );
  };

  const handleMessage = () => {
    Alert.alert(s.mobileGp.message[lang], s.mobileGp.messagePlaceholder[lang]);
  };

  const handleBookWithGp = () => {
    router.push('/(patient)/chat');
  };

  // ─── Video Call ─────────────────────────────────────────────────────────

  const fetchCallHistory = useCallback(async () => {
    if (!authenticated || !gp) return;

    try {
      const { getPatientToken } = await import('@/lib/storage');
      const token = getPatientToken();

      const res = await fetch(`${API_BASE_URL}/api/telehealth/gp-call?history=true`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (res.ok) {
        const data = await res.json();
        setCallHistory(data.calls ?? []);
      }
    } catch {
      // Silent
    }
  }, [authenticated, gp]);

  useEffect(() => {
    if (gp) fetchCallHistory();
  }, [gp, fetchCallHistory]);

  const handleVideoCall = async () => {
    if (!gp) return;

    // Check fee
    const fee = gp.call_fee ?? 0;

    if (fee > 0) {
      Alert.alert(
        s.videoCall.callFee[lang],
        `${fee} ${lang === 'ar' ? 'جنيه' : 'EGP'}`,
        [
          { text: s.common.cancel[lang], style: 'cancel' },
          {
            text: s.videoCall.payAndCall[lang],
            onPress: () => initiateVideoCall(),
          },
        ]
      );
    } else {
      initiateVideoCall();
    }
  };

  const initiateVideoCall = async () => {
    if (!gp) return;
    setInitiatingCall(true);

    try {
      const { getPatientToken } = await import('@/lib/storage');
      const token = getPatientToken();

      const res = await fetch(`${API_BASE_URL}/api/telehealth/gp-room`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          doctor_account_id: gp.doctor_account_id,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        router.push(`/(patient)/video-call/${data.call_id}`);
      } else {
        const errorData = await res.json().catch(() => ({}));
        Alert.alert(
          s.common.error[lang],
          errorData.message ?? s.videoCall.couldNotReachDoctor[lang]
        );
      }
    } catch {
      Alert.alert(s.common.error[lang], s.videoCall.couldNotReachDoctor[lang]);
    } finally {
      setInitiatingCall(false);
    }
  };

  const formatDate = (dateStr: string): string => {
    try {
      return new Date(dateStr).toLocaleDateString(
        lang === 'ar' ? 'ar-EG' : 'en-US',
        { year: 'numeric', month: 'long', day: 'numeric' }
      );
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={[styles.headerTitle, isRtl && styles.textRtl]}>
            {s.mobileGp.title[lang]}
          </Text>
        </View>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#0D7A7A" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, isRtl && styles.textRtl]}>
          {s.mobileGp.title[lang]}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchGp();
            }}
            tintColor="#0D7A7A"
          />
        }
      >
        {gp ? (
          <>
            {/* GP Doctor Card */}
            <View style={styles.gpCard}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>
                  {(lang === 'ar' ? gp.doctor_name_ar : (gp.doctor_name_en ?? gp.doctor_name_ar))[0]}
                </Text>
              </View>

              <Text style={[styles.doctorName, isRtl && styles.textRtl]}>
                {lang === 'ar'
                  ? gp.doctor_name_ar
                  : (gp.doctor_name_en ?? gp.doctor_name_ar)}
              </Text>

              <Text style={[styles.specialty, isRtl && styles.textRtl]}>
                {lang === 'ar'
                  ? gp.specialty_ar
                  : (gp.specialty_en ?? gp.specialty_ar)}
              </Text>

              <Text style={[styles.sinceDate, isRtl && styles.textRtl]}>
                {s.mobileGp.since[lang]} {formatDate(gp.since)}
              </Text>

              {gp.status === 'pending' && (
                <View style={styles.pendingBadge}>
                  <Text style={styles.pendingBadgeText}>
                    {s.gp.requestPending[lang]}
                  </Text>
                </View>
              )}
            </View>

            {/* Availability Badge */}
            {gp.gp_video_calls_enabled && (
              <View style={styles.availabilityRow}>
                <AvailabilityBadge
                  doctorAccountId={gp.doctor_account_id}
                  lang={lang}
                />
              </View>
            )}

            {/* Action buttons */}
            <View style={styles.actionsContainer}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnSecondary]}
                onPress={handleMessage}
              >
                <Text style={styles.actionBtnSecondaryIcon}>💬</Text>
                <Text style={[styles.actionBtnSecondaryText, isRtl && styles.textRtl]}>
                  {s.mobileGp.message[lang]}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnPrimary]}
                onPress={handleBookWithGp}
              >
                <Text style={styles.actionBtnPrimaryIcon}>📅</Text>
                <Text style={[styles.actionBtnPrimaryText, isRtl && styles.textRtl]}>
                  {s.mobileGp.bookWithThem[lang]}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Video Call Button */}
            {gp.gp_video_calls_enabled && (
              <TouchableOpacity
                style={[styles.videoCallBtn, initiatingCall && styles.btnDisabled]}
                onPress={handleVideoCall}
                disabled={initiatingCall}
                activeOpacity={0.7}
              >
                {initiatingCall ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={styles.videoCallBtnIcon}>📹</Text>
                    <Text style={[styles.videoCallBtnText, isRtl && styles.textRtl]}>
                      {s.videoCall.callGP[lang]}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {/* Call History */}
            {callHistory.length > 0 && (
              <View style={styles.callHistoryCard}>
                <Text style={[styles.callHistoryTitle, isRtl && styles.textRtl]}>
                  {s.videoCall.callHistory[lang]}
                </Text>
                {callHistory.map((call) => (
                  <View key={call.id} style={[styles.callHistoryRow, isRtl && styles.callHistoryRowRtl]}>
                    <Text style={[styles.callHistoryDate, isRtl && styles.textRtl]}>
                      {new Date(call.started_at).toLocaleDateString(
                        lang === 'ar' ? 'ar-EG' : 'en-US',
                        { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
                      )}
                    </Text>
                    <Text style={styles.callHistoryDuration}>
                      {Math.floor(call.duration_seconds / 60)}:{(call.duration_seconds % 60).toString().padStart(2, '0')}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            <TouchableOpacity
              style={styles.endRelBtn}
              onPress={handleEndRelationship}
            >
              <Text style={styles.endRelBtnText}>
                {s.mobileGp.endRelationship[lang]}
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          /* No GP — empty state */
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>👨‍⚕️</Text>
            <Text style={[styles.emptyTitle, isRtl && styles.textRtl]}>
              {s.mobileGp.noGpTitle[lang]}
            </Text>
            <Text style={[styles.emptyDesc, isRtl && styles.textRtl]}>
              {s.mobileGp.noGpDescription[lang]}
            </Text>

            <TouchableOpacity
              style={styles.chooseCta}
              onPress={() => {
                // Placeholder — navigate to GP selection flow
                Alert.alert(s.mobileGp.chooseGP[lang], s.mobileGp.messagePlaceholder[lang]);
              }}
            >
              <Text style={styles.chooseCtaText}>
                {s.mobileGp.chooseGP[lang]}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
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
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  gpCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#0D7A7A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  doctorName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A2F4A',
    fontFamily: 'Cairo-Bold',
    marginBottom: 4,
  },
  specialty: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'Cairo',
    marginBottom: 6,
  },
  sinceDate: {
    fontSize: 13,
    color: '#999',
    fontFamily: 'Cairo',
  },
  pendingBadge: {
    backgroundColor: '#FFF8E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginTop: 10,
  },
  pendingBadgeText: {
    fontSize: 13,
    color: '#F57C00',
    fontWeight: '600',
    fontFamily: 'Cairo-SemiBold',
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  actionBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    gap: 6,
  },
  actionBtnPrimary: {
    backgroundColor: '#0D7A7A',
  },
  actionBtnSecondary: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  actionBtnPrimaryIcon: {
    fontSize: 22,
  },
  actionBtnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Cairo-SemiBold',
  },
  actionBtnSecondaryIcon: {
    fontSize: 22,
  },
  actionBtnSecondaryText: {
    color: '#1A2F4A',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Cairo-SemiBold',
  },
  endRelBtn: {
    backgroundColor: '#FFEBEE',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  endRelBtnText: {
    color: '#C62828',
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'Cairo-SemiBold',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 56,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A2F4A',
    fontFamily: 'Cairo-SemiBold',
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'Cairo',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  chooseCta: {
    backgroundColor: '#0D7A7A',
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  chooseCtaText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Cairo-Bold',
  },
  availabilityRow: {
    marginTop: 12,
    marginBottom: 4,
    alignItems: 'center',
  },
  videoCallBtn: {
    backgroundColor: '#0D7A7A',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  videoCallBtnIcon: {
    fontSize: 20,
  },
  videoCallBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Cairo-Bold',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  callHistoryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  callHistoryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A2F4A',
    fontFamily: 'Cairo-SemiBold',
    marginBottom: 10,
  },
  callHistoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  callHistoryRowRtl: {
    flexDirection: 'row-reverse',
  },
  callHistoryDate: {
    fontSize: 14,
    color: '#333',
    fontFamily: 'Cairo',
  },
  callHistoryDuration: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0D7A7A',
    fontFamily: 'Cairo-SemiBold',
  },
});
