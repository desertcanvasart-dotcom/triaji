'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import type { Lang } from '@triaji/shared/i18n';
import SiteNavbar from '@/components/shared/SiteNavbar';
import SiteFooter from '@/components/shared/SiteFooter';
import FadeInSection from '@/components/ui/FadeInSection';

export interface ProviderContent {
  hero: { badge: string; title: string; subtitle: string; cta: string; ctaHref: string };
  painPoints: { icon: string; title: string; description: string }[];
  features: { icon: string; title: string; description: string }[];
  steps: { number: string; title: string; description: string }[];
  proofStats: { value: string; label: string }[];
}

export interface ProviderPageProps {
  accentColor: string;
  accentClass: string;
  accentLight: string;
  accentText: string;
  content: ProviderContent;
  illustration: ReactNode;
  lang: Lang;
}

const LABELS = {
  painPoints: { ar: '\u0627\u0644\u062A\u062D\u062F\u064A\u0627\u062A', en: 'Challenges' },
  solution: { ar: '\u0643\u064A\u0641 \u064A\u0633\u0627\u0639\u062F \u062A\u0631\u064A\u0627\u0686\u064A', en: 'How DoctorTrio Helps' },
  steps: { ar: '\u0643\u064A\u0641 \u062A\u0628\u062F\u0623\u061F', en: 'How to Start?' },
  ctaTitle: { ar: '\u0627\u0628\u062F\u0623 \u0627\u0644\u0622\u0646', en: 'Start Now' },
  ctaSubtitle: {
    ar: '\u0627\u0644\u062A\u0633\u062C\u064A\u0644 \u0645\u062C\u0627\u0646\u064A \u0648\u064A\u0633\u062A\u063A\u0631\u0642 \u0623\u0642\u0644 \u0645\u0646 10 \u062F\u0642\u0627\u0626\u0642',
    en: 'Registration is free and takes less than 10 minutes',
  },
};

export default function ProviderPageTemplate({
  accentColor,
  accentClass,
  accentLight,
  accentText,
  content,
  illustration,
  lang,
}: ProviderPageProps) {
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  return (
    <div dir={dir} className="min-h-screen font-[Cairo]">
      <SiteNavbar lang={lang} />

      {/* Hero */}
      <section
        className="relative overflow-hidden py-20 px-4"
        style={{
          background: `linear-gradient(135deg, #1A2F4A 0%, ${accentColor} 100%)`,
        }}
      >
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-12">
          <div className="flex-1 text-center md:text-start">
            <span
              className={`inline-block ${accentClass} text-white text-sm font-bold px-4 py-1.5 rounded-full mb-6`}
            >
              {content.hero.badge}
            </span>
            <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight mb-4">
              {content.hero.title}
            </h1>
            <p className="text-white/70 text-lg leading-relaxed mb-8 max-w-lg">
              {content.hero.subtitle}
            </p>
            <Link
              href={content.hero.ctaHref}
              className={`inline-block ${accentClass} hover:opacity-90 text-white font-bold px-8 py-3 rounded-xl text-lg transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5`}
            >
              {content.hero.cta}
            </Link>
          </div>
          <div className="flex-1 flex justify-center">{illustration}</div>
        </div>
      </section>

      {/* Pain Points */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <FadeInSection>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 text-center mb-12">
              {LABELS.painPoints[lang]}
            </h2>
          </FadeInSection>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {content.painPoints.map((point, i) => (
              <FadeInSection key={i} delay={i * 120}>
                <div className="bg-white border border-gray-100 rounded-2xl p-6 text-center shadow-sm">
                  <span className="text-4xl mb-4 block">{point.icon}</span>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">{point.title}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{point.description}</p>
                </div>
              </FadeInSection>
            ))}
          </div>
        </div>
      </section>

      {/* Features / Solution */}
      <section className="py-20 px-4 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <FadeInSection>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 text-center mb-12">
              {LABELS.solution[lang]}
            </h2>
          </FadeInSection>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {content.features.map((feature, i) => (
              <FadeInSection key={i} delay={i * 100}>
                <div className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow duration-300">
                  <span className="text-3xl mb-3 block">{feature.icon}</span>
                  <h3 className={`text-lg font-bold mb-2 ${accentText}`}>{feature.title}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{feature.description}</p>
                </div>
              </FadeInSection>
            ))}
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <FadeInSection>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 text-center mb-16">
              {LABELS.steps[lang]}
            </h2>
          </FadeInSection>
          <div className="relative flex flex-col md:flex-row items-start justify-center gap-12 md:gap-8">
            {/* Dashed connector line (desktop only) */}
            <div className="hidden md:block absolute top-10 left-[15%] right-[15%] border-t-2 border-dashed border-gray-300" />
            {content.steps.map((step, i) => (
              <FadeInSection key={i} delay={i * 150} className="flex-1 text-center relative z-10">
                <div
                  className={`w-16 h-16 rounded-full ${accentClass} text-white text-2xl font-bold flex items-center justify-center mx-auto mb-4`}
                >
                  {step.number}
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed max-w-xs mx-auto">
                  {step.description}
                </p>
              </FadeInSection>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className={`py-16 px-4 ${accentLight}`}>
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-wrap justify-center gap-12 md:gap-20">
            {content.proofStats.map((stat, i) => (
              <FadeInSection key={i} delay={i * 100} className="text-center">
                <div className={`text-4xl md:text-5xl font-bold ${accentText}`}>{stat.value}</div>
                <div className="text-gray-700 text-sm mt-1 font-medium">{stat.label}</div>
              </FadeInSection>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4" style={{ backgroundColor: '#1A2F4A' }}>
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
            {LABELS.ctaTitle[lang]}
          </h2>
          <p className="text-white/70 mb-8">{LABELS.ctaSubtitle[lang]}</p>
          <Link
            href={content.hero.ctaHref}
            className={`inline-block ${accentClass} hover:opacity-90 text-white font-bold px-10 py-3.5 rounded-xl text-lg transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5`}
          >
            {content.hero.cta}
          </Link>
        </div>
      </section>

      <SiteFooter lang={lang} />
    </div>
  );
}
