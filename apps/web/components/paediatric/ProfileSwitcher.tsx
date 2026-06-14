'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { t, type Lang } from '@triaji/shared/i18n';
import type { ChildProfile } from '@triaji/shared/types/paediatric';

interface ProfileSwitcherProps {
  lang: Lang;
}

function formatAge(ageMonths: number, lang: Lang): string {
  if (ageMonths < 24) {
    return `${ageMonths} ${t('paediatric.months', lang)}`;
  }
  const years = Math.floor(ageMonths / 12);
  return `${years} ${t('paediatric.years', lang)}`;
}

export default function ProfileSwitcher({ lang }: ProfileSwitcherProps) {
  const router = useRouter();
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [activeChildId, setActiveChildId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const isRtl = lang === 'ar';

  useEffect(() => {
    // Read active_child_id cookie
    const cookies = document.cookie.split(';').reduce((acc, c) => {
      const [key, val] = c.trim().split('=');
      if (key && val) acc[key] = val;
      return acc;
    }, {} as Record<string, string>);
    setActiveChildId(cookies['active_child_id'] ?? null);

    fetch('/api/patient/children')
      .then((res) => res.json())
      .then((data) => {
        setChildren(data.children ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSelectSelf = () => {
    document.cookie = 'active_child_id=; path=/; max-age=0';
    setActiveChildId(null);
    router.refresh();
  };

  const handleSelectChild = (childId: string) => {
    document.cookie = `active_child_id=${childId}; path=/; max-age=${60 * 60 * 24 * 365}`;
    setActiveChildId(childId);
    router.refresh();
  };

  const handleAddChild = () => {
    router.push(`/${lang}/child/add`);
  };

  if (loading) {
    return (
      <div className="flex gap-2 overflow-x-auto py-2 px-1">
        <div className="h-9 w-16 animate-pulse rounded-full bg-gray-200" />
        <div className="h-9 w-24 animate-pulse rounded-full bg-gray-200" />
      </div>
    );
  }

  return (
    <div
      className="flex gap-2 overflow-x-auto py-2 px-1 scrollbar-hide"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {/* Self chip */}
      <button
        onClick={handleSelectSelf}
        className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
          !activeChildId
            ? 'bg-teal-600 text-white shadow-sm'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        {t('paediatric.me', lang)}
      </button>

      {/* Child chips */}
      {children.map((child) => (
        <button
          key={child.patientId}
          onClick={() => handleSelectChild(child.patientId)}
          className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
            activeChildId === child.patientId
              ? 'bg-teal-600 text-white shadow-sm'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {child.name}
          <span className="mx-1 opacity-70">({formatAge(child.ageMonths, lang)})</span>
        </button>
      ))}

      {/* Add child button */}
      <button
        onClick={handleAddChild}
        className="shrink-0 rounded-full bg-gray-100 px-4 py-2 text-sm font-medium text-teal-600 hover:bg-teal-50 transition-colors"
        aria-label={t('paediatric.addChild', lang)}
      >
        +
      </button>
    </div>
  );
}
