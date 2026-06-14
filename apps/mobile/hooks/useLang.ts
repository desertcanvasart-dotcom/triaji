/**
 * Language Hook — manages language preference with MMKV persistence.
 * Defaults to device locale (Arabic if device is ar-*, otherwise English).
 */

import { useState, useCallback, useEffect } from 'react';
import { I18nManager } from 'react-native';
import * as Localization from 'expo-localization';
import { getLang, setLang as storeLang } from '@/lib/storage';
import type { Lang } from '@triaji/shared/i18n';

function detectDeviceLang(): Lang {
  const locale = Localization.getLocales()[0]?.languageCode ?? 'ar';
  return locale === 'ar' ? 'ar' : 'en';
}

export function useLang() {
  const [lang, setLangState] = useState<Lang>(() => {
    const stored = getLang();
    if (stored) return stored;
    return detectDeviceLang();
  });

  const isRtl = lang === 'ar';

  useEffect(() => {
    if (I18nManager.isRTL !== isRtl) {
      I18nManager.allowRTL(isRtl);
      I18nManager.forceRTL(isRtl);
    }
  }, [isRtl]);

  const setLang = useCallback((newLang: Lang) => {
    storeLang(newLang);
    setLangState(newLang);

    const shouldBeRtl = newLang === 'ar';
    if (I18nManager.isRTL !== shouldBeRtl) {
      I18nManager.allowRTL(shouldBeRtl);
      I18nManager.forceRTL(shouldBeRtl);
    }
  }, []);

  const toggleLang = useCallback(() => {
    setLang(lang === 'ar' ? 'en' : 'ar');
  }, [lang, setLang]);

  return { lang, isRtl, setLang, toggleLang };
}
