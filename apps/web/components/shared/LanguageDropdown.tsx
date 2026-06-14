'use client';

import { useState, useRef, useEffect } from 'react';
import type { Lang } from '@triaji/shared/i18n';

export default function LanguageDropdown({ lang }: { lang: Lang }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const currentLabel = lang === 'ar' ? '\u0627\u0644\u0639\u0631\u0628\u064a\u0629' : 'English';
  const currentFlag = lang === 'ar' ? '\u{1F1EA}\u{1F1EC}' : '\u{1F1EC}\u{1F1E7}';

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors px-2 py-1 rounded-lg hover:bg-gray-50"
      >
        <span className="text-base">{currentFlag}</span>
        <span className="hidden sm:inline">{currentLabel}</span>
        <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full mt-1 bg-white rounded-xl shadow-lg border border-gray-100 py-1 min-w-[140px] z-50 end-0">
          <a
            href="/?lang=ar"
            className={`flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${lang === 'ar' ? 'text-teal-600 font-medium' : 'text-gray-600'}`}
          >
            <span>{'\u{1F1EA}\u{1F1EC}'}</span>
            <span>{'\u0627\u0644\u0639\u0631\u0628\u064a\u0629'}</span>
            {lang === 'ar' && <span className="text-teal-500 text-xs ms-auto">&#10003;</span>}
          </a>
          <a
            href="/?lang=en"
            className={`flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${lang === 'en' ? 'text-teal-600 font-medium' : 'text-gray-600'}`}
          >
            <span>{'\u{1F1EC}\u{1F1E7}'}</span>
            <span>English</span>
            {lang === 'en' && <span className="text-teal-500 text-xs ms-auto">&#10003;</span>}
          </a>
        </div>
      )}
    </div>
  );
}
