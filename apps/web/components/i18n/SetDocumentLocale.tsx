'use client';

import { useEffect } from 'react';

/**
 * Patches <html lang/dir> on the client for locale subtrees.
 *
 * The root layout server-renders lang="ar" dir="rtl" (Arabic is the default);
 * the /en tree mounts this to switch the document to English/LTR and restores
 * the previous values when the user navigates back to an Arabic route.
 */
export default function SetDocumentLocale({
  lang,
  dir,
}: {
  lang: string;
  dir: 'ltr' | 'rtl';
}) {
  useEffect(() => {
    const el = document.documentElement;
    const prev = { lang: el.lang, dir: el.dir };
    el.lang = lang;
    el.dir = dir;
    return () => {
      el.lang = prev.lang;
      el.dir = prev.dir;
    };
  }, [lang, dir]);

  return null;
}
