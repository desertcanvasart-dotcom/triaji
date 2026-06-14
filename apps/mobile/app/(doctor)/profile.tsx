/**
 * Doctor Profile — settings, language toggle, notification preferences,
 * video call settings (pricing, duration, availability), switch to patient mode, and logout.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Switch,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useLang } from '@/hooks/useLang';
import { useAuth } from '@/hooks/useAuth';
import { s } from '@triaji/shared/i18n';

const API_BASE_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'https://app.triajji.com';

// ─── Day mapping: Egyptian week (Sat–Fri) ───────────────────────────────────

const DAYS_OF_WEEK = [
  { key: '6', labelKey: 'daySat' as const },
  { key: '0', labelKey: 'daySun' as const },
  { key: '1', labelKey: 'dayMon' as const },
  { key: '2', labelKey: 'dayTue' as const },
  { key: '3', labelKey: 'dayWed' as const },
  { key: '4', labelKey: 'dayThu' as const },
  { key: '5', labelKey: 'dayFri' as const },
];

const DURATION_OPTIONS = [15, 30, 45, 0]; // 0 = unlimited

type FeeType = 'free' | 'with_fee';

interface AvailabilityDay {
  enabled: boolean;
  start: string;
  end: string;
}

type AvailabilityMap = Record<string, AvailabilityDay>;

// ─── Component ──────────────────────────────────────────────────────────────

export default function DoctorProfileScreen() {
  const { lang, isRtl, toggleLang } = useLang();
  const { doctorName, doctorSyndicate, logoutDoctor, switchToPatientMode } = useAuth();

  // Notification preferences (local state, persisted via API in production)
  const [notifNewBookings, setNotifNewBookings] = useState(true);
  const [notifLabResults, setNotifLabResults] = useState(true);
  const [notifReferrals, setNotifReferrals] = useState(true);
  const [notifTransfers, setNotifTransfers] = useState(true);

  // ─── Video Call Settings State ──────────────────────────────────────────

  const [videoCallsEnabled, setVideoCallsEnabled] = useState(false);
  const [feeType, setFeeType] = useState<FeeType>('free');
  const [feeAmount, setFeeAmount] = useState('');
  const [maxDuration, setMaxDuration] = useState(30);
  const [availability, setAvailability] = useState<AvailabilityMap>(() => {
    const initial: AvailabilityMap = {};
    for (const day of DAYS_OF_WEEK) {
      initial[day.key] = { enabled: true, start: '09:00', end: '21:00' };
    }
    return initial;
  });
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  // ─── Fetch existing video call settings ─────────────────────────────────

  const getToken = useCallback(async (): Promise<string> => {
    const { storage } = await import('@/lib/storage');
    return storage.getString('doctor-token') ?? '';
  }, []);

  const fetchVideoCallSettings = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE_URL}/api/doctor/gp-call-settings`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        if (data.gp_video_calls_enabled != null) {
          setVideoCallsEnabled(data.gp_video_calls_enabled);
        }
        if (data.fee_type) {
          setFeeType(data.fee_type);
        }
        if (data.fee_amount != null) {
          setFeeAmount(String(data.fee_amount));
        }
        if (data.max_duration_minutes != null) {
          setMaxDuration(data.max_duration_minutes);
        }
        if (data.availability) {
          // Convert JSONB format { "6": ["09:00","21:00"] } to our internal format
          const parsed: AvailabilityMap = {};
          for (const day of DAYS_OF_WEEK) {
            const dayData = data.availability[day.key];
            if (dayData && Array.isArray(dayData) && dayData.length === 2) {
              parsed[day.key] = { enabled: true, start: dayData[0], end: dayData[1] };
            } else {
              parsed[day.key] = { enabled: false, start: '09:00', end: '21:00' };
            }
          }
          setAvailability(parsed);
        }
      }
    } catch {
      // Use defaults
    } finally {
      setLoadingSettings(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchVideoCallSettings();
  }, [fetchVideoCallSettings]);

  // ─── Save video call settings ─────────────────────────────────────────

  const saveVideoCallSettings = async () => {
    setSavingSettings(true);
    try {
      const token = await getToken();

      // Build availability JSONB: { "6": ["09:00","21:00"], "0": null, ... }
      const availabilityJson: Record<string, string[] | null> = {};
      for (const day of DAYS_OF_WEEK) {
        const dayState = availability[day.key];
        if (dayState?.enabled) {
          availabilityJson[day.key] = [dayState.start, dayState.end];
        } else {
          availabilityJson[day.key] = null;
        }
      }

      const payload = {
        gp_video_calls_enabled: videoCallsEnabled,
        fee_type: feeType,
        fee_amount: feeType === 'with_fee' ? Number(feeAmount) || 0 : 0,
        max_duration_minutes: maxDuration,
        availability: availabilityJson,
      };

      const res = await fetch(`${API_BASE_URL}/api/doctor/gp-call-settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        Alert.alert('', s.videoCall.settingsSaved[lang]);
      } else {
        Alert.alert('', s.common.error[lang]);
      }
    } catch {
      Alert.alert('', s.common.error[lang]);
    } finally {
      setSavingSettings(false);
    }
  };

  // ─── Update availability for a single day ─────────────────────────────

  const updateDayAvailability = (
    dayKey: string,
    field: keyof AvailabilityDay,
    value: string | boolean
  ) => {
    setAvailability((prev) => ({
      ...prev,
      [dayKey]: { ...prev[dayKey], [field]: value },
    }));
  };

  // ─── Validate time format ─────────────────────────────────────────────

  const formatTimeInput = (text: string): string => {
    // Allow only digits and colon, auto-format to HH:MM
    const digits = text.replace(/[^0-9]/g, '');
    if (digits.length <= 2) return digits;
    return `${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
  };

  // ─── Handlers ─────────────────────────────────────────────────────────

  const handleLogout = () => {
    Alert.alert(
      s.doctor.logout[lang],
      lang === 'ar' ? 'هل أنت متأكد؟' : 'Are you sure?',
      [
        { text: s.common.cancel[lang], style: 'cancel' },
        {
          text: s.common.confirm[lang],
          style: 'destructive',
          onPress: logoutDoctor,
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, isRtl && styles.textRtl]}>
          {s.doctor.profile[lang]}
        </Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Doctor info */}
        <View style={styles.card}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>
              {doctorName ? doctorName[0] : 'D'}
            </Text>
          </View>
          <Text style={[styles.userName, isRtl && styles.textRtl]}>
            {doctorName ?? ''}
          </Text>
          {doctorSyndicate && (
            <Text style={[styles.syndicateLabel, isRtl && styles.textRtl]}>
              {s.doctorAuth.syndicateNumber[lang]}: {doctorSyndicate}
            </Text>
          )}
        </View>

        {/* Settings Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isRtl && styles.textRtl]}>
            {s.doctor.settings[lang]}
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
            <Text style={styles.chevronIcon}>{isRtl ? '‹' : '›'}</Text>
          </TouchableOpacity>
        </View>

        {/* ─── Video Call Settings ─────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isRtl && styles.textRtl]}>
            {s.videoCall.videoCallSettings[lang]}
          </Text>

          {loadingSettings ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator size="small" color="#0D7A7A" />
            </View>
          ) : (
            <View style={styles.videoSettingsCard}>
              {/* Enable toggle */}
              <View style={[styles.notifRow, isRtl && styles.rowRtl]}>
                <Text style={[styles.notifLabel, isRtl && styles.textRtl]}>
                  {s.videoCall.enableVideoCalls[lang]}
                </Text>
                <Switch
                  value={videoCallsEnabled}
                  onValueChange={setVideoCallsEnabled}
                  trackColor={{ true: '#0D7A7A', false: '#CCC' }}
                  thumbColor="#FFF"
                />
              </View>

              {videoCallsEnabled && (
                <>
                  {/* Fee type */}
                  <View style={styles.feeSection}>
                    <Text style={[styles.fieldLabel, isRtl && styles.textRtl]}>
                      {s.videoCall.callPricing[lang]}
                    </Text>
                    <View style={[styles.radioGroup, isRtl && styles.rowRtl]}>
                      <TouchableOpacity
                        style={[styles.radioBtn, feeType === 'free' && styles.radioBtnActive]}
                        onPress={() => setFeeType('free')}
                      >
                        <Text
                          style={[
                            styles.radioText,
                            feeType === 'free' && styles.radioTextActive,
                          ]}
                        >
                          {s.videoCall.free[lang]}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.radioBtn, feeType === 'with_fee' && styles.radioBtnActive]}
                        onPress={() => setFeeType('with_fee')}
                      >
                        <Text
                          style={[
                            styles.radioText,
                            feeType === 'with_fee' && styles.radioTextActive,
                          ]}
                        >
                          {s.videoCall.withFee[lang]}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {feeType === 'with_fee' && (
                      <View style={styles.feeInputRow}>
                        <Text style={[styles.feeLabel, isRtl && styles.textRtl]}>
                          {s.videoCall.feeAmountEGP[lang]}
                        </Text>
                        <TextInput
                          style={styles.feeInput}
                          value={feeAmount}
                          onChangeText={(text) => setFeeAmount(text.replace(/[^0-9]/g, ''))}
                          keyboardType="numeric"
                          placeholder="100"
                          placeholderTextColor="#BBB"
                        />
                      </View>
                    )}
                  </View>

                  {/* Max call duration */}
                  <View style={styles.durationSection}>
                    <Text style={[styles.fieldLabel, isRtl && styles.textRtl]}>
                      {s.videoCall.maxCallDuration[lang]}
                    </Text>
                    <View style={[styles.durationOptions, isRtl && styles.rowRtl]}>
                      {DURATION_OPTIONS.map((dur) => (
                        <TouchableOpacity
                          key={dur}
                          style={[
                            styles.durationBtn,
                            maxDuration === dur && styles.durationBtnActive,
                          ]}
                          onPress={() => setMaxDuration(dur)}
                        >
                          <Text
                            style={[
                              styles.durationText,
                              maxDuration === dur && styles.durationTextActive,
                            ]}
                          >
                            {dur === 0
                              ? s.videoCall.unlimited[lang]
                              : `${dur} ${s.videoCall.minutes[lang]}`}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Per-day availability */}
                  <View style={styles.availabilitySection}>
                    <Text style={[styles.fieldLabel, isRtl && styles.textRtl]}>
                      {s.videoCall.availability[lang]}
                    </Text>

                    {DAYS_OF_WEEK.map((day) => {
                      const dayState = availability[day.key];
                      return (
                        <View key={day.key} style={styles.dayRow}>
                          <View style={[styles.dayHeader, isRtl && styles.rowRtl]}>
                            <Text style={[styles.dayName, isRtl && styles.textRtl]}>
                              {s.videoCall[day.labelKey][lang]}
                            </Text>
                            <View style={[styles.dayToggleRow, isRtl && styles.rowRtl]}>
                              <Text style={styles.dayToggleLabel}>
                                {s.videoCall.notAvailableDay[lang]}
                              </Text>
                              <Switch
                                value={!dayState?.enabled}
                                onValueChange={(val) =>
                                  updateDayAvailability(day.key, 'enabled', !val)
                                }
                                trackColor={{ true: '#EF4444', false: '#CCC' }}
                                thumbColor="#FFF"
                                style={styles.daySwitch}
                              />
                            </View>
                          </View>

                          {dayState?.enabled && (
                            <View style={[styles.timeInputsRow, isRtl && styles.rowRtl]}>
                              <View style={styles.timeField}>
                                <Text style={styles.timeLabel}>{s.videoCall.from[lang]}</Text>
                                <TextInput
                                  style={styles.timeInput}
                                  value={dayState.start}
                                  onChangeText={(text) =>
                                    updateDayAvailability(day.key, 'start', formatTimeInput(text))
                                  }
                                  placeholder="09:00"
                                  placeholderTextColor="#BBB"
                                  keyboardType="numeric"
                                  maxLength={5}
                                />
                              </View>
                              <View style={styles.timeField}>
                                <Text style={styles.timeLabel}>{s.videoCall.to[lang]}</Text>
                                <TextInput
                                  style={styles.timeInput}
                                  value={dayState.end}
                                  onChangeText={(text) =>
                                    updateDayAvailability(day.key, 'end', formatTimeInput(text))
                                  }
                                  placeholder="21:00"
                                  placeholderTextColor="#BBB"
                                  keyboardType="numeric"
                                  maxLength={5}
                                />
                              </View>
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>

                  {/* Save button */}
                  <TouchableOpacity
                    style={[styles.saveSettingsBtn, savingSettings && styles.btnDisabled]}
                    onPress={saveVideoCallSettings}
                    disabled={savingSettings}
                    activeOpacity={0.7}
                  >
                    {savingSettings ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.saveSettingsText}>{s.common.save[lang]}</Text>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}
        </View>

        {/* Notification Preferences */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isRtl && styles.textRtl]}>
            {s.doctorProfile.notificationPrefs[lang]}
          </Text>

          <View style={styles.notifCard}>
            <View style={[styles.notifRow, isRtl && styles.rowRtl]}>
              <Text style={[styles.notifLabel, isRtl && styles.textRtl]}>
                {s.doctorProfile.newBookings[lang]}
              </Text>
              <Switch
                value={notifNewBookings}
                onValueChange={setNotifNewBookings}
                trackColor={{ true: '#0D7A7A', false: '#CCC' }}
                thumbColor="#FFF"
              />
            </View>

            <View style={[styles.notifRow, isRtl && styles.rowRtl]}>
              <Text style={[styles.notifLabel, isRtl && styles.textRtl]}>
                {s.doctorProfile.labResultsReady[lang]}
              </Text>
              <Switch
                value={notifLabResults}
                onValueChange={setNotifLabResults}
                trackColor={{ true: '#0D7A7A', false: '#CCC' }}
                thumbColor="#FFF"
              />
            </View>

            <View style={[styles.notifRow, isRtl && styles.rowRtl]}>
              <Text style={[styles.notifLabel, isRtl && styles.textRtl]}>
                {s.doctorProfile.referralUpdates[lang]}
              </Text>
              <Switch
                value={notifReferrals}
                onValueChange={setNotifReferrals}
                trackColor={{ true: '#0D7A7A', false: '#CCC' }}
                thumbColor="#FFF"
              />
            </View>

            <View style={[styles.notifRow, styles.notifRowLast, isRtl && styles.rowRtl]}>
              <Text style={[styles.notifLabel, isRtl && styles.textRtl]}>
                {s.doctorProfile.transferAlerts[lang]}
              </Text>
              <Switch
                value={notifTransfers}
                onValueChange={setNotifTransfers}
                trackColor={{ true: '#0D7A7A', false: '#CCC' }}
                thumbColor="#FFF"
              />
            </View>
          </View>
        </View>

        {/* Switch to patient */}
        <TouchableOpacity
          style={styles.switchBtn}
          onPress={switchToPatientMode}
        >
          <Text style={styles.switchText}>
            {s.doctorProfile.switchToPatient[lang]}
          </Text>
        </TouchableOpacity>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>
            {s.doctor.logout[lang]}
          </Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
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
    backgroundColor: '#1A2F4A',
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
    backgroundColor: '#1A2F4A',
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
  syndicateLabel: {
    fontSize: 14,
    color: '#888',
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
  chevronIcon: {
    fontSize: 24,
    color: '#CCC',
  },
  notifCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  notifRowLast: {
    borderBottomWidth: 0,
  },
  notifLabel: {
    fontSize: 15,
    color: '#1A2F4A',
    fontFamily: 'Cairo',
    flex: 1,
  },
  switchBtn: {
    borderWidth: 1,
    borderColor: '#0D7A7A',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  switchText: {
    color: '#0D7A7A',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Cairo-SemiBold',
  },
  logoutBtn: {
    backgroundColor: '#FFEBEE',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  logoutText: {
    color: '#C62828',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Cairo-SemiBold',
  },

  // ─── Video Call Settings Styles ──────────────────────────────────────────

  videoSettingsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
  },
  loadingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    fontFamily: 'Cairo-SemiBold',
    marginBottom: 8,
  },
  feeSection: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  radioGroup: {
    flexDirection: 'row',
    gap: 10,
  },
  radioBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#DDD',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  radioBtnActive: {
    borderColor: '#0D7A7A',
    backgroundColor: '#E8F8F8',
  },
  radioText: {
    fontSize: 14,
    color: '#888',
    fontFamily: 'Cairo-SemiBold',
    fontWeight: '600',
  },
  radioTextActive: {
    color: '#0D7A7A',
  },
  feeInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 10,
  },
  feeLabel: {
    fontSize: 13,
    color: '#666',
    fontFamily: 'Cairo',
    flex: 1,
  },
  feeInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    fontFamily: 'Cairo',
    color: '#1A2F4A',
    width: 100,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#EEE',
  },
  durationSection: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  durationOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  durationBtn: {
    borderWidth: 1.5,
    borderColor: '#DDD',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  durationBtnActive: {
    borderColor: '#0D7A7A',
    backgroundColor: '#E8F8F8',
  },
  durationText: {
    fontSize: 13,
    color: '#888',
    fontFamily: 'Cairo-SemiBold',
    fontWeight: '600',
  },
  durationTextActive: {
    color: '#0D7A7A',
  },
  availabilitySection: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dayRow: {
    marginBottom: 12,
    backgroundColor: '#FAFAFA',
    borderRadius: 10,
    padding: 12,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dayName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A2F4A',
    fontFamily: 'Cairo-SemiBold',
  },
  dayToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dayToggleLabel: {
    fontSize: 12,
    color: '#888',
    fontFamily: 'Cairo',
  },
  daySwitch: {
    transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }],
  },
  timeInputsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  timeField: {
    flex: 1,
  },
  timeLabel: {
    fontSize: 11,
    color: '#888',
    fontFamily: 'Cairo',
    marginBottom: 4,
  },
  timeInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    fontFamily: 'Cairo',
    color: '#1A2F4A',
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  saveSettingsBtn: {
    backgroundColor: '#0D7A7A',
    marginHorizontal: 16,
    marginVertical: 14,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  saveSettingsText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Cairo-Bold',
  },
});
