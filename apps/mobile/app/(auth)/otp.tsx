/**
 * OTP Screen — phone number entry + OTP verification.
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
} from 'react-native';
import { useLang } from '@/hooks/useLang';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { registerForPushNotifications } from '@/lib/notifications';
import { s } from '@triaji/shared/i18n';

type Step = 'phone' | 'otp';

export default function OtpScreen() {
  const { lang, isRtl } = useLang();
  const { login } = useAuth();

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSendOtp = async () => {
    const cleaned = phone.replace(/\s/g, '');
    if (!/^01[0125]\d{8}$/.test(cleaned)) {
      setError(s.login.invalidPhone[lang]);
      return;
    }

    setLoading(true);
    setError('');

    try {
      await api.requestOtp(cleaned);
      setStep('otp');
    } catch (err) {
      setError(s.login.connectionError[lang]);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length < 4) return;

    setLoading(true);
    setError('');

    try {
      const result = await api.verifyOtp(phone.replace(/\s/g, ''), otp);
      if (result.success) {
        login(result.patientId, result.patientId, result.nameAr);
        registerForPushNotifications();
      } else {
        setError(s.login.invalidOtp[lang]);
      }
    } catch {
      setError(s.login.connectionError[lang]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, isRtl && styles.rtl]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <Text style={[styles.title, isRtl && styles.textRtl]}>
          {s.login.title[lang]}
        </Text>
        <Text style={[styles.subtitle, isRtl && styles.textRtl]}>
          {s.login.description[lang]}
        </Text>

        {step === 'phone' ? (
          <View style={styles.form}>
            <Text style={[styles.label, isRtl && styles.textRtl]}>
              {s.login.phoneLabel[lang]}
            </Text>
            <TextInput
              style={[styles.input, isRtl && styles.inputRtl]}
              value={phone}
              onChangeText={setPhone}
              placeholder="01XXXXXXXXX"
              keyboardType="phone-pad"
              maxLength={11}
              autoFocus
            />

            <Text style={[styles.hint, isRtl && styles.textRtl]}>
              {s.login.otpSentVia[lang]}
            </Text>

            {error ? (
              <Text style={styles.error}>{error}</Text>
            ) : null}

            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleSendOtp}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.btnText}>
                  {s.login.sendOtp[lang]}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.form}>
            <Text style={[styles.sentTo, isRtl && styles.textRtl]}>
              {s.login.otpSentTo[lang]} {phone}
            </Text>

            <Text style={[styles.label, isRtl && styles.textRtl]}>
              {s.login.otpLabel[lang]}
            </Text>
            <TextInput
              style={[styles.input, styles.otpInput]}
              value={otp}
              onChangeText={setOtp}
              placeholder="• • • • • •"
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
              textAlign="center"
            />

            {error ? (
              <Text style={styles.error}>{error}</Text>
            ) : null}

            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleVerifyOtp}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.btnText}>
                  {s.login.verifyOtp[lang]}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setStep('phone');
                setOtp('');
                setError('');
              }}
            >
              <Text style={styles.changeNumber}>
                {s.login.changeNumber[lang]}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  rtl: {
    direction: 'rtl',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 100,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1A2F4A',
    marginBottom: 8,
    fontFamily: 'Cairo-Bold',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 32,
    fontFamily: 'Cairo',
  },
  textRtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  form: {
    gap: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A2F4A',
    fontFamily: 'Cairo-SemiBold',
  },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    color: '#1A2F4A',
    backgroundColor: '#FAFAFA',
  },
  inputRtl: {
    textAlign: 'right',
  },
  otpInput: {
    fontSize: 24,
    letterSpacing: 8,
  },
  hint: {
    fontSize: 13,
    color: '#888',
    fontFamily: 'Cairo',
  },
  sentTo: {
    fontSize: 14,
    color: '#0D7A7A',
    marginBottom: 8,
    fontFamily: 'Cairo',
  },
  error: {
    fontSize: 14,
    color: '#C62828',
    textAlign: 'center',
  },
  btn: {
    backgroundColor: '#0D7A7A',
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
  changeNumber: {
    color: '#0D7A7A',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    fontFamily: 'Cairo',
  },
});
