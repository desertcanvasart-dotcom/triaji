/**
 * Doctor Registration Screen — full registration form for new doctors.
 * Posts to /api/doctor/auth/register.
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
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useLang } from '@/hooks/useLang';
import { s } from '@triaji/shared/i18n';

const API_BASE_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'https://app.triajji.com';

const SPECIALTIES: { ar: string; en: string }[] = [
  { ar: 'باطنة', en: 'Internal Medicine' },
  { ar: 'أطفال', en: 'Pediatrics' },
  { ar: 'نساء وتوليد', en: 'OB/GYN' },
  { ar: 'عظام', en: 'Orthopedics' },
  { ar: 'جراحة عامة', en: 'General Surgery' },
  { ar: 'قلب وأوعية دموية', en: 'Cardiology' },
  { ar: 'مخ وأعصاب', en: 'Neurology' },
  { ar: 'أنف وأذن وحنجرة', en: 'ENT' },
  { ar: 'عيون', en: 'Ophthalmology' },
  { ar: 'جلدية', en: 'Dermatology' },
  { ar: 'مسالك بولية', en: 'Urology' },
  { ar: 'أمراض صدرية', en: 'Pulmonology' },
  { ar: 'طب نفسي', en: 'Psychiatry' },
  { ar: 'أسنان', en: 'Dentistry' },
  { ar: 'تخصص آخر', en: 'Other' },
];

const GOVERNORATES: { ar: string; en: string; id: string }[] = [
  { id: 'cairo', ar: 'القاهرة', en: 'Cairo' },
  { id: 'giza', ar: 'الجيزة', en: 'Giza' },
  { id: 'alexandria', ar: 'الإسكندرية', en: 'Alexandria' },
  { id: 'dakahlia', ar: 'الدقهلية', en: 'Dakahlia' },
  { id: 'sharqia', ar: 'الشرقية', en: 'Sharqia' },
  { id: 'qalyubia', ar: 'القليوبية', en: 'Qalyubia' },
  { id: 'gharbia', ar: 'الغربية', en: 'Gharbia' },
  { id: 'monufia', ar: 'المنوفية', en: 'Monufia' },
  { id: 'beheira', ar: 'البحيرة', en: 'Beheira' },
  { id: 'fayoum', ar: 'الفيوم', en: 'Fayoum' },
  { id: 'minya', ar: 'المنيا', en: 'Minya' },
  { id: 'assiut', ar: 'أسيوط', en: 'Assiut' },
  { id: 'sohag', ar: 'سوهاج', en: 'Sohag' },
  { id: 'qena', ar: 'قنا', en: 'Qena' },
  { id: 'luxor', ar: 'الأقصر', en: 'Luxor' },
  { id: 'aswan', ar: 'أسوان', en: 'Aswan' },
  { id: 'ismailia', ar: 'الإسماعيلية', en: 'Ismailia' },
  { id: 'suez', ar: 'السويس', en: 'Suez' },
  { id: 'port_said', ar: 'بورسعيد', en: 'Port Said' },
  { id: 'other', ar: 'محافظة أخرى', en: 'Other' },
];

export default function DoctorRegisterScreen() {
  const { lang, isRtl } = useLang();

  const [name, setName] = useState('');
  const [syndicateNumber, setSyndicateNumber] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [governorate, setGovernorate] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSpecialtyPicker, setShowSpecialtyPicker] = useState(false);
  const [showGovernoratePicker, setShowGovernoratePicker] = useState(false);

  const validate = (): string | null => {
    if (!name.trim() || !syndicateNumber.trim() || !phone.trim() || !email.trim() || !password) {
      return s.doctorAuth.allFieldsRequired[lang];
    }
    if (!/^\d{4,8}$/.test(syndicateNumber.trim())) {
      return s.doctorAuth.invalidSyndicate[lang];
    }
    if (!/^01[0125]\d{8}$/.test(phone.trim())) {
      return s.doctorAuth.invalidPhone[lang];
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return s.doctorAuth.invalidEmail[lang];
    }
    if (password.length < 8) {
      return s.doctorAuth.passwordMinLength[lang];
    }
    if (password !== confirmPassword) {
      return s.doctorAuth.passwordMismatch[lang];
    }
    return null;
  };

  const handleRegister = async () => {
    setError('');

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/doctor/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name_ar: name.trim(),
          syndicate_number: syndicateNumber.trim(),
          specialty_ar: specialty || null,
          governorate_id: governorate || null,
          clinic_name_ar: '',
          phone: phone.trim(),
          email: email.trim(),
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? s.common.error[lang]);
        return;
      }

      Alert.alert(
        s.doctorAuth.pendingTitle[lang],
        s.doctorAuth.registrationSuccess[lang],
        [
          {
            text: s.common.confirm[lang],
            onPress: () => router.replace('/(doctor)/login'),
          },
        ]
      );
    } catch {
      setError(s.doctorAuth.connectionError[lang]);
    } finally {
      setLoading(false);
    }
  };

  const getSelectedSpecialtyLabel = (): string => {
    if (!specialty) return s.doctorAuth.selectSpecialty[lang];
    const found = SPECIALTIES.find((sp) => sp.ar === specialty);
    return found ? found[lang] : specialty;
  };

  const getSelectedGovernorateLabel = (): string => {
    if (!governorate) return s.doctorAuth.selectGovernorate[lang];
    const found = GOVERNORATES.find((g) => g.id === governorate);
    return found ? found[lang] : governorate;
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
          {/* Header */}
          <View style={styles.headerSection}>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={styles.backBtn}>{s.common.back[lang]}</Text>
            </TouchableOpacity>
            <Text style={[styles.title, isRtl && styles.textRtl]}>
              {s.doctorAuth.registerTitle[lang]}
            </Text>
            <Text style={[styles.subtitle, isRtl && styles.textRtl]}>
              {s.doctorAuth.registerSubtitle[lang]}
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
            {/* Full Name */}
            <Text style={[styles.label, isRtl && styles.textRtl]}>
              {s.doctorAuth.fullName[lang]}
            </Text>
            <TextInput
              style={[styles.input, isRtl && styles.inputRtl]}
              value={name}
              onChangeText={setName}
              placeholder={s.doctorAuth.fullNamePlaceholder[lang]}
              placeholderTextColor="#999"
            />

            {/* Syndicate Number */}
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
            />

            {/* Specialty Picker */}
            <Text style={[styles.label, isRtl && styles.textRtl]}>
              {s.doctorAuth.specialty[lang]}
            </Text>
            <TouchableOpacity
              style={styles.pickerBtn}
              onPress={() => setShowSpecialtyPicker(!showSpecialtyPicker)}
            >
              <Text
                style={[
                  styles.pickerBtnText,
                  !specialty && styles.pickerPlaceholder,
                  isRtl && styles.textRtl,
                ]}
              >
                {getSelectedSpecialtyLabel()}
              </Text>
              <Text style={styles.chevron}>{showSpecialtyPicker ? '▲' : '▼'}</Text>
            </TouchableOpacity>
            {showSpecialtyPicker && (
              <View style={styles.pickerList}>
                {SPECIALTIES.map((sp) => (
                  <TouchableOpacity
                    key={sp.ar}
                    style={[
                      styles.pickerItem,
                      specialty === sp.ar && styles.pickerItemSelected,
                    ]}
                    onPress={() => {
                      setSpecialty(sp.ar);
                      setShowSpecialtyPicker(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.pickerItemText,
                        specialty === sp.ar && styles.pickerItemTextSelected,
                        isRtl && styles.textRtl,
                      ]}
                    >
                      {sp[lang]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Governorate Picker */}
            <Text style={[styles.label, isRtl && styles.textRtl]}>
              {s.doctorAuth.governorate[lang]}
            </Text>
            <TouchableOpacity
              style={styles.pickerBtn}
              onPress={() => setShowGovernoratePicker(!showGovernoratePicker)}
            >
              <Text
                style={[
                  styles.pickerBtnText,
                  !governorate && styles.pickerPlaceholder,
                  isRtl && styles.textRtl,
                ]}
              >
                {getSelectedGovernorateLabel()}
              </Text>
              <Text style={styles.chevron}>{showGovernoratePicker ? '▲' : '▼'}</Text>
            </TouchableOpacity>
            {showGovernoratePicker && (
              <View style={styles.pickerList}>
                {GOVERNORATES.map((gov) => (
                  <TouchableOpacity
                    key={gov.id}
                    style={[
                      styles.pickerItem,
                      governorate === gov.id && styles.pickerItemSelected,
                    ]}
                    onPress={() => {
                      setGovernorate(gov.id);
                      setShowGovernoratePicker(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.pickerItemText,
                        governorate === gov.id && styles.pickerItemTextSelected,
                        isRtl && styles.textRtl,
                      ]}
                    >
                      {gov[lang]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Phone */}
            <Text style={[styles.label, isRtl && styles.textRtl]}>
              {s.doctorAuth.phone[lang]}
            </Text>
            <TextInput
              style={[styles.input, isRtl && styles.inputRtl]}
              value={phone}
              onChangeText={setPhone}
              placeholder="01XXXXXXXXX"
              placeholderTextColor="#999"
              keyboardType="phone-pad"
              maxLength={11}
            />

            {/* Email */}
            <Text style={[styles.label, isRtl && styles.textRtl]}>
              {s.doctorAuth.email[lang]}
            </Text>
            <TextInput
              style={[styles.input, { textAlign: 'left' }]}
              value={email}
              onChangeText={setEmail}
              placeholder={s.doctorAuth.emailPlaceholder[lang]}
              placeholderTextColor="#999"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            {/* Password */}
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

            {/* Confirm Password */}
            <Text style={[styles.label, isRtl && styles.textRtl]}>
              {s.doctorAuth.confirmPassword[lang]}
            </Text>
            <TextInput
              style={[styles.input, isRtl && styles.inputRtl]}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder={s.doctorAuth.confirmPassword[lang]}
              placeholderTextColor="#999"
              secureTextEntry
            />

            {/* Submit */}
            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleRegister}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.btnText}>
                  {s.doctorAuth.registerButton[lang]}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Login link */}
          <View style={styles.footer}>
            <Text style={[styles.footerText, isRtl && styles.textRtl]}>
              {s.doctorAuth.hasAccount[lang]}{' '}
            </Text>
            <TouchableOpacity
              onPress={() => router.replace('/(doctor)/login')}
            >
              <Text style={styles.footerLink}>
                {s.doctorAuth.loginLink[lang]}
              </Text>
            </TouchableOpacity>
          </View>
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
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  headerSection: {
    marginBottom: 24,
  },
  backBtn: {
    fontSize: 14,
    color: '#0D7A7A',
    fontFamily: 'Cairo-SemiBold',
    marginBottom: 16,
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
    gap: 8,
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
  pickerBtn: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FAFAFA',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickerBtnText: {
    fontSize: 16,
    color: '#1A2F4A',
    flex: 1,
  },
  pickerPlaceholder: {
    color: '#999',
  },
  chevron: {
    fontSize: 12,
    color: '#999',
    marginLeft: 8,
  },
  pickerList: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    maxHeight: 200,
    overflow: 'hidden',
  },
  pickerItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  pickerItemSelected: {
    backgroundColor: '#E0F2F1',
  },
  pickerItemText: {
    fontSize: 15,
    color: '#1A2F4A',
    fontFamily: 'Cairo',
  },
  pickerItemTextSelected: {
    color: '#0D7A7A',
    fontWeight: '600',
  },
  btn: {
    backgroundColor: '#1A2F4A',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
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
});
