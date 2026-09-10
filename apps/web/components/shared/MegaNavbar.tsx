'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type { Lang } from '@triaji/shared/i18n';
import LanguageDropdown from './LanguageDropdown';

interface MenuItem { icon: string; title: string; description: string; href: string; badge?: string; badgeColor?: string }
interface SimpleItem { icon: string; label: string; href: string }
interface Column { heading: string; items: MenuItem[] }
interface MegaMenu { label: string; id: string; columns?: Column[]; simple?: boolean; items?: SimpleItem[]; cta: { label: string; href: string }; ctaNote?: string; highlight?: { icon: string; title: string; description: string; href: string } }

const C = {
  ar: {
    logo: '\u062f\u0643\u062a\u0648\u0631 \u062a\u0631\u064a\u0648',
    logoTag: '\u0645\u0646\u0635\u0629 \u0627\u0644\u0631\u0639\u0627\u064a\u0629 \u0627\u0644\u0635\u062d\u064a\u0629 \u0627\u0644\u0630\u0643\u064a\u0629',
    menus: [
      {
        label: '\u0644\u0644\u0645\u0631\u0636\u0649', id: 'patients',
        columns: [
          { heading: '\u0627\u0644\u0631\u0639\u0627\u064a\u0629 \u0627\u0644\u0635\u062d\u064a\u0629', items: [
            { icon: '\u{1F9E0}', title: '\u0627\u0644\u0641\u0631\u0632 \u0627\u0644\u0637\u0628\u064a \u0627\u0644\u0630\u0643\u064a', description: '\u0635\u0641 \u0623\u0639\u0631\u0627\u0636\u0643 \u2014 AI \u064a\u0648\u062c\u0647\u0643 \u0644\u0644\u062f\u0643\u062a\u0648\u0631 \u0627\u0644\u0645\u0646\u0627\u0633\u0628', href: '/ar/chat' },
            { icon: '\u{1F4CB}', title: '\u0633\u062c\u0644\u0643 \u0627\u0644\u0637\u0628\u064a \u0627\u0644\u0643\u0627\u0645\u0644', description: '\u062a\u062d\u0627\u0644\u064a\u0644\u060c \u0623\u062f\u0648\u064a\u0629\u060c \u0648\u0632\u064a\u0627\u0631\u0627\u062a \u0641\u064a \u0645\u0643\u0627\u0646 \u0648\u0627\u062d\u062f', href: '/ar/medical-record' },
            { icon: '\u{1F9EA}', title: '\u0627\u0644\u062a\u062d\u0627\u0644\u064a\u0644 \u0648\u0627\u0644\u0623\u0634\u0639\u0629', description: '\u0627\u062d\u062c\u0632 \u0641\u064a \u0627\u0644\u0628\u0631\u062c \u0648\u0627\u0644\u0645\u062e\u062a\u0628\u0631 \u0648\u0623\u0644\u0641\u0627', href: '/ar/patients' },
            { icon: '\u{1F48A}', title: '\u0627\u0644\u0631\u0648\u0634\u062a\u0629 \u0648\u0627\u0644\u0635\u064a\u062f\u0644\u064a\u0629', description: '\u062a\u062a\u0628\u0639 \u0648\u0635\u0641\u062a\u0643 \u0645\u0646 \u0627\u0644\u0637\u0628\u064a\u0628 \u0644\u0644\u0635\u064a\u062f\u0644\u064a\u0629', href: '/ar/patients' },
          ]},
          { heading: '\u062e\u062f\u0645\u0627\u062a \u0645\u062a\u0642\u062f\u0645\u0629', items: [
            { icon: '\u{1F468}\u200D\u2695\uFE0F', title: '\u0637\u0628\u064a\u0628\u0643 \u0627\u0644\u0623\u0633\u0627\u0633\u064a', description: 'GP \u0645\u062e\u0635\u0635 \u0648\u0645\u0643\u0627\u0644\u0645\u0627\u062a \u0641\u064a\u062f\u064a\u0648', href: '/ar/patients' },
            { icon: '\u{1F6A8}', title: '\u0627\u0644\u0628\u062d\u062b \u0639\u0646 \u0633\u0631\u064a\u0631 \u0639\u0646\u0627\u064a\u0629', description: '\u0627\u0644\u0623\u0648\u0644 \u0645\u0646 \u0646\u0648\u0639\u0647 \u0641\u064a \u0645\u0635\u0631', href: '/ar/icu', badge: '\u0627\u0644\u0623\u0648\u0644 \u0641\u064a \u0645\u0635\u0631', badgeColor: 'red' },
            { icon: '\u{1F476}', title: '\u0645\u0644\u0641\u0627\u062a \u0627\u0644\u0623\u0637\u0641\u0627\u0644', description: '\u0646\u0645\u0648\u060c \u062a\u0637\u0639\u064a\u0645\u0627\u062a\u060c \u0648\u0645\u0631\u0627\u062d\u0644 \u062a\u0637\u0648\u0631', href: '/ar/patients' },
            { icon: '\u{1F916}', title: '\u062f\u0643\u062a\u0648\u0631 \u062a\u0631\u064a\u0648 \u064a\u0633\u0623\u0644\u0643', description: '\u0645\u0633\u0627\u0639\u062f\u0643 \u0627\u0644\u0635\u062d\u064a \u0627\u0644\u0634\u062e\u0635\u064a \u0628\u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064a', href: '/ar/health-assistant', badge: '\u062c\u062f\u064a\u062f', badgeColor: 'teal' },
          ]},
        ],
        cta: { label: '\u0627\u0628\u062f\u0623 \u0627\u0644\u0641\u0631\u0632 \u0627\u0644\u0637\u0628\u064a \u0645\u062c\u0627\u0646\u0627\u064b', href: '/ar/chat' },
        highlight: { icon: '\u{1F4BB}', title: '\u062f\u0643\u062a\u0648\u0631 \u062a\u0631\u064a\u0648', description: '\u0645\u0648\u0639\u062f \u0623\u0648\u0646\u0644\u0627\u064a\u0646 + \u0632\u064a\u0627\u0631\u0629 \u0648\u0627\u062d\u062f\u0629 + \u0645\u062a\u0627\u0628\u0639\u0629 \u0623\u0648\u0646\u0644\u0627\u064a\u0646 \u2014 \u0628\u062f\u0644 3 \u0632\u064a\u0627\u0631\u0627\u062a \u0628\u0633\u0639\u0631 \u0648\u0627\u062d\u062f', href: '/ar/patients' },
      } as MegaMenu,
      {
        label: '\u0644\u0644\u0623\u0637\u0628\u0627\u0621', id: 'doctors',
        columns: [
          { heading: '\u0623\u062f\u0648\u0627\u062a \u0627\u0644\u0637\u0628\u064a\u0628', items: [
            { icon: '\u{1F4CB}', title: '\u0645\u0644\u062e\u0635 \u0642\u0628\u0644 \u0627\u0644\u0643\u0634\u0641', description: '\u0645\u0644\u0641 \u0637\u0628\u064a \u0643\u0627\u0645\u0644 \u0644\u0643\u0644 \u0645\u0631\u064a\u0636 \u0642\u0628\u0644 \u0627\u0644\u0632\u064a\u0627\u0631\u0629', href: '/ar/doctor/dashboard' },
            { icon: '\u26A0\uFE0F', title: '\u0641\u062d\u0635 \u062a\u0641\u0627\u0639\u0644\u0627\u062a \u0627\u0644\u0623\u062f\u0648\u064a\u0629', description: '\u062a\u0646\u0628\u064a\u0647 \u0641\u0648\u0631\u064a \u0644\u0644\u062a\u0641\u0627\u0639\u0644\u0627\u062a \u0627\u0644\u062f\u0648\u0627\u0626\u064a\u0629 \u0627\u0644\u062e\u0637\u064a\u0631\u0629', href: '/ar/doctor/dashboard' },
            { icon: '\u{1F9EA}', title: '\u0637\u0644\u0628 \u062a\u062d\u0627\u0644\u064a\u0644 \u0630\u0643\u064a', description: '\u0623\u0631\u0633\u0644 \u0637\u0644\u0628\u0627\u062a \u0645\u0628\u0627\u0634\u0631\u0629 \u0644\u0644\u0628\u0631\u062c \u0648\u0627\u0644\u0645\u062e\u062a\u0628\u0631 \u0648\u0623\u0644\u0641\u0627', href: '/ar/doctor/dashboard' },
            { icon: '\u{1F4F9}', title: '\u0645\u0643\u0627\u0644\u0645\u0627\u062a \u0641\u064a\u062f\u064a\u0648 \u0645\u0639 \u0645\u0631\u0636\u0627\u0643', description: '\u0644\u0648\u062d\u0629 \u0627\u0644\u0645\u0631\u0636\u0649 + \u0645\u0643\u0627\u0644\u0645\u0627\u062a GP \u0633\u0631\u064a\u0639\u0629', href: '/ar/doctor/dashboard' },
          ]},
          { heading: '\u0625\u062f\u0627\u0631\u0629 \u0627\u0644\u0639\u064a\u0627\u062f\u0629', items: [
            { icon: '\u{1F3E5}', title: '\u0625\u062f\u0627\u0631\u0629 \u0639\u064a\u0627\u062f\u062a\u0643', description: '\u0642\u0627\u0626\u0645\u0629 \u0627\u0646\u062a\u0638\u0627\u0631\u060c \u062d\u062c\u0648\u0632\u0627\u062a\u060c \u0648\u0641\u0648\u0627\u062a\u064a\u0631', href: '/ar/providers/clinics' },
            { icon: '\u{1F476}', title: '\u062d\u0627\u0633\u0628\u0629 \u062c\u0631\u0639\u0627\u062a \u0627\u0644\u0623\u0637\u0641\u0627\u0644', description: '\u062c\u0631\u0639\u0629 \u062d\u0633\u0628 \u0627\u0644\u0648\u0632\u0646 + \u0627\u0644\u062a\u0631\u0643\u064a\u0632\u0627\u062a \u0627\u0644\u0645\u0635\u0631\u064a\u0629', href: '/ar/doctor/dashboard' },
            { icon: '\u{1F6A8}', title: '\u0627\u0644\u0628\u062d\u062b \u0639\u0646 \u0633\u0631\u064a\u0631 \u0639\u0646\u0627\u064a\u0629', description: '\u0627\u0628\u062d\u062b \u0639\u0646 \u0623\u0642\u0631\u0628 \u0633\u0631\u064a\u0631 ICU \u0641\u064a \u062b\u0648\u0627\u0646\u064d', href: '/ar/icu', badge: '\u0627\u0644\u0623\u0648\u0644 \u0641\u064a \u0645\u0635\u0631', badgeColor: 'red' },
            { icon: '\u{1F4BB}', title: '\u062f\u0643\u062a\u0648\u0631 \u062a\u0631\u064a\u0648', description: '\u0627\u0644\u0645\u0648\u0639\u062f \u0627\u0644\u0623\u0648\u0644 \u0648\u0627\u0644\u062b\u0627\u0644\u062b \u0623\u0648\u0646\u0644\u0627\u064a\u0646\u060c \u0627\u0644\u062b\u0627\u0646\u064a \u0641\u064a \u0627\u0644\u0639\u064a\u0627\u062f\u0629', href: '/ar/patients' },
          ]},
        ],
        cta: { label: '\u0633\u062c\u0651\u0644 \u0643\u0637\u0628\u064a\u0628 \u0645\u062c\u0627\u0646\u0627\u064b', href: '/ar/doctor/register' },
        highlight: { icon: '\u{1F4BB}', title: '\u062f\u0643\u062a\u0648\u0631 \u062a\u0631\u064a\u0648', description: '\u0627\u0644\u0645\u0648\u0639\u062f \u0627\u0644\u0623\u0648\u0644 \u0648\u0627\u0644\u062b\u0627\u0644\u062b \u0623\u0648\u0646\u0644\u0627\u064a\u0646\u060c \u0627\u0644\u062b\u0627\u0646\u064a \u0641\u064a \u0627\u0644\u0639\u064a\u0627\u062f\u0629 \u2014 \u0628\u062f\u0644 3 \u0632\u064a\u0627\u0631\u0627\u062a', href: '/ar/patients' },
      } as MegaMenu,
      {
        label: '\u0644\u0645\u0642\u062f\u0645\u064a \u0627\u0644\u062e\u062f\u0645\u0629', id: 'providers', simple: true,
        items: [
          { icon: '\u{1F3E5}', label: '\u0627\u0644\u0645\u0633\u062a\u0634\u0641\u064a\u0627\u062a', href: '/ar/providers/hospitals' },
          { icon: '\u{1F3EA}', label: '\u0627\u0644\u0639\u064a\u0627\u062f\u0627\u062a', href: '/ar/providers/clinics' },
          { icon: '\u{1F9EA}', label: '\u0627\u0644\u0645\u0639\u0627\u0645\u0644', href: '/ar/providers/labs' },
          { icon: '\u{1F535}', label: '\u0645\u0631\u0627\u0643\u0632 \u0627\u0644\u0623\u0634\u0639\u0629', href: '/ar/providers/radiology' },
          { icon: '\u{1F48A}', label: '\u0627\u0644\u0635\u064a\u062f\u0644\u064a\u0627\u062a', href: '/ar/providers/pharmacies' },
          { icon: '\u{1F6E1}\uFE0F', label: '\u0627\u0644\u062a\u0623\u0645\u064a\u0646', href: '/ar/providers/insurance' },
        ],
        cta: { label: '\u0633\u062c\u0651\u0644 \u0645\u0624\u0633\u0633\u062a\u0643 \u0627\u0644\u0622\u0646', href: '/ar/contact' },
        ctaNote: '\u0645\u062c\u0627\u0646\u064a \u0644\u0644\u062a\u0633\u062c\u064a\u0644 \u2014 \u0646\u062a\u0648\u0627\u0635\u0644 \u0645\u0639\u0627\u0643 \u062e\u0644\u0627\u0644 24 \u0633\u0627\u0639\u0629',
      } as MegaMenu,
    ],
    simpleLinks: [{ label: '\u0645\u0646 \u0646\u062d\u0646', href: '/ar/about' }],
    auth: { doctorLogin: { label: '\u062f\u062e\u0648\u0644 \u0627\u0644\u0623\u0637\u0628\u0627\u0621', href: '/ar/doctor/login' }, login: { label: '\u062f\u062e\u0648\u0644', href: '/ar/login' }, signup: { label: '\u0627\u0628\u062f\u0623 \u0627\u0644\u0622\u0646', href: '/ar/chat' } },
    learnMore: '\u0627\u0639\u0631\u0641 \u0623\u0643\u062a\u0631',
  },
  en: {
    logo: 'DoctorTrio',
    logoTag: 'Smart Healthcare Platform',
    menus: [
      {
        label: 'For Patients', id: 'patients',
        columns: [
          { heading: 'Healthcare', items: [
            { icon: '\u{1F9E0}', title: 'AI Medical Triage', description: 'Describe symptoms \u2014 AI guides you to the right doctor', href: '/en/chat' },
            { icon: '\u{1F4CB}', title: 'Complete Medical Record', description: 'Labs, medications, and visits in one place', href: '/en/medical-record' },
            { icon: '\u{1F9EA}', title: 'Labs & Radiology', description: 'Book at Al-Borg, Al-Mokhtabar, and Alfa', href: '/en/patients' },
            { icon: '\u{1F48A}', title: 'Prescriptions & Pharmacy', description: 'Track your prescription from doctor to pharmacy', href: '/en/patients' },
          ]},
          { heading: 'Advanced Services', items: [
            { icon: '\u{1F468}\u200D\u2695\uFE0F', title: 'Your Primary Doctor', description: 'Dedicated GP and video calls', href: '/en/patients' },
            { icon: '\u{1F6A8}', title: 'ICU Bed Finder', description: 'First of its kind in Egypt', href: '/en/icu', badge: 'First in Egypt', badgeColor: 'red' },
            { icon: '\u{1F476}', title: 'Paediatric Profiles', description: 'Growth, vaccines, and milestones', href: '/en/patients' },
            { icon: '\u{1F916}', title: 'Ask DoctorTrio', description: 'Your personal AI health companion', href: '/en/health-assistant', badge: 'New', badgeColor: 'teal' },
          ]},
        ],
        cta: { label: 'Start free medical triage', href: '/en/chat' },
        highlight: { icon: '\u{1F4BB}', title: 'Doctor Trio', description: 'Online consult + one clinic visit + online follow-up \u2014 instead of 3 trips, one price', href: '/en/patients' },
      } as MegaMenu,
      {
        label: 'For Doctors', id: 'doctors',
        columns: [
          { heading: 'Doctor Tools', items: [
            { icon: '\u{1F4CB}', title: 'Pre-consultation Summary', description: 'Complete patient file before every visit', href: '/en/doctor/dashboard' },
            { icon: '\u26A0\uFE0F', title: 'Drug Interaction Checker', description: 'Instant alert for dangerous drug interactions', href: '/en/doctor/dashboard' },
            { icon: '\u{1F9EA}', title: 'Smart Lab Ordering', description: 'Send orders directly to Al-Borg and Al-Mokhtabar', href: '/en/doctor/dashboard' },
            { icon: '\u{1F4F9}', title: 'Video Calls with Patients', description: 'Patient panel + quick GP video consultations', href: '/en/doctor/dashboard' },
          ]},
          { heading: 'Clinic Management', items: [
            { icon: '\u{1F3E5}', title: 'Manage Your Clinic', description: 'Queue, bookings, and invoices', href: '/en/providers/clinics' },
            { icon: '\u{1F476}', title: 'Paediatric Dose Calculator', description: 'Weight-based dose + Egyptian formulations', href: '/en/doctor/dashboard' },
            { icon: '\u{1F6A8}', title: 'ICU Bed Search', description: 'Find the nearest available ICU bed in seconds', href: '/en/icu', badge: 'First in Egypt', badgeColor: 'red' },
            { icon: '\u{1F4BB}', title: 'Doctor Trio', description: 'First and third appointments online, second in clinic', href: '/en/patients' },
          ]},
        ],
        cta: { label: 'Register as a doctor for free', href: '/en/doctor/register' },
        highlight: { icon: '\u{1F4BB}', title: 'Doctor Trio', description: 'First and third appointments online, second in clinic \u2014 instead of 3 trips', href: '/en/patients' },
      } as MegaMenu,
      {
        label: 'For Providers', id: 'providers', simple: true,
        items: [
          { icon: '\u{1F3E5}', label: 'Hospitals', href: '/en/providers/hospitals' },
          { icon: '\u{1F3EA}', label: 'Clinics', href: '/en/providers/clinics' },
          { icon: '\u{1F9EA}', label: 'Laboratories', href: '/en/providers/labs' },
          { icon: '\u{1F535}', label: 'Radiology Centers', href: '/en/providers/radiology' },
          { icon: '\u{1F48A}', label: 'Pharmacies', href: '/en/providers/pharmacies' },
          { icon: '\u{1F6E1}\uFE0F', label: 'Insurance', href: '/en/providers/insurance' },
        ],
        cta: { label: 'Register your institution', href: '/en/contact' },
        ctaNote: 'Free to register \u2014 we contact you within 24 hours',
      } as MegaMenu,
    ],
    simpleLinks: [{ label: 'About Us', href: '/en/about' }],
    auth: { doctorLogin: { label: 'Doctor Login', href: '/en/doctor/login' }, login: { label: 'Sign In', href: '/en/login' }, signup: { label: 'Get Started', href: '/en/chat' } },
    learnMore: 'Learn more',
  },
};

function Chevron({ open }: { open: boolean }) {
  return (
    <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MenuItemLink({ item }: { item: MenuItem }) {
  const badgeCls = item.badgeColor === 'red' ? 'bg-red-100 text-red-600' : 'bg-teal-100 text-teal-600';
  return (
    <Link href={item.href} className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors group">
      <span className="text-xl mt-0.5 shrink-0">{item.icon}</span>
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-gray-900 font-semibold text-sm group-hover:text-teal-700 transition-colors">{item.title}</span>
          {item.badge && <span className={`${badgeCls} text-xs px-1.5 py-0.5 rounded-full font-bold`}>{item.badge}</span>}
        </div>
        <span className="text-gray-400 text-xs leading-relaxed block">{item.description}</span>
      </div>
    </Link>
  );
}

export default function MegaNavbar({ lang }: { lang: Lang }) {
  const c = C[lang];
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileAccordion, setMobileAccordion] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);

  const handleEnter = useCallback((id: string) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpenMenu(id);
  }, []);

  const handleLeave = useCallback(() => {
    closeTimer.current = setTimeout(() => setOpenMenu(null), 150);
  }, []);

  const renderMegaPanel = (menu: MegaMenu) => {
    if (menu.simple && menu.items) {
      return (
        <div className="bg-white border-b border-gray-200 shadow-xl shadow-gray-200/60 animate-[fadeInDown_0.2s_ease_forwards]" onMouseEnter={() => handleEnter(menu.id)} onMouseLeave={handleLeave}>
          <div className="max-w-3xl mx-auto px-6 py-6">
            <p className="text-gray-400 text-xs font-semibold tracking-widest mb-4">
              {lang === 'ar' ? '\u0633\u062c\u0651\u0644 \u0645\u0624\u0633\u0633\u062a\u0643 \u0627\u0644\u0635\u062d\u064a\u0629 \u0641\u064a \u062f\u0643\u062a\u0648\u0631 \u062a\u0631\u064a\u0648' : 'Register your healthcare institution on DoctorTrio'}
            </p>
            <div className="grid grid-cols-3 gap-3">
              {menu.items.map((item, i) => (
                <Link key={i} href={item.href} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-teal-200 hover:bg-teal-50/50 transition-all cursor-pointer group">
                  <span className="text-xl">{item.icon}</span>
                  <span className="text-gray-700 font-medium text-sm group-hover:text-teal-700 transition-colors">{item.label}</span>
                </Link>
              ))}
            </div>
            <div className="border-t border-gray-100 pt-4 mt-2 flex items-center justify-between">
              {menu.ctaNote && <p className="text-gray-400 text-xs">{menu.ctaNote}</p>}
              <Link href={menu.cta.href} className="bg-teal-600 hover:bg-teal-500 text-white font-bold text-sm px-4 py-2 rounded-xl transition-all hover:shadow-md">{menu.cta.label}</Link>
            </div>
          </div>
        </div>
      );
    }

    if (!menu.columns) return null;

    return (
      <div className="bg-white border-b border-gray-200 shadow-xl shadow-gray-200/60 animate-[fadeInDown_0.2s_ease_forwards]" onMouseEnter={() => handleEnter(menu.id)} onMouseLeave={handleLeave}>
        <div className="max-w-5xl mx-auto px-6 py-6">
          <div className="grid grid-cols-3 gap-6">
            {/* Column 1 */}
            <div>
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-widest mb-3">{menu.columns[0]?.heading}</p>
              <div className="space-y-1">
                {menu.columns[0]?.items.map((item, ii) => <MenuItemLink key={ii} item={item} />)}
              </div>
            </div>

            {/* Column 2 */}
            <div>
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-widest mb-3">{menu.columns[1]?.heading}</p>
              <div className="space-y-1">
                {menu.columns[1]?.items.map((item, ii) => <MenuItemLink key={ii} item={item} />)}
              </div>
            </div>

            {/* Column 3 — Highlight card + CTA */}
            <div className="ltr:border-l rtl:border-r border-gray-100 ltr:pl-6 rtl:pr-6">
              {menu.highlight && (
                <Link href={menu.highlight.href} className="block bg-gradient-to-br from-teal-100 to-teal-200 rounded-2xl p-4 mb-4 group hover:shadow-md transition-shadow">
                  <span className="text-2xl block mb-2">{menu.highlight.icon}</span>
                  <h4 className="text-teal-800 font-bold text-sm mb-1">{menu.highlight.title}</h4>
                  <p className="text-teal-600 text-xs leading-relaxed">{menu.highlight.description}</p>
                  <span className="text-teal-600 text-xs font-semibold mt-2 inline-flex items-center gap-1 group-hover:gap-2 transition-all">
                    {c.learnMore} <span className="rtl:rotate-180">&rarr;</span>
                  </span>
                </Link>
              )}
              <Link href={menu.cta.href} className="block w-full text-center bg-teal-600 hover:bg-teal-500 text-white font-bold text-sm px-4 py-2.5 rounded-xl transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
                {menu.cta.label}
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <nav className={`sticky top-0 z-50 relative transition-all duration-300 ${scrolled ? 'bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-100' : 'bg-white/80 backdrop-blur-md'}`}>
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex flex-col items-start leading-none">
          <span className="text-teal-700 font-black text-xl tracking-tight">{c.logo}</span>
          <span className="hidden lg:block text-gray-400 text-[11px] leading-tight mt-0.5">{c.logoTag}</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1">
          {c.menus.map((menu) => (
            <div key={menu.id} onMouseEnter={() => handleEnter(menu.id)} onMouseLeave={handleLeave}>
              <button className={`flex items-center gap-1 text-sm font-medium px-3 py-2 rounded-lg transition-all duration-200 ${openMenu === menu.id ? 'text-gray-900 bg-gray-50' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}`}>
                {menu.label}
                <Chevron open={openMenu === menu.id} />
              </button>
            </div>
          ))}
          {c.simpleLinks.map((link, i) => (
            <Link key={i} href={link.href} className="text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors">{link.label}</Link>
          ))}
        </div>

        {/* Auth + Language */}
        <div className="hidden md:flex items-center gap-2">
          <Link href={c.auth.doctorLogin.href} className="text-gray-600 hover:text-teal-700 text-sm font-medium px-3 py-2 transition-colors">{c.auth.doctorLogin.label}</Link>
          <Link href={c.auth.login.href} className="text-gray-600 hover:text-gray-900 text-sm font-medium px-3 py-2 transition-colors">{c.auth.login.label}</Link>
          <div className="w-px h-4 bg-gray-200" />
          <LanguageDropdown lang={lang} />
          <Link href={c.auth.signup.href} className="bg-teal-600 hover:bg-teal-500 text-white font-bold text-sm px-4 py-2 rounded-xl transition-all duration-200 hover:shadow-md hover:shadow-teal-500/25 hover:-translate-y-0.5">{c.auth.signup.label}</Link>
        </div>

        {/* Mobile hamburger */}
        <button className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors" aria-label="Menu" onClick={() => setMobileOpen(!mobileOpen)}>
          <div className={`w-5 h-0.5 bg-gray-700 mb-1 transition-all duration-200 ${mobileOpen ? 'rotate-45 translate-y-1.5' : ''}`} />
          <div className={`w-5 h-0.5 bg-gray-700 mb-1 transition-all duration-200 ${mobileOpen ? 'opacity-0' : ''}`} />
          <div className={`w-5 h-0.5 bg-gray-700 transition-all duration-200 ${mobileOpen ? '-rotate-45 -translate-y-1.5' : ''}`} />
        </button>
      </div>

      {/* Desktop mega menu panels */}
      {openMenu && c.menus.filter((m) => m.id === openMenu).map((menu) => (
        <div key={menu.id} onMouseEnter={() => handleEnter(menu.id)} onMouseLeave={handleLeave}>
          {renderMegaPanel(menu)}
        </div>
      ))}

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 top-16 z-40 bg-white overflow-y-auto animate-[slideDown_0.3s_ease_forwards]">
          <div className="px-4 py-4 space-y-2">
            {c.menus.map((menu) => (
              <div key={menu.id} className="border border-gray-100 rounded-2xl overflow-hidden">
                <button className="w-full flex items-center justify-between p-4 font-semibold text-gray-900" onClick={() => setMobileAccordion(mobileAccordion === menu.id ? null : menu.id)}>
                  {menu.label}
                  <Chevron open={mobileAccordion === menu.id} />
                </button>
                {mobileAccordion === menu.id && (
                  <div className="px-4 pb-4 space-y-1 border-t border-gray-50">
                    {menu.simple && menu.items ? (
                      menu.items.map((item, i) => (
                        <Link key={i} href={item.href} className="flex items-center gap-3 py-2" onClick={() => setMobileOpen(false)}>
                          <span className="text-lg">{item.icon}</span>
                          <span className="text-gray-700 text-sm">{item.label}</span>
                        </Link>
                      ))
                    ) : (
                      menu.columns?.flatMap((col) => col.items).map((item, i) => (
                        <Link key={i} href={item.href} className="flex items-center gap-3 py-2" onClick={() => setMobileOpen(false)}>
                          <span className="text-lg">{item.icon}</span>
                          <span className="text-gray-700 text-sm">{item.title}</span>
                        </Link>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))}
            {c.simpleLinks.map((link, i) => (
              <Link key={i} href={link.href} className="block p-4 font-semibold text-gray-900 border border-gray-100 rounded-2xl" onClick={() => setMobileOpen(false)}>{link.label}</Link>
            ))}
            <div className="pt-4 border-t border-gray-100 space-y-2">
              <Link href={c.auth.signup.href} className="block w-full text-center bg-teal-600 text-white font-bold py-3 rounded-xl" onClick={() => setMobileOpen(false)}>{c.auth.signup.label}</Link>
              <Link href={c.auth.login.href} className="block w-full text-center text-gray-600 font-medium py-3" onClick={() => setMobileOpen(false)}>{c.auth.login.label}</Link>
              <Link href={c.auth.doctorLogin.href} className="block w-full text-center text-teal-700 font-medium py-3" onClick={() => setMobileOpen(false)}>{c.auth.doctorLogin.label}</Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
