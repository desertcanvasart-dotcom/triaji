'use client';

import { type Lang } from '@triaji/shared/i18n';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Protocol {
  protocolId: string;
  enrolledAt: string;
  compliancePct: number | null;
  nameAr: string | null;
  nameEn: string | null;
  conditionCode: string | null;
}

interface ProtocolSectionProps {
  protocols: Protocol[];
  lang: Lang;
}

// ─── Strings ────────────────────────────────────────────────────────────────

const strings = {
  title: { ar: 'البروتوكولات العلاجية', en: 'Care Protocols' },
  noProtocols: { ar: 'لا توجد بروتوكولات مسجلة', en: 'No active protocols' },
  compliance: { ar: 'الالتزام', en: 'Compliance' },
  enrolledSince: { ar: 'مسجل منذ', en: 'Enrolled since' },
  active: { ar: 'نشط', en: 'Active' },
};

function s(key: keyof typeof strings, lang: Lang): string {
  return (strings[key] as Record<string, string>)?.[lang] ?? key;
}

function formatDate(dateStr: string, lang: Lang): string {
  return new Date(dateStr).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function getComplianceColor(pct: number): string {
  if (pct >= 80) return 'text-green-700 bg-green-100';
  if (pct >= 50) return 'text-amber-700 bg-amber-100';
  return 'text-red-700 bg-red-100';
}

function getProgressColor(pct: number): string {
  if (pct >= 80) return 'bg-green-500';
  if (pct >= 50) return 'bg-amber-500';
  return 'bg-red-500';
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function ProtocolSection({ protocols, lang }: ProtocolSectionProps) {
  const isRTL = lang === 'ar';

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="font-bold text-[#1A2F4A] mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
        {s('title', lang)}
      </h3>

      {protocols.length === 0 ? (
        <p className="text-gray-400 text-center py-4 text-sm">{s('noProtocols', lang)}</p>
      ) : (
        <div className="space-y-3">
          {protocols.map(protocol => {
            const name = isRTL
              ? (protocol.nameAr || protocol.conditionCode || '')
              : (protocol.nameEn || protocol.nameAr || protocol.conditionCode || '');
            const pct = protocol.compliancePct ?? 100;

            return (
              <div key={protocol.protocolId} className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-[#1A2F4A] text-sm">{name}</span>
                    <span className="px-2 py-0.5 bg-purple-50 text-purple-700 text-xs rounded-full">
                      {s('active', lang)}
                    </span>
                  </div>
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getComplianceColor(pct)}`}>
                    {pct}% {s('compliance', lang)}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-500 ${getProgressColor(pct)}`}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>

                <p className="text-xs text-gray-400">
                  {s('enrolledSince', lang)} {formatDate(protocol.enrolledAt, lang)}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
