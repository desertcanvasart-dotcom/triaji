/**
 * RecordingConsent — banner shown at top of call asking for recording consent.
 * Two buttons: consent / decline. Bilingual via i18n.
 */

import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { Lang } from '@triaji/shared/i18n';
import { s } from '@triaji/shared/i18n';

interface RecordingConsentProps {
  lang: Lang;
  onAccept: () => void;
  onDecline: () => void;
}

export default function RecordingConsent({
  lang,
  onAccept,
  onDecline,
}: RecordingConsentProps) {
  const isRtl = lang === 'ar';

  return (
    <View style={styles.container}>
      <View style={styles.textContainer}>
        <Text style={[styles.title, isRtl && styles.textRtl]}>
          {s.videoCall.recordingConsent[lang]}
        </Text>
        <Text style={[styles.subtitle, isRtl && styles.textRtl]}>
          {s.videoCall.recordingForMedical[lang]}
        </Text>
      </View>

      <View style={[styles.buttonRow, isRtl && styles.rowRtl]}>
        <TouchableOpacity
          style={styles.declineBtn}
          onPress={onDecline}
          activeOpacity={0.7}
        >
          <Text style={styles.declineBtnText}>
            {s.videoCall.consentDecline[lang]}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.acceptBtn}
          onPress={onAccept}
          activeOpacity={0.7}
        >
          <Text style={styles.acceptBtnText}>
            {s.videoCall.consentAccept[lang]}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    marginHorizontal: 16,
  },
  textContainer: {
    marginBottom: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'Cairo-SemiBold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    fontFamily: 'Cairo',
  },
  textRtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  rowRtl: {
    flexDirection: 'row-reverse',
  },
  declineBtn: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  declineBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'Cairo-SemiBold',
  },
  acceptBtn: {
    flex: 1,
    backgroundColor: '#22C55E',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  acceptBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'Cairo-SemiBold',
  },
});
