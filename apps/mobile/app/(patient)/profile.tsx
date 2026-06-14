/**
 * Profile Tab — Patient settings, language toggle, insurance, notifications,
 * biometric auth, and logout.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Switch,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useLang } from '@/hooks/useLang';
import { useAuth } from '@/hooks/useAuth';
import { s } from '@triaji/shared/i18n';

const API_BASE_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'https://app.triajji.com';

interface InsuranceStatus {
  policy_number?: string;
  status: 'verified' | 'unverified' | 'none';
  insurer_name_ar?: string;
  insurer_name_en?: string;
}

interface NotificationPrefs {
  follow_ups: boolean;
  lab_results: boolean;
  prescriptions: boolean;
}

export default function ProfileScreen() {
  const { lang, isRtl, toggleLang } = useLang();
  const { authenticated, patientName, logout } = useAuth();

  const [insurance, setInsurance] = useState<InsuranceStatus | null>(null);
  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs>({
    follow_ups: true,
    lab_results: true,
    prescriptions: true,
  });
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [loadingInsurance, setLoadingInsurance] = useState(true);

  // Fetch insurance status
  const fetchInsurance = useCallback(async () => {
    if (!authenticated) {
      setLoadingInsurance(false);
      return;
    }
    try {
      const { getPatientToken } = await import('@/lib/storage');
      const token = getPatientToken();

      const res = await fetch(`${API_BASE_URL}/api/patient/insurance`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (res.ok) {
        const data = await res.json();
        setInsurance(data.insurance ?? data ?? null);
      } else {
        setInsurance({ status: 'none' });
      }
    } catch {
      setInsurance({ status: 'none' });
    } finally {
      setLoadingInsurance(false);
    }
  }, [authenticated]);

  // Load notification prefs + biometric setting from storage
  useEffect(() => {
    const loadPrefs = async () => {
      try {
        const { storage } = await import('@/lib/storage');
        const prefsStr = storage.getString('notification-prefs');
        if (prefsStr) {
          setNotifPrefs(JSON.parse(prefsStr));
        }
        const bio = storage.getBoolean('biometric-enabled');
        if (bio !== undefined) {
          setBiometricEnabled(bio);
        }
      } catch {
        // Use defaults
      }
    };
    loadPrefs();
  }, []);

  useEffect(() => {
    fetchInsurance();
  }, [fetchInsurance]);

  const handleNotifToggle = async (
    key: keyof NotificationPrefs,
    value: boolean
  ) => {
    const updated = { ...notifPrefs, [key]: value };
    setNotifPrefs(updated);

    try {
      const { storage } = await import('@/lib/storage');
      storage.set('notification-prefs', JSON.stringify(updated));
    } catch {
      // Silently fail
    }
  };

  const handleBiometricToggle = async (value: boolean) => {
    setBiometricEnabled(value);
    try {
      const { storage } = await import('@/lib/storage');
      storage.set('biometric-enabled', value);
    } catch {
      // Silently fail
    }
  };

  const handleLogout = () => {
    Alert.alert(
      s.mobileProfile.signOut[lang],
      s.mobileProfile.signOutConfirm[lang],
      [
        { text: s.common.cancel[lang], style: 'cancel' },
        {
          text: s.common.confirm[lang],
          style: 'destructive',
          onPress: logout,
        },
      ]
    );
  };

  const getInsuranceBadge = (): { label: string; color: string; bg: string } => {
    if (!insurance || insurance.status === 'none') {
      return {
        label: s.mobileProfile.noInsurance[lang],
        color: '#999',
        bg: '#F5F5F5',
      };
    }
    if (insurance.status === 'verified') {
      return {
        label: s.mobileProfile.insuranceVerified[lang],
        color: '#2E7D32',
        bg: '#E8F5E9',
      };
    }
    return {
      label: s.mobileProfile.insuranceUnverified[lang],
      color: '#F57C00',
      bg: '#FFF8E1',
    };
  };

  const badge = getInsuranceBadge();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, isRtl && styles.textRtl]}>
          {s.mobileProfile.myProfile[lang]}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* User info card */}
        <View style={styles.card}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>
              {patientName ? patientName[0] : '?'}
            </Text>
          </View>
          <Text style={[styles.userName, isRtl && styles.textRtl]}>
            {patientName ?? s.mobileProfile.guest[lang]}
          </Text>
          {!authenticated && (
            <Text style={[styles.guestLabel, isRtl && styles.textRtl]}>
              {s.mobileProfile.notSignedIn[lang]}
            </Text>
          )}
        </View>

        {/* Insurance section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isRtl && styles.textRtl]}>
            {s.mobileProfile.insurance[lang]}
          </Text>

          {loadingInsurance ? (
            <View style={styles.settingRow}>
              <ActivityIndicator size="small" color="#0D7A7A" />
            </View>
          ) : insurance && insurance.status !== 'none' ? (
            <View style={[styles.settingRow, isRtl && styles.rowRtl]}>
              <Text style={styles.settingIcon}>🛡️</Text>
              <View style={styles.settingInfo}>
                <Text style={[styles.settingLabel, isRtl && styles.textRtl]}>
                  {lang === 'ar'
                    ? (insurance.insurer_name_ar ?? s.mobileProfile.insurance[lang])
                    : (insurance.insurer_name_en ?? s.mobileProfile.insurance[lang])}
                </Text>
                {insurance.policy_number && (
                  <Text style={[styles.settingValue, isRtl && styles.textRtl]}>
                    {s.mobileProfile.policyNumber[lang]}: {insurance.policy_number}
                  </Text>
                )}
              </View>
              <View style={[styles.insuranceBadge, { backgroundColor: badge.bg }]}>
                <Text style={[styles.insuranceBadgeText, { color: badge.color }]}>
                  {badge.label}
                </Text>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.settingRow, isRtl && styles.rowRtl]}
              onPress={() => router.push('/insurance' as never)}
            >
              <Text style={styles.settingIcon}>🛡️</Text>
              <View style={styles.settingInfo}>
                <Text style={[styles.settingLabel, isRtl && styles.textRtl]}>
                  {s.mobileProfile.noInsurance[lang]}
                </Text>
                <Text style={[styles.settingValue, isRtl && styles.textRtl]}>
                  {s.mobileProfile.addInsurance[lang]}
                </Text>
              </View>
              <Text style={styles.chevron}>{isRtl ? '‹' : '›'}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Notification preferences */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isRtl && styles.textRtl]}>
            {s.mobileProfile.notifications[lang]}
          </Text>

          <View style={[styles.settingRow, isRtl && styles.rowRtl]}>
            <Text style={styles.settingIcon}>📅</Text>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, isRtl && styles.textRtl]}>
                {s.mobileProfile.notifFollowUps[lang]}
              </Text>
            </View>
            <Switch
              value={notifPrefs.follow_ups}
              onValueChange={(v) => handleNotifToggle('follow_ups', v)}
              trackColor={{ true: '#0D7A7A', false: '#DDD' }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={[styles.settingRow, isRtl && styles.rowRtl]}>
            <Text style={styles.settingIcon}>🧪</Text>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, isRtl && styles.textRtl]}>
                {s.mobileProfile.notifLabResults[lang]}
              </Text>
            </View>
            <Switch
              value={notifPrefs.lab_results}
              onValueChange={(v) => handleNotifToggle('lab_results', v)}
              trackColor={{ true: '#0D7A7A', false: '#DDD' }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={[styles.settingRow, isRtl && styles.rowRtl]}>
            <Text style={styles.settingIcon}>💊</Text>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, isRtl && styles.textRtl]}>
                {s.mobileProfile.notifPrescriptions[lang]}
              </Text>
            </View>
            <Switch
              value={notifPrefs.prescriptions}
              onValueChange={(v) => handleNotifToggle('prescriptions', v)}
              trackColor={{ true: '#0D7A7A', false: '#DDD' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* Settings */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isRtl && styles.textRtl]}>
            {s.mobileProfile.settings[lang]}
          </Text>

          {/* Language toggle */}
          <TouchableOpacity
            style={[styles.settingRow, isRtl && styles.rowRtl]}
            onPress={toggleLang}
          >
            <Text style={styles.settingIcon}>🌐</Text>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, isRtl && styles.textRtl]}>
                {s.mobileProfile.language[lang]}
              </Text>
              <Text style={[styles.settingValue, isRtl && styles.textRtl]}>
                {lang === 'ar' ? 'العربية' : 'English'}
              </Text>
            </View>
            <Text style={styles.chevron}>{isRtl ? '‹' : '›'}</Text>
          </TouchableOpacity>

          {/* Biometric auth toggle */}
          <View style={[styles.settingRow, isRtl && styles.rowRtl]}>
            <Text style={styles.settingIcon}>🔐</Text>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, isRtl && styles.textRtl]}>
                {s.mobileProfile.biometric[lang]}
              </Text>
              <Text style={[styles.settingValue, isRtl && styles.textRtl]}>
                {s.mobileProfile.biometricDesc[lang]}
              </Text>
            </View>
            <Switch
              value={biometricEnabled}
              onValueChange={handleBiometricToggle}
              trackColor={{ true: '#0D7A7A', false: '#DDD' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* About */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isRtl && styles.textRtl]}>
            {s.mobileProfile.about[lang]}
          </Text>

          <View style={[styles.settingRow, isRtl && styles.rowRtl]}>
            <Text style={styles.settingIcon}>ℹ️</Text>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, isRtl && styles.textRtl]}>
                {s.common.appName[lang]}
              </Text>
              <Text style={[styles.settingValue, isRtl && styles.textRtl]}>
                v1.0.0
              </Text>
            </View>
          </View>

          <View style={styles.disclaimerCard}>
            <Text style={[styles.disclaimerText, isRtl && styles.textRtl]}>
              {s.common.disclaimer[lang]}
            </Text>
          </View>
        </View>

        {/* Auth actions */}
        {authenticated ? (
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Text style={styles.logoutText}>
              {s.mobileProfile.signOut[lang]}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.loginBtn}
            onPress={() => router.push('/(auth)/otp')}
          >
            <Text style={styles.loginBtnText}>
              {s.login.title[lang]}
            </Text>
          </TouchableOpacity>
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
  rowRtl: {
    flexDirection: 'row-reverse',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
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
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#0D7A7A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A2F4A',
    fontFamily: 'Cairo-Bold',
  },
  guestLabel: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
    fontFamily: 'Cairo',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
    marginBottom: 8,
    paddingHorizontal: 4,
    fontFamily: 'Cairo-SemiBold',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 2,
    gap: 12,
  },
  settingIcon: {
    fontSize: 22,
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    color: '#1A2F4A',
    fontFamily: 'Cairo',
  },
  settingValue: {
    fontSize: 13,
    color: '#888',
    fontFamily: 'Cairo',
  },
  chevron: {
    fontSize: 24,
    color: '#CCC',
  },
  insuranceBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  insuranceBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Cairo-SemiBold',
  },
  disclaimerCard: {
    backgroundColor: '#FFF8E1',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  disclaimerText: {
    fontSize: 13,
    color: '#795548',
    lineHeight: 20,
    fontFamily: 'Cairo',
  },
  logoutBtn: {
    backgroundColor: '#FFEBEE',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  logoutText: {
    color: '#C62828',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Cairo-SemiBold',
  },
  loginBtn: {
    backgroundColor: '#0D7A7A',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  loginBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Cairo-Bold',
  },
});
