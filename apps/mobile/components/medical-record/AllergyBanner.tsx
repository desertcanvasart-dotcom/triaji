/**
 * AllergyBanner — always-visible red strip showing patient allergies.
 */

import { View, Text, StyleSheet } from 'react-native';
import type { Lang } from '@triaji/shared/i18n';

interface AllergyBannerProps {
  allergies: string[];
  lang: Lang;
}

export default function AllergyBanner({ allergies, lang }: AllergyBannerProps) {
  if (!allergies || allergies.length === 0) return null;

  const label = lang === 'ar' ? 'الحساسية' : 'Allergies';
  const separator = ' \u2022 ';
  const allergyList = allergies.join(separator);

  return (
    <View style={styles.container}>
      <Text style={[styles.text, lang === 'ar' && styles.textRtl]} numberOfLines={2}>
        {'\u{1F6A8}'} {label}: {allergyList}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FEE2E2',
    paddingVertical: 10,
    paddingHorizontal: 16,
    width: '100%',
  },
  text: {
    fontSize: 14,
    fontWeight: '700',
    color: '#DC2626',
    fontFamily: 'Cairo-Bold',
  },
  textRtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
