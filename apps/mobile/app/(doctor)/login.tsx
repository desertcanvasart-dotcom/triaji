/**
 * Doctor Login Screen — syndicate number + password authentication.
 * Posts to /api/doctor/auth/login using email constructed from syndicate number.
 */

import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { useLang } from '@/hooks/useLang';
import { useAuth } from '@/hooks/useAuth';
import { s } from '@triaji/shared/i18n';

const API_BASE_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'https://app.triajji.com';

interface LoginResponse {
  user?: { id: string };
  doctorAccount?: {
    id: string;
    name_ar: string;
    name_en?: string;
    syndicate_number: string;
    verification_status: 'pending' | 'verified' | 'rejected';
    rejection_reason?: string;
  };
  session?: {
    access_token: string;
    refresh_token: string;
  };
  error?: string;
}

export default function DoctorLoginScreen() {
  const { lang, isRtl } = useLang();
  const { loginAsDoctor } = useAuth();

  const [syndicateNumber, setSyndicateNumber] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setError('');

    if (!syndicateNumber.trim()) {
      setError(s.doctorAuth.syndicateRequired[lang]);
      return;
    }
    if (!password) {
      setError(s.doctorAuth.passwordRequired[lang]);
      return;
    }

    setLoading(true);

    try {
      // The web app uses email to login; for mobile, we construct the email
      // from the syndicate number using the pattern: syndicate_<number>@triaji.doctor
      const email = `syndicate_${syndicateNumber.trim()}@triaji.doctor`;

      const res = await fetch(`${API_BASE_URL}/api/doctor/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = (await res.json()) as LoginResponse;

      if (!res.ok || !data.session) {
        setError(data.error ?? s.doctorAuth.loginError[lang]);
        return;
      }

      const account = data.doctorAccount;

      if (account?.verification_status === 'pending') {
        setError(s.doctorAuth.pendingText[lang]);
        return;
      }

      if (account?.verification_status === 'rejected') {
        setError(
          account.rejection_reason
            ? `${account.rejection_reason}`
            : s.doctorAuth.loginError[lang]
        );
        return;
      }

      loginAsDoctor(data.session.access_token, {
        id: account?.id ?? data.user?.id ?? '',
        name: lang === 'ar' ? (account?.name_ar ?? '') : (account?.name_en ?? account?.name_ar ?? ''),
        syndicateNumber: account?.syndicate_number ?? syndicateNumber.trim(),
      });
    } catch {
      setError(s.doctorAuth.connectionError[lang]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          {/* Logo */}
          <View style={styles.logoSection}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoText}>T</Text>
            </View>
            <Text style={[styles.title, isRtl && styles.textRtl]}>
              {s.doctorAuth.loginTitle[lang]}
            </Text>
            <Text style={[styles.subtitle, isRtl && styles.textRtl]}>
              {s.doctorAuth.loginSubtitle[lang]}
            </Text>
          </View>

          {/* Error */}
          {error ? (
            <View style={styles.errorCard}>
              <Text style={[styles.errorText, isRtl && styles.textRtl]}>
                {error}
              </Text>
            </View>
          ) : null}

          {/* Form */}
          <View style={styles.form}>
            <Text style={[styles.label, isRtl && styles.textRtl]}>
              {s.doctorAuth.syndicateNumber[lang]}
            </Text>
            <TextInput
              style={[styles.input, isRtl && styles.inputRtl]}
              value={syndicateNumber}
              onChangeText={setSyndicateNumber}
              placeholder={s.doctorAuth.syndicatePlaceholder[lang]}
              placeholderTextColor="#999"
              keyboardType="number-pad"
              maxLength={8}
              autoFocus
            />

            <Text style={[styles.label, isRtl && styles.textRtl]}>
              {s.doctorAuth.password[lang]}
            </Text>
            <TextInput
              style={[styles.input, isRtl && styles.inputRtl]}
              value={password}
              onChangeText={setPassword}
              placeholder={s.doctorAuth.passwordPlaceholder[lang]}
              placeholderTextColor="#999"
              secureTextEntry
            />

            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.btnText}>
                  {s.doctorAuth.loginButton[lang]}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Register link */}
          <View style={styles.footer}>
            <Text style={[styles.footerText, isRtl && styles.textRtl]}>
              {s.doctorAuth.noAccount[lang]}{' '}
            </Text>
            <TouchableOpacity
              onPress={() => router.push('/(doctor)/register')}
            >
              <Text style={styles.footerLink}>
                {s.doctorAuth.registerLink[lang]}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Switch to patient */}
          <TouchableOpacity
            style={styles.switchBtn}
            onPress={() => router.replace('/(auth)')}
          >
            <Text style={styles.switchText}>
              {s.doctorAuth.switchToPatient[lang]}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 40,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#1A2F4A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A2F4A',
    fontFamily: 'Cairo-Bold',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
    fontFamily: 'Cairo',
  },
  textRtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  inputRtl: {
    textAlign: 'right',
  },
  errorCard: {
    backgroundColor: '#FFEBEE',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#C62828',
    fontSize: 14,
    fontFamily: 'Cairo',
    textAlign: 'center',
  },
  form: {
    gap: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A2F4A',
    fontFamily: 'Cairo-SemiBold',
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1A2F4A',
    backgroundColor: '#FAFAFA',
  },
  btn: {
    backgroundColor: '#1A2F4A',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'Cairo-Bold',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  footerText: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'Cairo',
  },
  footerLink: {
    fontSize: 14,
    color: '#0D7A7A',
    fontWeight: '600',
    fontFamily: 'Cairo-SemiBold',
  },
  switchBtn: {
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 12,
  },
  switchText: {
    fontSize: 14,
    color: '#888',
    fontFamily: 'Cairo',
  },
});
