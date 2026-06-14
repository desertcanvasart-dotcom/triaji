/**
 * Welcome Screen — language select + sign in / skip.
 */

import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { router } from 'expo-router';
import { useLang } from '@/hooks/useLang';
import { s } from '@triaji/shared/i18n';

export default function WelcomeScreen() {
  const { lang, isRtl, toggleLang } = useLang();

  return (
    <View style={[styles.container, isRtl && styles.rtl]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={toggleLang} style={styles.langBtn}>
          <Text style={styles.langBtnText}>
            {lang === 'ar' ? 'English' : 'العربية'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.hero}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoText}>T</Text>
        </View>
        <Text style={[styles.title, isRtl && styles.textRtl]}>
          {s.common.appName[lang]}
        </Text>
        <Text style={[styles.subtitle, isRtl && styles.textRtl]}>
          {s.common.tagline[lang]}
        </Text>
      </View>

      <View style={styles.warningCard}>
        <Text style={[styles.warningTitle, isRtl && styles.textRtl]}>
          {s.home.warningTitle[lang]}
        </Text>
        <Text style={[styles.warningBody, isRtl && styles.textRtl]}>
          {s.home.warningBody[lang]}
        </Text>
        <Text style={[styles.emergencyText, isRtl && styles.textRtl]}>
          {s.home.emergencyWarning[lang]} {s.common.emergencyNumber[lang]} {s.home.emergencyImmediately[lang]}
        </Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => router.push('/(auth)/otp')}
        >
          <Text style={styles.primaryBtnText}>
            {s.login.title[lang]}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => router.replace('/(patient)/chat')}
        >
          <Text style={styles.secondaryBtnText}>
            {s.login.skipLogin[lang]}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Doctor login link */}
      <TouchableOpacity
        style={styles.doctorLink}
        onPress={() => router.push('/(doctor)/login')}
      >
        <Text style={styles.doctorLinkText}>
          {s.doctorAuth.loginTitle[lang]}
        </Text>
      </TouchableOpacity>

      <Text style={[styles.disclaimer, isRtl && styles.textRtl]}>
        {s.common.disclaimer[lang]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  rtl: {
    direction: 'rtl',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  langBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
  },
  langBtnText: {
    fontSize: 14,
    color: '#1A2F4A',
    fontWeight: '600',
  },
  hero: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 32,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#0D7A7A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1A2F4A',
    fontFamily: 'Cairo-Bold',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
    fontFamily: 'Cairo',
  },
  textRtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  warningCard: {
    backgroundColor: '#FFF8E1',
    borderRadius: 12,
    padding: 16,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#FFE082',
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#E65100',
    marginBottom: 8,
    fontFamily: 'Cairo-Bold',
  },
  warningBody: {
    fontSize: 14,
    color: '#4E342E',
    lineHeight: 22,
    marginBottom: 8,
    fontFamily: 'Cairo',
  },
  emergencyText: {
    fontSize: 14,
    color: '#C62828',
    fontWeight: '600',
    fontFamily: 'Cairo-SemiBold',
  },
  actions: {
    gap: 12,
  },
  primaryBtn: {
    backgroundColor: '#0D7A7A',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'Cairo-Bold',
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: '#0D7A7A',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: '#0D7A7A',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Cairo-SemiBold',
  },
  doctorLink: {
    alignItems: 'center',
    marginTop: 20,
    paddingVertical: 12,
  },
  doctorLinkText: {
    fontSize: 14,
    color: '#1A2F4A',
    fontWeight: '600',
    fontFamily: 'Cairo-SemiBold',
  },
  disclaimer: {
    textAlign: 'center',
    fontSize: 12,
    color: '#999',
    marginTop: 16,
    fontFamily: 'Cairo',
  },
});
