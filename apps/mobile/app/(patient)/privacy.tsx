/**
 * Privacy Screen — consent management. Shows who can access patient records,
 * with ability to revoke and (placeholder) grant new access.
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
import { useLang } from '@/hooks/useLang';
import { useAuth } from '@/hooks/useAuth';
import { s } from '@triaji/shared/i18n';

const API_BASE_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'https://app.triajji.com';

interface AccessGrant {
  id: string;
  doctor_id: string;
  doctor_name_ar: string;
  doctor_name_en?: string;
  scope: string;
  scope_ar: string;
  scope_en: string;
  granted_at: string;
  expires_at?: string;
}

export default function PrivacyScreen() {
  const { lang, isRtl } = useLang();
  const { authenticated } = useAuth();
  const [grants, setGrants] = useState<AccessGrant[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchGrants = useCallback(async () => {
    if (!authenticated) {
      setLoading(false);
      return;
    }

    try {
      const { getPatientToken } = await import('@/lib/storage');
      const token = getPatientToken();

      const res = await fetch(`${API_BASE_URL}/api/patient/privacy`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (res.ok) {
        const data = await res.json();
        setGrants(data.grants ?? data ?? []);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [authenticated]);

  useEffect(() => {
    fetchGrants();
  }, [fetchGrants]);

  const handleRevoke = (grant: AccessGrant) => {
    const doctorName =
      lang === 'ar'
        ? grant.doctor_name_ar
        : (grant.doctor_name_en ?? grant.doctor_name_ar);

    Alert.alert(
      s.mobilePrivacy.revokeAccess[lang],
      s.mobilePrivacy.revokeConfirm[lang],
      [
        { text: s.common.cancel[lang], style: 'cancel' },
        {
          text: s.common.confirm[lang],
          style: 'destructive',
          onPress: async () => {
            try {
              const { getPatientToken } = await import('@/lib/storage');
              const token = getPatientToken();

              const res = await fetch(
                `${API_BASE_URL}/api/patient/privacy/${grant.id}`,
                {
                  method: 'DELETE',
                  headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                  },
                }
              );

              if (res.ok) {
                setGrants((prev) => prev.filter((g) => g.id !== grant.id));
                Alert.alert(s.mobilePrivacy.revoked[lang]);
              } else {
                Alert.alert(s.common.error[lang], s.common.tryAgain[lang]);
              }
            } catch {
              Alert.alert(s.common.error[lang], s.common.tryAgain[lang]);
            }
          },
        },
      ]
    );
  };

  const handleGrantNew = () => {
    Alert.alert(
      s.mobilePrivacy.grantNewAccess[lang],
      s.mobilePrivacy.grantPlaceholder[lang]
    );
  };

  const formatDate = (dateStr: string): string => {
    try {
      return new Date(dateStr).toLocaleDateString(
        lang === 'ar' ? 'ar-EG' : 'en-US',
        { year: 'numeric', month: 'short', day: 'numeric' }
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
            {s.mobilePrivacy.title[lang]}
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
          {s.mobilePrivacy.title[lang]}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchGrants();
            }}
            tintColor="#0D7A7A"
          />
        }
      >
        {/* Section title */}
        <Text style={[styles.sectionTitle, isRtl && styles.textRtl]}>
          {s.mobilePrivacy.whoCanAccess[lang]}
        </Text>

        {grants.length > 0 ? (
          grants.map((grant) => {
            const doctorName =
              lang === 'ar'
                ? grant.doctor_name_ar
                : (grant.doctor_name_en ?? grant.doctor_name_ar);
            const scopeLabel =
              lang === 'ar' ? grant.scope_ar : grant.scope_en;

            return (
              <View key={grant.id} style={styles.grantCard}>
                <View style={[styles.grantHeader, isRtl && styles.rowRtl]}>
                  <View style={styles.grantAvatarCircle}>
                    <Text style={styles.grantAvatarText}>
                      {doctorName[0]}
                    </Text>
                  </View>
                  <View style={styles.grantInfo}>
                    <Text
                      style={[styles.grantDoctorName, isRtl && styles.textRtl]}
                      numberOfLines={1}
                    >
                      {doctorName}
                    </Text>
                    <Text style={[styles.grantScope, isRtl && styles.textRtl]}>
                      {s.mobilePrivacy.scope[lang]}: {scopeLabel}
                    </Text>
                    <Text style={[styles.grantDate, isRtl && styles.textRtl]}>
                      {s.mobilePrivacy.grantedOn[lang]}: {formatDate(grant.granted_at)}
                    </Text>
                    {grant.expires_at && (
                      <Text style={[styles.grantExpiry, isRtl && styles.textRtl]}>
                        {s.privacy.expiresIn[lang]}: {formatDate(grant.expires_at)}
                      </Text>
                    )}
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.revokeBtn}
                  onPress={() => handleRevoke(grant)}
                >
                  <Text style={styles.revokeBtnText}>
                    {s.mobilePrivacy.revokeAccess[lang]}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🔒</Text>
            <Text style={[styles.emptyText, isRtl && styles.textRtl]}>
              {s.mobilePrivacy.noGrants[lang]}
            </Text>
          </View>
        )}

        {/* Grant new access CTA */}
        <TouchableOpacity style={styles.grantNewBtn} onPress={handleGrantNew}>
          <Text style={styles.grantNewBtnText}>
            {s.mobilePrivacy.grantNewAccess[lang]}
          </Text>
        </TouchableOpacity>
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
  rowRtl: {
    flexDirection: 'row-reverse',
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A2F4A',
    fontFamily: 'Cairo-Bold',
    marginBottom: 12,
  },
  grantCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  grantHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  grantAvatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0D7A7A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  grantAvatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  grantInfo: {
    flex: 1,
  },
  grantDoctorName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A2F4A',
    fontFamily: 'Cairo-SemiBold',
  },
  grantScope: {
    fontSize: 13,
    color: '#0D7A7A',
    fontFamily: 'Cairo',
    marginTop: 2,
  },
  grantDate: {
    fontSize: 12,
    color: '#999',
    fontFamily: 'Cairo',
    marginTop: 2,
  },
  grantExpiry: {
    fontSize: 12,
    color: '#F57C00',
    fontFamily: 'Cairo',
    marginTop: 2,
  },
  revokeBtn: {
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  revokeBtnText: {
    color: '#C62828',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Cairo-SemiBold',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
    marginBottom: 16,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    fontFamily: 'Cairo',
    textAlign: 'center',
  },
  grantNewBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#0D7A7A',
    borderStyle: 'dashed',
    marginTop: 8,
  },
  grantNewBtnText: {
    color: '#0D7A7A',
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'Cairo-SemiBold',
  },
});
