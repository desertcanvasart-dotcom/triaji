'use client';

import { type Lang } from '@triaji/shared/i18n';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Referral {
  id: string;
  referred_to_specialty_ar: string | null;
  referred_to_specialty_en: string | null;
  reason_ar: string | null;
  reason_en: string | null;
  status: string;
  created_at: string;
}

interface ReferralSectionProps {
  referrals: Referral[];
  lang: Lang;
}

// ─── Strings ────────────────────────────────────────────────────────────────

const strings = {
  title: { ar: 'التحويلات', en: 'Referrals' },
  noReferrals: { ar: 'لا توجد تحويلات', en: 'No referrals' },
  to: { ar: 'إلى', en: 'To' },
  reason: { ar: 'السبب', en: 'Reason' },
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

const STATUS_CONFIG: Record<string, { ar: string; en: string; className: string }> = {
  pending: { ar: 'معلق', en: 'Pending', className: 'bg-amber-100 text-amber-700' },
  accepted: { ar: 'مقبول', en: 'Accepted', className: 'bg-green-100 text-green-700' },
  completed: { ar: 'مكتمل', en: 'Completed', className: 'bg-blue-100 text-blue-700' },
  declined: { ar: 'مرفوض', en: 'Declined', className: 'bg-red-100 text-red-700' },
};

// ─── Component ──────────────────────────────────────────────────────────────

export default function ReferralSection({ referrals, lang }: ReferralSectionProps) {
  const isRTL = lang === 'ar';

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="font-bold text-[#1A2F4A] mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
        {s('title', lang)}
      </h3>

      {referrals.length === 0 ? (
        <p className="text-gray-400 text-center py-4 text-sm">{s('noReferrals', lang)}</p>
      ) : (
        <div className="space-y-3">
          {referrals.map(referral => {
            const specialty = isRTL
              ? (referral.referred_to_specialty_ar || referral.referred_to_specialty_en || '')
              : (referral.referred_to_specialty_en || referral.referred_to_specialty_ar || '');
            const reason = isRTL
              ? (referral.reason_ar || referral.reason_en || '')
              : (referral.reason_en || referral.reason_ar || '');
            const statusConfig = STATUS_CONFIG[referral.status] ?? { ar: 'معلق', en: 'Pending', className: 'bg-gray-100 text-gray-600' };

            return (
              <div key={referral.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-[#1A2F4A] text-sm">{specialty}</span>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusConfig.className}`}>
                      {statusConfig[lang]}
                    </span>
                  </div>
                  {reason && (
                    <p className="text-xs text-gray-500 line-clamp-2">{reason}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">{formatDate(referral.created_at, lang)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
