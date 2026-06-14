'use client';

import { useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';

interface LanguageToggleProps {
  lang: 'ar' | 'en';
}

export default function LanguageToggle({ lang }: LanguageToggleProps) {
  const pathname = usePathname();
  const router = useRouter();

  const toggleLanguage = useCallback(() => {
    const newLang = lang === 'ar' ? 'en' : 'ar';

    // Set the lang cookie (expires in 1 year)
    document.cookie = `lang=${newLang}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;

    // Replace the locale prefix in the current path
    const newPath = pathname.replace(/^\/(ar|en)(\/|$)/, `/${newLang}$2`);

    router.push(newPath);
  }, [lang, pathname, router]);

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      className="text-sm font-medium text-[#0D7A7A] hover:text-[#0A6363] transition-colors px-2 py-1 rounded-md hover:bg-teal-50"
    >
      {lang === 'ar' ? 'English' : 'العربية'}
    </button>
  );
}
