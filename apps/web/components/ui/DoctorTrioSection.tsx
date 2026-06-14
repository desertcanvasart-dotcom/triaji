'use client';

import { useState } from 'react';
import type { Lang } from '@triaji/shared/i18n';
import FadeInSection from './FadeInSection';
import DoctorTrioModal from './DoctorTrioModal';

/* ─── Bilingual Content ─── */

const CONTENT = {
  subTagline: {
    ar: 'جلستان أونلاين، وزيارة  واحدة لعيادة الطبيب',
    en: 'Two online sessions, and one visit to your doctor\'s clinic',
  },
  tagline: {
    ar: 'رحلتك العلاجية الكاملة — في ثلاث جلسات، بسعر واحد',
    en: 'Your complete care journey — in three sessions, one price',
  },
  arabicBrand: 'دوكتور تريو',
  crown: { ar: 'الزيارة الحضورية ★', en: '★ In-Person Visit' },
  cards: {
    session1: {
      badge: { ar: 'الجلسة الأولى', en: 'Session One' },
      title: { ar: 'قبل الكشف', en: 'Before the Visit' },
      subtitle: { ar: 'أونلاين — من البيت', en: 'Online — From Home' },
      desc: {
        ar: 'ترياڃي بيسمعك، بيحدد التخصص الصح، وبيوصلك للدكتور المناسب',
        en: 'Triajji listens, determines the right specialty, and connects you to the right doctor',
      },
      checks: {
        ar: [
          'وصف أعراضك بالعربي أو بصوتك',
          'ترياڃي يقيّم حالتك فوراً',
          'اختيار الدكتور وحجز الموعد',
          'الدكتور بيستلم ملخص حالتك',
        ],
        en: [
          'Describe your symptoms in your own words or by voice',
          'Triajji assesses your condition instantly',
          'Choose your doctor and book your appointment',
          'Your doctor receives a summary of your case',
        ],
      },
      modality: { ar: '💻 أونلاين', en: '💻 Online' },
    },
    session2: {
      badge: { ar: 'الجلسة الثانية', en: 'Session Two' },
      title: { ar: 'عند الدكتور', en: 'At the Doctor' },
      subtitle: { ar: 'حضوري — في العيادة', en: 'In-Person — At the Clinic' },
      desc: {
        ar: 'الفحص الحضوري قلب رحلتك — الدكتور بيشوفك ويكشف عليك بنفسه',
        en: 'The in-person exam is the heart of your journey — your doctor sees and examines you personally',
      },
      checks: {
        ar: [
          'الفحص الطبي الكامل',
          'الروشتة والتحاليل والأشعة على ترياڃي',
          'المستندات على واتساب فوراً',
          'كل حاجة في سجلك الطبي',
        ],
        en: [
          'Full medical examination',
          'Prescriptions, labs, and imaging on Triajji',
          'Documents delivered via WhatsApp instantly',
          'Everything in your medical record',
        ],
      },
      modality: { ar: '🏥 حضوري', en: '🏥 In-Person' },
    },
    session3: {
      badge: { ar: 'الجلسة الثالثة', en: 'Session Three' },
      title: { ar: 'بعد الكشف', en: 'After the Visit' },
      subtitle: { ar: 'أونلاين — من البيت', en: 'Online — From Home' },
      desc: {
        ar: 'المتابعة والمراجعة من البيت — من غير ما تتعب في الزحمة تاني',
        en: 'Follow-up and review from home — no need to deal with traffic again',
      },
      checks: {
        ar: [
          'مراجعة نتايج التحاليل والأشعة',
          'تعديل الجرعات أو الروشتة أونلاين',
          'استشارة فيديو لو محتاج',
          'سجلك الطبي متاح دايماً',
        ],
        en: [
          'Review lab and imaging results',
          'Adjust dosages or prescriptions online',
          'Video consultation if needed',
          'Your medical record is always accessible',
        ],
      },
      modality: { ar: '💻 أونلاين', en: '💻 Online' },
    },
  },
  connector: { ar: 'ثم', en: 'then' },
  pricing: {
    ar: 'سعر واحد للرحلة الكاملة — يحدده الطبيب',
    en: 'One price for the full journey — set by the doctor',
  },
  pricingSub: {
    ar: 'مش هتدفع تلاتة مرات — Doctor Trio بيجمع الثلاث جلسات في باقة واحدة',
    en: "You won't pay three times — Doctor Trio bundles all three sessions into one package",
  },
  cta: {
    ar: 'اعرف أكتر عن Doctor Trio',
    en: 'Learn more about Doctor Trio',
  },
  ctaSub: {
    ar: 'متاح مع الأطباء المشتركين في Doctor Trio',
    en: 'Available with doctors enrolled in Doctor Trio',
  },
};

/* ─── Listening Doctor SVG (Card 1) ─── */
function ListeningDoctorIcon() {
  return (
    <svg
      width="64"
      height="64"
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="mx-auto"
    >
      <circle cx="32" cy="18" r="10" stroke="white" strokeWidth="2" fill="none" />
      <path
        d="M22 34 C22 28, 42 28, 42 34 L44 50 L20 50 Z"
        stroke="white"
        strokeWidth="2"
        fill="none"
        strokeLinejoin="round"
      />
      <path
        d="M28 28 C28 32, 26 35, 26 38"
        stroke="white"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="26" cy="39" r="2" stroke="white" strokeWidth="1.5" fill="none" />
      <path
        d="M46 14 C50 12, 52 16, 50 20 C48 24, 44 22, 44 20"
        stroke="white"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      <path d="M52 14 C54 16, 54 20, 52 22" stroke="white" strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.6" />
      <path d="M55 12 C58 16, 58 20, 55 24" stroke="white" strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.4" />
    </svg>
  );
}

/* ─── Stethoscope SVG (Card 2) ─── */
function StethoscopeIcon() {
  return (
    <svg
      width="64"
      height="64"
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="mx-auto"
    >
      <path d="M20 8 L20 20 C20 30, 32 32, 32 24" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M44 8 L44 20 C44 30, 32 32, 32 24" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M32 24 L32 42" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <circle cx="32" cy="48" r="8" stroke="white" strokeWidth="2.5" fill="none" />
      <circle cx="32" cy="48" r="3" stroke="white" strokeWidth="1.5" fill="none" />
      <circle cx="20" cy="7" r="2" fill="white" />
      <circle cx="44" cy="7" r="2" fill="white" />
    </svg>
  );
}

/* ─── Phone/Follow-up SVG (Card 3) ─── */
function FollowUpIcon() {
  return (
    <svg
      width="64"
      height="64"
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="mx-auto"
    >
      <rect x="18" y="6" width="28" height="52" rx="6" stroke="white" strokeWidth="2" fill="none" />
      <rect x="22" y="14" width="20" height="30" rx="2" stroke="white" strokeWidth="1" fill="none" opacity="0.5" />
      <path d="M27 28 L31 33 L38 24" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="32" cy="52" r="2.5" stroke="white" strokeWidth="1.5" fill="none" />
    </svg>
  );
}

/* ─── Desktop Connector Arrow ─── */
function DesktopConnector({ lang }: { lang: Lang }) {
  return (
    <div className="hidden lg:flex flex-col items-center justify-center px-1 self-center">
      <div className="flex items-center gap-1">
        <div className="w-6 h-[1px]" style={{ backgroundColor: 'rgba(13,122,122,0.4)' }} />
        <span className="text-[#0D7A7A] text-sm">{lang === 'ar' ? '←' : '→'}</span>
        <div className="w-6 h-[1px]" style={{ backgroundColor: 'rgba(13,122,122,0.4)' }} />
      </div>
      <span className="text-[11px] text-gray-400 mt-0.5">{CONTENT.connector[lang]}</span>
    </div>
  );
}

/* ─── Mobile Connector Arrow ─── */
function MobileConnector({ lang }: { lang: Lang }) {
  return (
    <div className="flex lg:hidden items-center justify-center gap-2 py-3">
      <span className="text-[#0D7A7A] text-lg">↓</span>
      <span className="text-[11px] text-gray-400">{CONTENT.connector[lang]}</span>
    </div>
  );
}

/* ─── Session Checklist ─── */
function CheckList({ items, isRtl }: { items: string[]; isRtl: boolean }) {
  return (
    <ul className={`space-y-2 text-[13px] mt-4 ${isRtl ? 'text-right' : 'text-left'}`}>
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2">
          <span className="text-[#0D7A7A] mt-0.5 shrink-0">✓</span>
          <span className="text-white/80">{item}</span>
        </li>
      ))}
    </ul>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════ */

export default function DoctorTrioSection({ lang = 'ar' }: { lang?: Lang }) {
  const [modalOpen, setModalOpen] = useState(false);
  const isRtl = lang === 'ar';

  return (
    <>
      <DoctorTrioModal open={modalOpen} onClose={() => setModalOpen(false)} lang={lang} />

      <section className="py-20 px-4 bg-[#1A2F4A]" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="max-w-6xl mx-auto">

          {/* ─── Section Header ─── */}
          <FadeInSection>
            <div className="text-center mb-14">
              <h2
                className="text-[36px] md:text-[48px] font-bold text-white font-[Cairo] leading-tight"
                style={{ letterSpacing: '0.02em' }}
              >
                Doctor Trio
              </h2>
              <p className="text-[18px] md:text-[22px] font-bold text-[#0D7A7A] font-[Cairo] mt-1">
                {CONTENT.arabicBrand}
              </p>
              <p className="text-[17px] text-white/85 font-[Cairo] mt-4 leading-relaxed">
                {CONTENT.tagline[lang]}
              </p>
              <p className="text-[14px] text-[#0D7A7A] font-[Cairo] mt-2">
                {CONTENT.subTagline[lang]}
              </p>
            </div>
          </FadeInSection>

          {/* ─── Three Session Cards ─── */}
          <div className="flex flex-col lg:flex-row items-stretch justify-center">

            {/* Card 1 — Session One (Online) */}
            <FadeInSection delay={0} className="flex-1 max-w-sm lg:max-w-none mx-auto lg:mx-0 w-full">
              <div
                className="rounded-[20px] p-6 sm:p-8 h-full flex flex-col text-center"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                }}
              >
                <div className="flex justify-center mb-5">
                  <span className="text-[12px] font-bold text-white bg-[#0D7A7A] px-4 py-1.5 rounded-full font-[Cairo]">
                    {CONTENT.cards.session1.badge[lang]}
                  </span>
                </div>
                <div className="mb-4"><ListeningDoctorIcon /></div>
                <h3 className="text-[20px] font-bold text-white font-[Cairo]">{CONTENT.cards.session1.title[lang]}</h3>
                <p className="text-[13px] text-[#0D7A7A] font-[Cairo] mt-1">{CONTENT.cards.session1.subtitle[lang]}</p>
                <p className="text-[14px] text-white/80 font-[Cairo] mt-3 leading-relaxed">
                  {CONTENT.cards.session1.desc[lang]}
                </p>
                <CheckList items={CONTENT.cards.session1.checks[lang]} isRtl={isRtl} />
                <div className="mt-auto pt-5 flex justify-center">
                  <span className="text-[12px] text-white border border-white/30 px-3 py-1 rounded-full font-[Cairo]">
                    {CONTENT.cards.session1.modality[lang]}
                  </span>
                </div>
              </div>
            </FadeInSection>

            <DesktopConnector lang={lang} />
            <MobileConnector lang={lang} />

            {/* Card 2 — Session Two (In Person) — THE ANCHOR */}
            <FadeInSection delay={150} className="flex-1 max-w-sm lg:max-w-none mx-auto lg:mx-0 w-full">
              <div className="relative">
                <div className="flex justify-center mb-[-14px] relative z-10">
                  <span className="text-[11px] font-bold text-white bg-[#0D7A7A] px-4 py-1.5 rounded-full font-[Cairo] shadow-lg">
                    {CONTENT.crown[lang]}
                  </span>
                </div>
                <div
                  className="rounded-[20px] p-6 sm:p-8 lg:py-10 h-full flex flex-col text-center"
                  style={{
                    background: 'rgba(13,122,122,0.15)',
                    border: '2px solid #0D7A7A',
                  }}
                >
                  <div className="flex justify-center mb-5 mt-2">
                    <span className="text-[12px] font-bold text-[#1A2F4A] bg-white px-4 py-1.5 rounded-full font-[Cairo]">
                      {CONTENT.cards.session2.badge[lang]}
                    </span>
                  </div>
                  <div className="mb-4"><StethoscopeIcon /></div>
                  <h3 className="text-[22px] font-bold text-white font-[Cairo]">{CONTENT.cards.session2.title[lang]}</h3>
                  <p className="text-[13px] text-[#0D7A7A] font-[Cairo] mt-1">{CONTENT.cards.session2.subtitle[lang]}</p>
                  <p className="text-[14px] text-white/80 font-[Cairo] mt-3 leading-relaxed">
                    {CONTENT.cards.session2.desc[lang]}
                  </p>
                  <CheckList items={CONTENT.cards.session2.checks[lang]} isRtl={isRtl} />
                  <div className="mt-auto pt-5 flex justify-center">
                    <span className="text-[12px] text-white border border-white/30 px-3 py-1 rounded-full font-[Cairo]">
                      {CONTENT.cards.session2.modality[lang]}
                    </span>
                  </div>
                </div>
              </div>
            </FadeInSection>

            <DesktopConnector lang={lang} />
            <MobileConnector lang={lang} />

            {/* Card 3 — Session Three (Online) */}
            <FadeInSection delay={300} className="flex-1 max-w-sm lg:max-w-none mx-auto lg:mx-0 w-full">
              <div
                className="rounded-[20px] p-6 sm:p-8 h-full flex flex-col text-center"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                }}
              >
                <div className="flex justify-center mb-5">
                  <span className="text-[12px] font-bold text-white bg-[#0D7A7A] px-4 py-1.5 rounded-full font-[Cairo]">
                    {CONTENT.cards.session3.badge[lang]}
                  </span>
                </div>
                <div className="mb-4"><FollowUpIcon /></div>
                <h3 className="text-[20px] font-bold text-white font-[Cairo]">{CONTENT.cards.session3.title[lang]}</h3>
                <p className="text-[13px] text-[#0D7A7A] font-[Cairo] mt-1">{CONTENT.cards.session3.subtitle[lang]}</p>
                <p className="text-[14px] text-white/80 font-[Cairo] mt-3 leading-relaxed">
                  {CONTENT.cards.session3.desc[lang]}
                </p>
                <CheckList items={CONTENT.cards.session3.checks[lang]} isRtl={isRtl} />
                <div className="mt-auto pt-5 flex justify-center">
                  <span className="text-[12px] text-white border border-white/30 px-3 py-1 rounded-full font-[Cairo]">
                    {CONTENT.cards.session3.modality[lang]}
                  </span>
                </div>
              </div>
            </FadeInSection>
          </div>

          {/* ─── Pricing Statement ─── */}
          <FadeInSection delay={400}>
            <div className="mt-14">
              <div className="w-16 h-[1px] bg-white/20 mx-auto mb-8" />
              <p className="text-[18px] font-bold text-white font-[Cairo] text-center">
                {CONTENT.pricing[lang]}
              </p>
              <p className="text-[14px] text-white/70 font-[Cairo] text-center mt-2 leading-relaxed">
                {CONTENT.pricingSub[lang]}
              </p>
            </div>
          </FadeInSection>

          {/* ─── CTA Button ─── */}
          <FadeInSection delay={500}>
            <div className="text-center mt-10">
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="inline-block bg-white text-[#1A2F4A] font-bold font-[Cairo] text-[16px] px-10 py-3.5 rounded-xl hover:bg-[#0D7A7A] hover:text-white transition-colors duration-200"
              >
                {CONTENT.cta[lang]}
              </button>
              <p className="text-[12px] text-white/50 font-[Cairo] mt-3">
                {CONTENT.ctaSub[lang]}
              </p>
            </div>
          </FadeInSection>
        </div>
      </section>
    </>
  );
}
