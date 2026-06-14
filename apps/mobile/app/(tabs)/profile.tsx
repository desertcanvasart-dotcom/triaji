/**
 * Profile Tab — Patient settings, language toggle, logout.
 */

import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';
import { useLang } from '@/hooks/useLang';
import { useAuth } from '@/hooks/useAuth';
import { s } from '@triaji/shared/i18n';

export default function ProfileScreen() {
  const { lang, isRtl, toggleLang } = useLang();
  const { authenticated, patientName, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert(
      lang === 'ar' ? 'تسجيل الخروج' : 'Sign Out',
      lang === 'ar' ? 'هل أنت متأكد؟' : 'Are you sure?',
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, isRtl && styles.textRtl]}>
          {lang === 'ar' ? 'حسابي' : 'My Profile'}
        </Text>
      </View>

      <View style={styles.content}>
        {/* User info */}
        <View style={styles.card}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>
              {patientName ? patientName[0] : '?'}
            </Text>
          </View>
          <Text style={[styles.userName, isRtl && styles.textRtl]}>
            {patientName ?? (lang === 'ar' ? 'مستخدم' : 'Guest')}
          </Text>
          {!authenticated && (
            <Text style={[styles.guestLabel, isRtl && styles.textRtl]}>
              {lang === 'ar' ? 'غير مسجل' : 'Not signed in'}
            </Text>
          )}
        </View>

        {/* Settings */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isRtl && styles.textRtl]}>
            {lang === 'ar' ? 'الإعدادات' : 'Settings'}
          </Text>

          {/* Language toggle */}
          <TouchableOpacity
            style={[styles.settingRow, isRtl && styles.rowRtl]}
            onPress={toggleLang}
          >
            <Text style={styles.settingIcon}>🌐</Text>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, isRtl && styles.textRtl]}>
                {lang === 'ar' ? 'اللغة' : 'Language'}
              </Text>
              <Text style={[styles.settingValue, isRtl && styles.textRtl]}>
                {lang === 'ar' ? 'العربية' : 'English'}
              </Text>
            </View>
            <Text style={styles.chevron}>{isRtl ? '‹' : '›'}</Text>
          </TouchableOpacity>
        </View>

        {/* About */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isRtl && styles.textRtl]}>
            {lang === 'ar' ? 'عن التطبيق' : 'About'}
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
              {lang === 'ar' ? 'تسجيل الخروج' : 'Sign Out'}
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
      </View>
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
