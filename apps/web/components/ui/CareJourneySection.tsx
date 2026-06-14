'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Lang } from '@triaji/shared/i18n';
import FadeInSection from './FadeInSection';
import DoctorTrioModal from './DoctorTrioModal';

/* ─── Bilingual Content ─── */

const SECTION = {
  heading: {
    ar: 'من أعراضك لموعدك — في خطوات بسيطة',
    en: 'From symptoms to appointment — in simple steps',
  },
  subheading: {
    ar: 'ترياڃي بيسمعك، بيلاقيلك الدكتور الصح، وبتختار رحلتك العلاجية',
    en: 'Triajji listens, finds you the right doctor, and you choose your care journey',
  },
};

const STEPS = {
  step1: {
    title: { ar: 'احكِ عن أعراضك', en: 'Describe your symptoms' },
    desc: {
      ar: 'بالكتابة أو الصوت — بالعربي العادي، من غير مصطلحات طبية.\nترياڃي بيسمعك ويقيّم حالتك فوراً.',
      en: 'By text or voice — in your own words, no medical jargon needed.\nTriajji listens and assesses your condition instantly.',
    },
  },
  step2: {
    title: { ar: 'ترياڃي يلاقيلك الدكتور', en: 'Triajji finds you a doctor' },
    desc: {
      ar: 'بناءً على أعراضك، بنحدد التخصص الصح ونعرضلك\nدكاترة قريبين منك وبيقبلوا تأمينك.',
      en: 'Based on your symptoms, we determine the right specialty\nand show you nearby doctors who accept your insurance.',
    },
  },
  step3: {
    title: { ar: 'اختار واحجز', en: 'Choose and book' },
    desc: {
      ar: 'اختار الدكتور المناسب، حدد الميعاد،\nواختار نوع زيارتك — وجلستك محجوزة.',
      en: 'Choose the right doctor, pick a time,\nand select your visit type — your session is booked.',
    },
  },
};

const TRANSITION = {
  text: { ar: 'اختار رحلتك العلاجية', en: 'Choose your care journey' },
};

const STANDARD = {
  topLabel: { ar: 'زيارة واحدة', en: 'Single Visit' },
  title: { ar: 'زيارة واحدة', en: 'Single Visit' },
  subtitle: { ar: 'كشف عادي — أونلاين أو حضوري', en: 'Standard consultation — online or in-person' },
  online: {
    title: { ar: 'استشارة أونلاين', en: 'Online Consultation' },
    subtitle: { ar: 'مع دكتور متخصص — من البيت', en: 'With a specialized doctor — from home' },
    more: { ar: 'تعرف أكتر', en: 'Learn more' },
    expanded: {
      ar: 'مناسب لأول استشارة أو للمتابعة.\nالدكتور بيشوفك على فيديو، بيسمعك، وبيكتب الروشتة على ترياڃي.',
      en: 'Suitable for a first consultation or follow-up.\nThe doctor sees you on video, listens, and writes the prescription on Triajji.',
    },
  },
  clinic: {
    title: { ar: 'زيارة العيادة', en: 'Clinic Visit' },
    subtitle: { ar: 'كشف حضوري مع الدكتور', en: 'In-person examination with the doctor' },
    more: { ar: 'تعرف أكتر', en: 'Learn more' },
    expanded: {
      ar: 'الفحص الطبي الكامل في العيادة.\nالروشتة والتحاليل والأشعة بتتبعتلك على واتساب فوراً.',
      en: 'Full medical examination at the clinic.\nPrescriptions, labs, and imaging sent to you on WhatsApp instantly.',
    },
  },
  cta: { ar: 'احجز زيارة واحدة', en: 'Book a single visit' },
};

const TRIO = {
  recommended: { ar: 'موصى به', en: 'Recommended' },
  tagline: {
    ar: 'رحلتك العلاجية الكاملة — ثلاث جلسات، سعر واحد',
    en: 'Your complete care journey — three sessions, one price',
  },
  sessions: [
    {
      title: { ar: 'قبل الكشف', en: 'Before the Visit' },
      mode: { ar: 'أونلاين', en: 'Online' },
      desc: { ar: 'ترياڃي بيسمعك ويلاقيلك الدكتور', en: 'Triajji listens and finds you a doctor' },
    },
    {
      title: { ar: 'عند الدكتور', en: 'At the Doctor' },
      mode: { ar: 'حضوري', en: 'In-Person' },
      desc: { ar: 'الفحص الكامل، الروشتة، التحاليل، والأشعة', en: 'Full exam, prescription, labs, and imaging' },
    },
    {
      title: { ar: 'بعد الكشف', en: 'After the Visit' },
      mode: { ar: 'أونلاين', en: 'Online' },
      desc: { ar: 'المتابعة من البيت', en: 'Follow-up from home' },
    },
  ],
  pricing: {
    ar: 'سعر واحد للثلاث جلسات — يحدده الطبيب',
    en: 'One price for all three sessions — set by the doctor',
  },
  pricingSub: {
    ar: 'مش هتدفع تلاتة مرات',
    en: "You won't pay three times",
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

/* ─── SVG Icons ─── */

function ChatBubbleIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 20.5V7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H9l-4 3.5V20.5z" stroke="white" strokeWidth="2" fill="none" strokeLinejoin="round" />
      <circle cx="10" cy="12" r="1" fill="white" />
      <circle cx="14" cy="12" r="1" fill="white" />
      <circle cx="18" cy="12" r="1" fill="white" />
    </svg>
  );
}

function StethoscopeIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 3v5c0 4 5 5 5 2" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M20 3v5c0 4-5 5-5 2" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M14 10v8" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" />
      <circle cx="14" cy="21" r="3.5" stroke="white" strokeWidth="2" fill="none" />
    </svg>
  );
}

function CalendarCheckIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="5" width="22" height="20" rx="3" stroke="white" strokeWidth="2" fill="none" />
      <path d="M3 11h22" stroke="white" strokeWidth="2" />
      <path d="M9 3v4" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <path d="M19 3v4" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <path d="M10 17l3 3 5-6" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ─── Accordion Sub-option ─── */

function SubOption({ icon, title, subtitle, more, expanded }: {
  icon: string;
  title: string;
  subtitle: string;
  more: string;
  expanded: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-[#E5E7EB] rounded-xl p-4">
      <div className="flex items-start gap-3">
        <span className="text-2xl shrink-0">{icon}</span>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-[#1A2F4A] text-[15px]">{title}</p>
          <p className="text-[#6B7280] text-[13px] mt-0.5">{subtitle}</p>
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="text-[#0D7A7A] text-[13px] font-medium mt-2 hover:underline"
          >
            {open ? '▲' : '▼'} {more}
          </button>
          {open && (
            <p className="text-[#4A5568] text-[13px] mt-2 leading-relaxed whitespace-pre-line">
              {expanded}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════ */

export default function CareJourneySection({ lang = 'ar' }: { lang?: Lang }) {
  const [modalOpen, setModalOpen] = useState(false);
  const isRtl = lang === 'ar';

  const stepIcons = [<ChatBubbleIcon key="chat" />, <StethoscopeIcon key="steth" />, <CalendarCheckIcon key="cal" />];
  const stepData = [STEPS.step1, STEPS.step2, STEPS.step3];

  return (
    <>
      <DoctorTrioModal open={modalOpen} onClose={() => setModalOpen(false)} lang={lang} />

      <section id="care-journey">
        {/* ─── Section Header ─── */}
        <div className="bg-white pt-20 pb-8 px-4">
          <FadeInSection>
            <div className="max-w-5xl mx-auto text-center">
              <h2 className="text-[26px] md:text-[32px] font-bold text-[#1A2F4A] font-[Cairo] leading-tight">
                {SECTION.heading[lang]}
              </h2>
              <p className="text-[16px] text-[#6B7280] font-[Cairo] mt-3">
                {SECTION.subheading[lang]}
              </p>
            </div>
          </FadeInSection>
        </div>

        {/* ═══ PART 1 — How It Works ═══ */}
        <div className="bg-white pb-12 px-4">
          <div className="max-w-4xl mx-auto">

            {/* Desktop: horizontal steps with connecting line */}
            <div className="hidden md:block">
              <div className="relative">
                {/* Connecting line */}
                <div className="absolute top-[28px] left-[calc(16.67%)] right-[calc(16.67%)] h-[2px] bg-[#0D7A7A]/30 z-0" />

                <div className="grid grid-cols-3 gap-8 relative z-10">
                  {stepData.map((step, i) => (
                    <FadeInSection key={i} delay={i * 150}>
                      <div className="flex flex-col items-center text-center">
                        {/* Icon circle */}
                        <div className="w-14 h-14 rounded-full bg-[#0D7A7A] flex items-center justify-center mb-4 shadow-md">
                          {stepIcons[i]}
                        </div>
                        <h3 className="text-[17px] font-bold text-[#1A2F4A] font-[Cairo] mb-2">
                          {step.title[lang]}
                        </h3>
                        <p className="text-[14px] text-[#6B7280] font-[Cairo] leading-relaxed whitespace-pre-line">
                          {step.desc[lang]}
                        </p>
                      </div>
                    </FadeInSection>
                  ))}
                </div>
              </div>
            </div>

            {/* Mobile: vertical stack with connecting line */}
            <div className="md:hidden">
              <div className="relative">
                {/* Vertical connecting line */}
                <div
                  className={`absolute top-[28px] bottom-[28px] w-[2px] bg-[#0D7A7A]/30 ${isRtl ? 'right-[27px]' : 'left-[27px]'}`}
                />

                <div className="space-y-10 relative z-10">
                  {stepData.map((step, i) => (
                    <FadeInSection key={i} delay={i * 150}>
                      <div className="flex gap-5 items-start">
                        {/* Icon circle */}
                        <div className="w-14 h-14 rounded-full bg-[#0D7A7A] flex items-center justify-center shrink-0 shadow-md">
                          {stepIcons[i]}
                        </div>
                        <div className="pt-1">
                          <h3 className="text-[17px] font-bold text-[#1A2F4A] font-[Cairo] mb-1">
                            {step.title[lang]}
                          </h3>
                          <p className="text-[14px] text-[#6B7280] font-[Cairo] leading-relaxed whitespace-pre-line">
                            {step.desc[lang]}
                          </p>
                        </div>
                      </div>
                    </FadeInSection>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Transition ─── */}
        <div className="bg-gradient-to-b from-white to-[#F0F4F8] py-10 px-4 text-center">
          <FadeInSection>
            <span className="text-[#0D7A7A] text-[32px] block mb-3">↓</span>
            <h3 className="text-[22px] font-bold text-[#1A2F4A] font-[Cairo]">
              {TRANSITION.text[lang]}
            </h3>
          </FadeInSection>
        </div>

        {/* ═══ PART 2 — Care Options ═══ */}
        <div className="bg-[#F0F4F8] pb-20 px-4">
          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">

              {/* In RTL, Doctor Trio should be first in DOM on mobile (appears top),
                  and on desktop CSS order puts it on the right (prominent position in RTL).
                  In LTR, Doctor Trio is on the right (prominent position). */}

              {/* Card A — Standard Consultation
                  On mobile: order-2 (Doctor Trio first)
                  On desktop: order-1 in LTR (left), order-1 in RTL (left = less prominent) */}
              <FadeInSection delay={0} className="order-2 md:order-1">
                <div className="bg-white border-[1.5px] border-[#E5E7EB] rounded-[20px] p-6 sm:p-8 h-full flex flex-col">
                  {/* Top label */}
                  <div className="flex justify-center mb-4">
                    <span className="text-[12px] font-bold text-[#6B7280] bg-[#F3F4F6] px-4 py-1.5 rounded-full font-[Cairo]">
                      {STANDARD.topLabel[lang]}
                    </span>
                  </div>

                  {/* Icon */}
                  <div className="text-center text-[48px] mb-3">🗓️</div>

                  {/* Title */}
                  <h3 className="text-[22px] font-bold text-[#1A2F4A] font-[Cairo] text-center">
                    {STANDARD.title[lang]}
                  </h3>
                  <p className="text-[14px] text-[#6B7280] font-[Cairo] text-center mt-1 mb-6">
                    {STANDARD.subtitle[lang]}
                  </p>

                  {/* Divider */}
                  <div className="w-full h-[1px] bg-[#E5E7EB] mb-6" />

                  {/* Sub-options */}
                  <div className="space-y-4 flex-1">
                    <SubOption
                      icon="💻"
                      title={STANDARD.online.title[lang]}
                      subtitle={STANDARD.online.subtitle[lang]}
                      more={STANDARD.online.more[lang]}
                      expanded={STANDARD.online.expanded[lang]}
                    />
                    <SubOption
                      icon="🏥"
                      title={STANDARD.clinic.title[lang]}
                      subtitle={STANDARD.clinic.subtitle[lang]}
                      more={STANDARD.clinic.more[lang]}
                      expanded={STANDARD.clinic.expanded[lang]}
                    />
                  </div>

                  {/* CTA */}
                  <Link
                    href={`/${lang}/chat`}
                    className="block w-full text-center border-2 border-[#0D7A7A] text-[#0D7A7A] font-bold font-[Cairo] text-[15px] py-3 rounded-xl mt-6 hover:bg-[#0D7A7A] hover:text-white transition-colors duration-200"
                  >
                    {STANDARD.cta[lang]}
                  </Link>
                </div>
              </FadeInSection>

              {/* Card B — Doctor Trio
                  On mobile: order-1 (appears first — recommended leads)
                  On desktop: order-2 (right side — prominent in both RTL and LTR) */}
              <FadeInSection delay={200} className="order-1 md:order-2">
                <div className="relative">
                  {/* Recommended badge */}
                  <div className="flex justify-center mb-[-14px] relative z-10">
                    <span className="text-[12px] font-bold text-white bg-[#0D7A7A] px-5 py-1.5 rounded-full font-[Cairo] shadow-lg">
                      {TRIO.recommended[lang]}
                    </span>
                  </div>

                  <div className="bg-[#1A2F4A] border-2 border-[#0D7A7A] rounded-[20px] p-6 sm:p-8 h-full flex flex-col">
                    {/* Brand */}
                    <h3
                      className="text-[32px] font-bold text-white font-[Cairo] text-center mt-2"
                      style={{ letterSpacing: '0.02em' }}
                    >
                      Doctor Trio
                    </h3>
                    <p className="text-[16px] font-bold text-[#0D7A7A] font-[Cairo] text-center mt-1">
                      دوكتور تريو
                    </p>
                    <p className="text-[14px] text-white/80 font-[Cairo] text-center mt-2 mb-6">
                      {TRIO.tagline[lang]}
                    </p>

                    {/* Divider */}
                    <div className="w-full h-[1px] bg-[#0D7A7A]/40 mb-6" />

                    {/* Three sessions — compact timeline */}
                    <div className={`relative ${isRtl ? 'pr-5' : 'pl-5'} space-y-5 flex-1`}>
                      {/* Vertical line */}
                      <div
                        className={`absolute top-[10px] bottom-[10px] w-[2px] bg-[#0D7A7A]/40 ${isRtl ? 'right-[9px]' : 'left-[9px]'}`}
                      />

                      {TRIO.sessions.map((session, i) => (
                        <div key={i} className="relative flex items-start gap-3">
                          {/* Badge */}
                          <div
                            className={`absolute ${isRtl ? 'right-[-20px]' : 'left-[-20px]'} top-0 w-[20px] h-[20px] rounded-full flex items-center justify-center text-[10px] font-bold z-10 ${
                              i === 1
                                ? 'bg-white text-[#1A2F4A]'
                                : 'bg-[#0D7A7A] text-white'
                            }`}
                          >
                            {i === 0 ? '①' : i === 1 ? '②' : '③'}
                          </div>
                          <div className={`${isRtl ? 'mr-2' : 'ml-2'}`}>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-white font-bold font-[Cairo] text-[14px]">
                                {session.title[lang]}
                              </span>
                              <span className={`text-[11px] font-[Cairo] px-2 py-0.5 rounded-full ${
                                i === 1
                                  ? 'bg-white/20 text-white'
                                  : 'bg-[#0D7A7A]/30 text-[#0D7A7A]'
                              }`}>
                                {session.mode[lang]}
                              </span>
                              {i === 1 && <span className="text-[#0D7A7A] text-[11px]">★</span>}
                            </div>
                            <p className="text-white/70 font-[Cairo] text-[12px] mt-0.5">
                              {session.desc[lang]}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Pricing */}
                    <div className="mt-6">
                      <div className="w-full h-[1px] bg-[#0D7A7A]/40 mb-4" />
                      <p className="text-[15px] font-bold text-white font-[Cairo] text-center">
                        {TRIO.pricing[lang]}
                      </p>
                      <p className="text-[12px] text-white/70 font-[Cairo] text-center mt-1">
                        {TRIO.pricingSub[lang]}
                      </p>
                    </div>

                    {/* CTA */}
                    <button
                      type="button"
                      onClick={() => setModalOpen(true)}
                      className="block w-full text-center bg-white text-[#1A2F4A] font-bold font-[Cairo] text-[15px] py-3 rounded-xl mt-6 hover:bg-[#0D7A7A] hover:text-white transition-colors duration-200"
                    >
                      {TRIO.cta[lang]}
                    </button>
                    <p className="text-[11px] text-white/50 font-[Cairo] text-center mt-3">
                      {TRIO.ctaSub[lang]}
                    </p>
                  </div>
                </div>
              </FadeInSection>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
