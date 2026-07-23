'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import type { Lang } from '@triaji/shared/i18n';

// TODO: /ar/chat?mode=trio should be handled in the chat page
//       to pre-set the session type as 'doctor_trio' and inform
//       the triage orchestrator. Build in a future phase.

// TODO: Doctor Trio package pricing is set in doctor profile.
//       Add trio_package_price field to doctor_accounts table
//       and display it in the doctor card during booking flow.
//       Build in a future phase.

// TODO: "متاح مع الأطباء المشتركين" requires a doctor_trio_enabled
//       boolean on doctor_accounts. Build filtering in a future phase.

/* ─── Bilingual Content ─── */

const MODAL = {
  tagline: {
    ar: 'الرعاية الطبية الكاملة في ثلاث جلسات منسّقة',
    en: 'Complete medical care in three coordinated sessions',
  },
  close: { ar: 'إغلاق', en: 'Close' },
  session1: {
    title: { ar: 'الجلسة الأولى — قبل الكشف', en: 'Session One — Before the Visit' },
    subtitle: { ar: 'أونلاين | 15–20 دقيقة تقريباً', en: 'Online | Approx. 15–20 minutes' },
    desc: {
      ar: 'دكتور تريو بيسمع أعراضك، يحدد التخصص، وتحجز مع الدكتور الصح',
      en: 'DoctorTrio listens to your symptoms, determines the specialty, and books you with the right doctor',
    },
  },
  session2: {
    title: { ar: 'الجلسة الثانية — الكشف الحضوري', en: 'Session Two — In-Person Examination' },
    subtitle: { ar: 'في العيادة | حسب وقت الدكتور', en: 'At the clinic | Based on doctor availability' },
    desc: {
      ar: 'الفحص الطبي الكامل مع الدكتور — روشتة، تحاليل، وأشعة كلها على دكتور تريو',
      en: 'Full medical examination with the doctor — prescriptions, labs, and imaging all on DoctorTrio',
    },
    badge: { ar: '★ الجلسة الأساسية', en: '★ Core Session' },
  },
  session3: {
    title: { ar: 'الجلسة الثالثة — المتابعة', en: 'Session Three — Follow-up' },
    subtitle: { ar: 'أونلاين | بعد استلام نتايج التحاليل', en: 'Online | After receiving test results' },
    desc: {
      ar: 'مراجعة النتايج وتعديل العلاج من البيت — من غير ما تتعب في الزحمة',
      en: 'Review results and adjust treatment from home — no need to deal with traffic',
    },
  },
  pricingTitle: {
    ar: 'سعر واحد للثلاث جلسات',
    en: 'One price for all three sessions',
  },
  pricingDesc: {
    ar: 'كل دكتور في Doctor Trio بيحدد سعر الباقة بنفسه. هتشوف السعر الكامل قبل ما تأكد الحجز.',
    en: 'Each Doctor Trio doctor sets their own package price. You\'ll see the full price before confirming your booking.',
  },
  comparison: {
    instead: {
      ar: 'بدل ما تدفع:',
      en: 'Instead of paying:',
    },
    items: {
      ar: 'جلسة دكتور تريو + كشف + متابعة',
      en: 'DoctorTrio session + exam + follow-up',
    },
    withTrio: {
      ar: 'مع Doctor Trio:',
      en: 'With Doctor Trio:',
    },
    benefits: {
      ar: ['سعر واحد مجمّع', 'مفيش مفاجآت', 'الثلاث جلسات مضمونة'],
      en: ['One bundled price', 'No surprises', 'All three sessions guaranteed'],
    },
  },
  ctaStart: {
    ar: 'ابدأ رحلتك مع Doctor Trio',
    en: 'Start your journey with Doctor Trio',
  },
  disclaimer: {
    ar: 'Doctor Trio متاح مع الأطباء المشتركين. سعر الباقة يظهر عند اختيار الدكتور.',
    en: 'Doctor Trio is available with enrolled doctors. Package price is shown when you select a doctor.',
  },
};

interface DoctorTrioModalProps {
  open: boolean;
  onClose: () => void;
  lang?: Lang;
}

export default function DoctorTrioModal({ open, onClose, lang = 'ar' }: DoctorTrioModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const isRtl = lang === 'ar';

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  // Lock body scroll
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  const chatHref = `/${lang}/chat?mode=trio`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 animate-fadeIn"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Doctor Trio"
    >
      <div
        ref={modalRef}
        className="bg-white w-full max-w-[600px] max-h-[90vh] overflow-y-auto rounded-3xl sm:rounded-3xl relative animate-scaleIn"
        style={{ maxHeight: '90vh' }}
        dir={isRtl ? 'rtl' : 'ltr'}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className={`absolute top-4 z-10 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors text-xl ${isRtl ? 'left-4' : 'right-4'}`}
          aria-label={MODAL.close[lang]}
        >
          ✕
        </button>

        <div className="p-6 sm:p-8">
          {/* ─── Header ─── */}
          <div className="text-center mb-8">
            <h2 className="text-[32px] font-bold text-[#0D7A7A] font-[Cairo] tracking-[0.02em]">
              Doctor Trio
            </h2>
            <p className="text-[16px] font-bold text-[#1A2F4A] font-[Cairo] mt-1">
              دوكتور تريو
            </p>
            <p className="text-[15px] text-gray-500 font-[Cairo] mt-3 leading-relaxed">
              {MODAL.tagline[lang]}
            </p>
          </div>

          {/* ─── Three Session Rows with Timeline ─── */}
          <div className={`relative ${isRtl ? 'pr-6' : 'pl-6'}`}>
            {/* Timeline vertical line */}
            <div
              className={`absolute top-[20px] bottom-[20px] w-[2px] ${isRtl ? 'right-[11px]' : 'left-[11px]'}`}
              style={{ backgroundColor: 'rgba(13,122,122,0.3)' }}
            />

            {/* Session 1 */}
            <div className="relative flex gap-4 mb-8">
              <div className={`absolute top-0 w-[24px] h-[24px] rounded-full bg-[#0D7A7A] text-white text-xs font-bold flex items-center justify-center shrink-0 z-10 ${isRtl ? 'right-[-24px]' : 'left-[-24px]'}`}>
                ①
              </div>
              <div className={`flex-1 ${isRtl ? 'mr-4' : 'ml-4'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[24px]">🩺👂</span>
                </div>
                <h3 className="text-[16px] font-bold text-[#1A2F4A] font-[Cairo]">
                  {MODAL.session1.title[lang]}
                </h3>
                <p className="text-[12px] text-gray-400 font-[Cairo] mt-0.5">
                  {MODAL.session1.subtitle[lang]}
                </p>
                <p className="text-[14px] text-gray-600 font-[Cairo] mt-2 leading-relaxed">
                  {MODAL.session1.desc[lang]}
                </p>
              </div>
            </div>

            {/* Session 2 */}
            <div className="relative flex gap-4 mb-8">
              <div className={`absolute top-0 w-[24px] h-[24px] rounded-full bg-[#1A2F4A] text-white text-xs font-bold flex items-center justify-center shrink-0 z-10 ${isRtl ? 'right-[-24px]' : 'left-[-24px]'}`}>
                ②
              </div>
              <div className={`flex-1 ${isRtl ? 'mr-4' : 'ml-4'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[24px]">🩺</span>
                </div>
                <h3 className="text-[16px] font-bold text-[#1A2F4A] font-[Cairo]">
                  {MODAL.session2.title[lang]}
                </h3>
                <p className="text-[12px] text-gray-400 font-[Cairo] mt-0.5">
                  {MODAL.session2.subtitle[lang]}
                </p>
                <p className="text-[14px] text-gray-600 font-[Cairo] mt-2 leading-relaxed">
                  {MODAL.session2.desc[lang]}
                </p>
                <span className="inline-block mt-2 text-[11px] font-bold text-white bg-[#1A2F4A] px-2.5 py-0.5 rounded-full">
                  {MODAL.session2.badge[lang]}
                </span>
              </div>
            </div>

            {/* Session 3 */}
            <div className="relative flex gap-4">
              <div className={`absolute top-0 w-[24px] h-[24px] rounded-full bg-[#0D7A7A] text-white text-xs font-bold flex items-center justify-center shrink-0 z-10 ${isRtl ? 'right-[-24px]' : 'left-[-24px]'}`}>
                ③
              </div>
              <div className={`flex-1 ${isRtl ? 'mr-4' : 'ml-4'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[24px]">📱</span>
                </div>
                <h3 className="text-[16px] font-bold text-[#1A2F4A] font-[Cairo]">
                  {MODAL.session3.title[lang]}
                </h3>
                <p className="text-[12px] text-gray-400 font-[Cairo] mt-0.5">
                  {MODAL.session3.subtitle[lang]}
                </p>
                <p className="text-[14px] text-gray-600 font-[Cairo] mt-2 leading-relaxed">
                  {MODAL.session3.desc[lang]}
                </p>
              </div>
            </div>
          </div>

          {/* ─── Pricing Section ─── */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <h3 className="text-[18px] font-bold text-[#1A2F4A] font-[Cairo] text-center mb-3">
              {MODAL.pricingTitle[lang]}
            </h3>
            <p className="text-[14px] text-gray-500 font-[Cairo] text-center leading-relaxed mb-5">
              {MODAL.pricingDesc[lang]}
            </p>

            {/* Comparison */}
            <div className="bg-gray-50 rounded-xl p-4 space-y-3 text-[13px] font-[Cairo]">
              <div className="flex items-start gap-2 text-gray-500">
                <span className="text-gray-400 mt-0.5">{MODAL.comparison.instead[lang]}</span>
                <span>{MODAL.comparison.items[lang]}</span>
              </div>
              <div className="border-t border-gray-200 pt-3 space-y-2">
                <p className="font-bold text-[#1A2F4A] mb-1">{MODAL.comparison.withTrio[lang]}</p>
                {MODAL.comparison.benefits[lang].map((benefit, i) => (
                  <div key={i} className="flex items-center gap-2 text-[#0D7A7A]">
                    <span>✓</span><span>{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ─── Footer Buttons ─── */}
          <div className="mt-8 space-y-3">
            <Link
              href={chatHref}
              className="block w-full text-center bg-[#0D7A7A] text-white font-bold font-[Cairo] text-[16px] py-3.5 rounded-xl hover:bg-[#0a6565] transition-colors duration-200"
              onClick={onClose}
            >
              {MODAL.ctaStart[lang]}
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="block w-full text-center border border-gray-300 text-gray-500 font-[Cairo] text-[14px] py-3 rounded-xl hover:bg-gray-50 transition-colors duration-200"
            >
              {MODAL.close[lang]}
            </button>
          </div>

          {/* Disclaimer */}
          <p className="text-[11px] text-gray-400 font-[Cairo] text-center mt-4 leading-relaxed">
            {MODAL.disclaimer[lang]}
          </p>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fadeIn {
          animation: fadeIn 200ms ease-out;
        }
        .animate-scaleIn {
          animation: scaleIn 250ms ease-out;
        }
        @media (max-width: 640px) {
          .animate-scaleIn {
            max-width: 100vw !important;
            max-height: 100vh !important;
            height: 100vh;
            border-radius: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}
