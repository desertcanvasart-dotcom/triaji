'use client';

import type { Lang } from '@triaji/shared/i18n';
import Link from 'next/link';
import SiteNavbar from './SiteNavbar';
import SiteFooter from './SiteFooter';

interface Section {
  title: string;
  intro?: string;
  content: string[];
  important?: boolean;
  consent?: boolean;
}

interface PolicyContent {
  title: string;
  lastUpdated: string;
  intro: string;
  sections: Section[];
}

const PRIVACY: Record<Lang, PolicyContent> = {
  ar: {
    title: '\u0633\u064A\u0627\u0633\u0629 \u0627\u0644\u062E\u0635\u0648\u0635\u064A\u0629',
    lastUpdated: '\u0622\u062E\u0631 \u062A\u062D\u062F\u064A\u062B: \u0645\u0627\u0631\u0633 2026',
    intro: '\u062A\u0631\u064A\u062C\u064A \u0645\u0644\u062A\u0632\u0645 \u0628\u062D\u0645\u0627\u064A\u0629 \u062E\u0635\u0648\u0635\u064A\u062A\u0643. \u0647\u0630\u0647 \u0627\u0644\u0635\u0641\u062D\u0629 \u0628\u062A\u0634\u0631\u062D \u0628\u0648\u0636\u0648\u062D \u0625\u064A\u0647 \u0627\u0644\u0645\u0639\u0644\u0648\u0645\u0627\u062A \u0627\u0644\u0644\u064A \u0628\u0646\u062C\u0645\u0639\u0647\u0627\u060C \u0648\u0644\u064A\u0647\u060C \u0648\u0625\u0632\u0627\u064A \u0628\u0646\u062D\u0645\u064A\u0647\u0627.',
    sections: [
      {
        title: '\u0645\u0627 \u0627\u0644\u0645\u0639\u0644\u0648\u0645\u0627\u062A \u0627\u0644\u062A\u064A \u0646\u062C\u0645\u0639\u0647\u0627\u061F',
        content: [
          '\u0631\u0642\u0645 \u0645\u0648\u0628\u0627\u064A\u0644\u0643 \u2014 \u0644\u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0648\u0625\u0631\u0633\u0627\u0644 \u0625\u0634\u0639\u0627\u0631\u0627\u062A \u0637\u0628\u064A\u0629 \u0645\u0647\u0645\u0629',
          '\u0645\u0639\u0644\u0648\u0645\u0627\u062A\u0643 \u0627\u0644\u0635\u062D\u064A\u0629 \u0627\u0644\u0644\u064A \u0628\u062A\u0642\u062F\u0645\u0647\u0627 \u2014 \u0627\u0644\u0623\u0639\u0631\u0627\u0636\u060C \u0627\u0644\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0645\u0631\u0636\u064A\u060C \u0627\u0644\u062A\u062D\u0627\u0644\u064A\u0644\u060C \u0627\u0644\u0648\u0635\u0641\u0627\u062A \u0627\u0644\u0637\u0628\u064A\u0629',
          '\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062D\u062C\u0648\u0632\u0627\u062A \u2014 \u0627\u0644\u0645\u0648\u0627\u0639\u064A\u062F \u0645\u0639 \u0627\u0644\u0623\u0637\u0628\u0627\u0621 \u0648\u0627\u0644\u0645\u0639\u0627\u0645\u0644 \u0648\u0627\u0644\u0635\u064A\u062F\u0644\u064A\u0627\u062A',
          '\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0627\u0633\u062A\u062E\u062F\u0627\u0645 \u2014 \u0625\u0632\u0627\u064A \u0628\u062A\u0633\u062A\u062E\u062F\u0645 \u0627\u0644\u062A\u0637\u0628\u064A\u0642 \u0644\u062A\u062D\u0633\u064A\u0646 \u062A\u062C\u0631\u0628\u062A\u0643',
        ],
      },
      {
        title: '\u0644\u0645\u0627\u0630\u0627 \u0646\u062C\u0645\u0639 \u0647\u0630\u0647 \u0627\u0644\u0645\u0639\u0644\u0648\u0645\u0627\u062A\u061F',
        content: [
          '\u0644\u0645\u0633\u0627\u0639\u062F\u062A\u0643 \u0639\u0644\u0649 \u0627\u0644\u0648\u0635\u0648\u0644 \u0644\u0644\u0637\u0628\u064A\u0628 \u0627\u0644\u0645\u0646\u0627\u0633\u0628 \u0628\u0623\u0633\u0631\u0639 \u0648\u0642\u062A',
          '\u0644\u062A\u0642\u062F\u064A\u0645 \u0641\u0631\u0632 \u0637\u0628\u064A \u062F\u0642\u064A\u0642 \u0645\u0628\u0646\u064A \u0639\u0644\u0649 \u062A\u0627\u0631\u064A\u062E\u0643 \u0627\u0644\u0635\u062D\u064A \u0627\u0644\u0643\u0627\u0645\u0644',
          '\u0644\u062A\u0633\u0647\u064A\u0644 \u0627\u0644\u062A\u0648\u0627\u0635\u0644 \u0645\u0639 \u0627\u0644\u0623\u0637\u0628\u0627\u0621 \u0648\u0627\u0644\u0645\u0639\u0627\u0645\u0644 \u0648\u0627\u0644\u0635\u064A\u062F\u0644\u064A\u0627\u062A \u0648\u0627\u0644\u062A\u0623\u0645\u064A\u0646 \u0628\u0625\u0630\u0646\u0643',
          '\u0644\u062A\u0630\u0643\u064A\u0631\u0643 \u0628\u0645\u0648\u0627\u0639\u064A\u062F \u0627\u0644\u0645\u062A\u0627\u0628\u0639\u0629 \u0648\u0627\u0644\u062A\u062D\u0627\u0644\u064A\u0644 \u0627\u0644\u062F\u0648\u0631\u064A\u0629',
        ],
      },
      {
        title: '\u0645\u0639 \u0645\u0646 \u0646\u0634\u0627\u0631\u0643 \u0645\u0639\u0644\u0648\u0645\u0627\u062A\u0643\u061F',
        intro: '\u0645\u0639\u0644\u0648\u0645\u0627\u062A\u0643 \u0627\u0644\u0635\u062D\u064A\u0629 \u0645\u0644\u0643\u0643 \u2014 \u0645\u0627 \u0628\u0646\u0634\u0627\u0631\u0643\u0647\u0627\u0634 \u0625\u0644\u0627 \u0628\u0625\u0630\u0646\u0643 \u0627\u0644\u0635\u0631\u064A\u062D \u0645\u0639:',
        content: [
          '\u0627\u0644\u0623\u0637\u0628\u0627\u0621 \u0627\u0644\u0630\u064A\u0646 \u062A\u062D\u062C\u0632 \u0645\u0639\u0647\u0645 \u0645\u0648\u0627\u0639\u064A\u062F \u2014 \u0639\u0634\u0627\u0646 \u064A\u0642\u062F\u0631\u0648\u0627 \u064A\u062E\u062F\u0645\u0648\u0643 \u0623\u062D\u0633\u0646',
          '\u0627\u0644\u0645\u0639\u0627\u0645\u0644 \u0627\u0644\u062A\u064A \u062A\u0637\u0644\u0628 \u062A\u062D\u0627\u0644\u064A\u0644 \u0645\u0646\u0647\u0627 \u2014 \u0644\u0627\u0633\u062A\u0644\u0627\u0645 \u0627\u0644\u0637\u0644\u0628 \u0648\u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u0646\u062A\u0627\u064A\u062C',
          '\u0627\u0644\u0635\u064A\u062F\u0644\u064A\u0627\u062A \u0627\u0644\u062A\u064A \u062A\u062E\u062A\u0627\u0631\u0647\u0627 \u2014 \u0644\u062A\u062C\u0647\u064A\u0632 \u0648\u0635\u0641\u062A\u0643 \u0627\u0644\u0637\u0628\u064A\u0629',
          '\u0634\u0631\u0643\u0627\u062A \u0627\u0644\u062A\u0623\u0645\u064A\u0646 \u0627\u0644\u062E\u0627\u0635\u0629 \u0628\u0643 \u2014 \u0644\u0645\u0639\u0627\u0644\u062C\u0629 \u0627\u0644\u0645\u0637\u0627\u0644\u0628\u0627\u062A \u0628\u0625\u0630\u0646\u0643',
          '\u0644\u0627 \u0646\u0628\u064A\u0639 \u0628\u064A\u0627\u0646\u0627\u062A\u0643 \u0644\u0623\u064A \u0637\u0631\u0641 \u062B\u0627\u0644\u062B \u2014 \u0623\u0628\u062F\u0627\u064B',
        ],
      },
      {
        title: '\u0643\u064A\u0641 \u0646\u062D\u0645\u064A \u0645\u0639\u0644\u0648\u0645\u0627\u062A\u0643\u061F',
        content: [
          '\u062A\u0634\u0641\u064A\u0631 \u0643\u0627\u0645\u0644 \u0644\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0623\u062B\u0646\u0627\u0621 \u0627\u0644\u0646\u0642\u0644 \u0648\u0627\u0644\u062A\u062E\u0632\u064A\u0646 (AES-256)',
          '\u0633\u064A\u0627\u0633\u0629 \u0623\u0645\u0627\u0646 \u0635\u0627\u0631\u0645\u0629 \u0639\u0644\u0649 \u0645\u0633\u062A\u0648\u0649 \u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A (Row Level Security)',
          '\u0627\u0644\u062A\u062D\u0642\u0642 \u0627\u0644\u062B\u0646\u0627\u0626\u064A \u0644\u0643\u0644 \u0639\u0645\u0644\u064A\u0627\u062A \u0627\u0644\u062F\u062E\u0648\u0644',
          '\u0645\u0631\u0627\u062C\u0639\u0627\u062A \u0623\u0645\u0646\u064A\u0629 \u062F\u0648\u0631\u064A\u0629 \u0645\u0646 \u062C\u0647\u0627\u062A \u062E\u0627\u0631\u062C\u064A\u0629 \u0645\u0633\u062A\u0642\u0644\u0629',
          '\u0644\u0627 \u064A\u0645\u0643\u0646 \u0644\u0623\u064A \u0645\u0648\u0638\u0641 \u0641\u064A \u062A\u0631\u064A\u062C\u064A \u0627\u0644\u0627\u0637\u0644\u0627\u0639 \u0639\u0644\u0649 \u0628\u064A\u0627\u0646\u0627\u062A\u0643 \u0627\u0644\u0635\u062D\u064A\u0629',
        ],
      },
      {
        title: '\u0645\u0627 \u0647\u064A \u062D\u0642\u0648\u0642\u0643\u061F',
        content: [
          '\u0627\u0644\u062D\u0642 \u0641\u064A \u0627\u0644\u0627\u0637\u0644\u0627\u0639 \u0639\u0644\u0649 \u062C\u0645\u064A\u0639 \u0628\u064A\u0627\u0646\u0627\u062A\u0643 \u0641\u064A \u0623\u064A \u0648\u0642\u062A',
          '\u0627\u0644\u062D\u0642 \u0641\u064A \u062A\u0639\u062F\u064A\u0644 \u0623\u0648 \u062A\u0635\u062D\u064A\u062D \u0623\u064A \u0645\u0639\u0644\u0648\u0645\u0629',
          '\u0627\u0644\u062D\u0642 \u0641\u064A \u062D\u0630\u0641 \u062D\u0633\u0627\u0628\u0643 \u0648\u062C\u0645\u064A\u0639 \u0628\u064A\u0627\u0646\u0627\u062A\u0643 \u0646\u0647\u0627\u0626\u064A\u0627\u064B',
          '\u0627\u0644\u062D\u0642 \u0641\u064A \u0633\u062D\u0628 \u0645\u0648\u0627\u0641\u0642\u062A\u0643 \u0639\u0644\u0649 \u0645\u0634\u0627\u0631\u0643\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0641\u064A \u0623\u064A \u0648\u0642\u062A',
          '\u0627\u0644\u062D\u0642 \u0641\u064A \u0627\u0644\u062D\u0635\u0648\u0644 \u0639\u0644\u0649 \u0646\u0633\u062E\u0629 \u0645\u0646 \u0628\u064A\u0627\u0646\u0627\u062A\u0643 \u0628\u0635\u064A\u063A\u0629 \u0642\u0627\u0628\u0644\u0629 \u0644\u0644\u0642\u0631\u0627\u0621\u0629',
        ],
      },
      {
        title: '\u0645\u0644\u0627\u062D\u0638\u0629 \u0645\u0647\u0645\u0629 \u062C\u062F\u0627\u064B',
        important: true,
        content: [
          '\u062A\u0631\u064A\u062C\u064A \u0645\u0646\u0635\u0629 \u062A\u0646\u0638\u064A\u0645\u064A\u0629 \u0648\u0644\u064A\u0633\u062A \u0645\u0646\u0635\u0629 \u0637\u0628\u064A\u0629.',
          '\u0644\u0627 \u0646\u0642\u062F\u0645 \u062A\u0634\u062E\u064A\u0635\u0627\u062A \u0637\u0628\u064A\u0629 \u0648\u0644\u0627 \u0646\u0635\u0641 \u0623\u062F\u0648\u064A\u0629.',
          '\u062C\u0645\u064A\u0639 \u0627\u0644\u0642\u0631\u0627\u0631\u0627\u062A \u0627\u0644\u0637\u0628\u064A\u0629 \u062A\u0638\u0644 \u062D\u0635\u0631\u0627\u064B \u0641\u064A \u064A\u062F \u0627\u0644\u0637\u0628\u064A\u0628 \u0627\u0644\u0645\u0631\u062E\u0635.',
          '\u0641\u064A \u062D\u0627\u0644\u0627\u062A \u0627\u0644\u0637\u0648\u0627\u0631\u0626\u060C \u0627\u062A\u0635\u0644 \u0628\u0627\u0644\u0625\u0633\u0639\u0627\u0641: 123',
        ],
      },
      {
        title: '\u0627\u0644\u062A\u0648\u0627\u0635\u0644 \u0645\u0639\u0646\u0627',
        content: [
          '\u0644\u0623\u064A \u0627\u0633\u062A\u0641\u0633\u0627\u0631 \u0639\u0646 \u062E\u0635\u0648\u0635\u064A\u062A\u0643: privacy@triajji.com',
          '\u0644\u0644\u0634\u0643\u0627\u0648\u0649 \u0623\u0648 \u0627\u0644\u0637\u0644\u0628\u0627\u062A: support@triajji.com',
        ],
      },
    ],
  },
  en: {
    title: 'Privacy Policy',
    lastUpdated: 'Last updated: March 2026',
    intro: 'Triajji is committed to protecting your privacy. This page clearly explains what information we collect, why, and how we protect it.',
    sections: [
      {
        title: 'What information do we collect?',
        content: [
          'Your mobile number \u2014 to log in and send important medical notifications',
          'Your health information that you provide \u2014 symptoms, medical history, lab results, prescriptions',
          'Booking data \u2014 appointments with doctors, labs, and pharmacies',
          'Usage data \u2014 how you use the app to improve your experience',
        ],
      },
      {
        title: 'Why do we collect this information?',
        content: [
          'To help you reach the right doctor as quickly as possible',
          'To provide accurate medical triage based on your complete health history',
          'To facilitate communication with doctors, labs, pharmacies, and insurance with your permission',
          'To remind you of follow-up appointments and regular tests',
        ],
      },
      {
        title: 'Who do we share your information with?',
        intro: 'Your health information belongs to you \u2014 we only share it with your explicit consent with:',
        content: [
          'Doctors you book appointments with \u2014 so they can serve you better',
          'Labs you request tests from \u2014 to receive the order and send results',
          'Pharmacies you choose \u2014 to prepare your prescription',
          'Your insurance companies \u2014 to process claims with your permission',
          'We never sell your data to any third party \u2014 ever',
        ],
      },
      {
        title: 'How do we protect your information?',
        content: [
          'Full data encryption in transit and at rest (AES-256)',
          'Strict database-level security policy (Row Level Security)',
          'Two-factor verification for all access operations',
          'Regular security audits by independent external parties',
          'No Triajji employee can access your health data',
        ],
      },
      {
        title: 'What are your rights?',
        content: [
          'The right to access all your data at any time',
          'The right to modify or correct any information',
          'The right to permanently delete your account and all data',
          'The right to withdraw your consent to data sharing at any time',
          'The right to receive a copy of your data in a readable format',
        ],
      },
      {
        title: 'Very important notice',
        important: true,
        content: [
          'Triajji is an organisational platform, not a medical platform.',
          'We do not provide medical diagnoses or prescribe medications.',
          'All medical decisions remain exclusively with the licensed physician.',
          'In emergencies, call an ambulance: 123',
        ],
      },
      {
        title: 'Contact us',
        content: [
          'For privacy enquiries: privacy@triajji.com',
          'For complaints or requests: support@triajji.com',
        ],
      },
    ],
  },
};

const TERMS: Record<Lang, PolicyContent> = {
  ar: {
    title: '\u0634\u0631\u0648\u0637 \u0627\u0644\u0627\u0633\u062A\u062E\u062F\u0627\u0645',
    lastUpdated: '\u0622\u062E\u0631 \u062A\u062D\u062F\u064A\u062B: \u0645\u0627\u0631\u0633 2026',
    intro: '\u0628\u0627\u0633\u062A\u062E\u062F\u0627\u0645\u0643 \u0644\u062A\u0631\u064A\u062C\u064A\u060C \u0623\u0646\u062A \u062A\u0648\u0627\u0641\u0642 \u0639\u0644\u0649 \u0647\u0630\u0647 \u0627\u0644\u0634\u0631\u0648\u0637. \u0628\u0631\u062C\u0627\u0621 \u0642\u0631\u0627\u0621\u062A\u0647\u0627 \u0628\u0639\u0646\u0627\u064A\u0629.',
    sections: [
      {
        title: '1. \u0637\u0628\u064A\u0639\u0629 \u0627\u0644\u062E\u062F\u0645\u0629 \u2014 \u0627\u0644\u0623\u0647\u0645 \u0639\u0644\u0649 \u0627\u0644\u0625\u0637\u0644\u0627\u0642',
        important: true,
        content: [
          '\u062A\u0631\u064A\u062C\u064A \u0645\u0646\u0635\u0629 \u062A\u0646\u0638\u064A\u0645\u064A\u0629 \u062A\u0633\u0627\u0639\u062F \u0627\u0644\u0645\u0631\u0636\u0649 \u0639\u0644\u0649 \u0627\u0644\u0648\u0635\u0648\u0644 \u0644\u0644\u0631\u0639\u0627\u064A\u0629 \u0627\u0644\u0635\u062D\u064A\u0629 \u2014 \u0648\u0644\u064A\u0633\u062A \u0645\u0646\u0635\u0629 \u0637\u0628\u064A\u0629.',
          '\u062A\u0631\u064A\u062C\u064A \u0644\u0627 \u064A\u0642\u062F\u0645 \u0623\u064A \u062A\u0634\u062E\u064A\u0635\u0627\u062A \u0637\u0628\u064A\u0629 \u0648\u0644\u0627 \u064A\u0635\u0641 \u0623\u062F\u0648\u064A\u0629 \u0648\u0644\u0627 \u064A\u0642\u062F\u0645 \u0622\u0631\u0627\u0621 \u0637\u0628\u064A\u0629.',
          '\u0627\u0644\u0641\u0631\u0632 \u0627\u0644\u0637\u0628\u064A \u0627\u0644\u0645\u0642\u062F\u0645 \u0645\u0646 \u062A\u0631\u064A\u062C\u064A \u0647\u0648 \u062A\u0648\u062C\u064A\u0647 \u0639\u0627\u0645 \u0648\u0644\u064A\u0633 \u062A\u0634\u062E\u064A\u0635\u0627\u064B.',
          '\u0627\u0644\u0642\u0631\u0627\u0631 \u0627\u0644\u0637\u0628\u064A \u0627\u0644\u0646\u0647\u0627\u0626\u064A \u064A\u0638\u0644 \u062F\u0627\u0626\u0645\u0627\u064B \u0648\u0623\u0628\u062F\u0627\u064B \u0641\u064A \u064A\u062F \u0627\u0644\u0637\u0628\u064A\u0628 \u0627\u0644\u0645\u0631\u062E\u0635 \u0641\u0642\u0637.',
          '\u0641\u064A \u062D\u0627\u0644\u0627\u062A \u0627\u0644\u0637\u0648\u0627\u0631\u0626 \u0627\u0644\u0637\u0628\u064A\u0629\u060C \u064A\u062C\u0628 \u0627\u0644\u0627\u062A\u0635\u0627\u0644 \u0628\u0627\u0644\u0625\u0633\u0639\u0627\u0641 (123) \u0641\u0648\u0631\u0627\u064B \u0648\u0639\u062F\u0645 \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631.',
          '\u062A\u0631\u064A\u062C\u064A \u063A\u064A\u0631 \u0645\u0633\u0624\u0648\u0644 \u0639\u0646 \u0623\u064A \u0642\u0631\u0627\u0631 \u0637\u0628\u064A \u064A\u062A\u062E\u0630\u0647 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0628\u0646\u0627\u0621\u064B \u0639\u0644\u0649 \u0645\u0639\u0644\u0648\u0645\u0627\u062A \u0627\u0644\u0645\u0646\u0635\u0629.',
        ],
      },
      {
        title: '2. \u0645\u0648\u0627\u0641\u0642\u0629 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0639\u0644\u0649 \u0645\u0634\u0627\u0631\u0643\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A',
        consent: true,
        content: [
          '\u0628\u0627\u0644\u062A\u0633\u062C\u064A\u0644 \u0641\u064A \u062A\u0631\u064A\u062C\u064A\u060C \u0623\u0646\u062A \u062A\u0648\u0627\u0641\u0642 \u0635\u0631\u0627\u062D\u0629\u064B \u0639\u0644\u0649 \u0623\u0646 \u062A\u0631\u064A\u062C\u064A \u064A\u062D\u062A\u0641\u0638 \u0628\u0645\u0639\u0644\u0648\u0645\u0627\u062A\u0643 \u0627\u0644\u0635\u062D\u064A\u0629.',
          '\u062A\u0648\u0627\u0641\u0642 \u0639\u0644\u0649 \u0645\u0634\u0627\u0631\u0643\u0629 \u0645\u0639\u0644\u0648\u0645\u0627\u062A\u0643 \u0645\u0639 \u0627\u0644\u0623\u0637\u0628\u0627\u0621 \u0627\u0644\u0630\u064A\u0646 \u062A\u062D\u062C\u0632 \u0645\u0639\u0647\u0645 \u0644\u0623\u063A\u0631\u0627\u0636 \u0627\u0644\u0639\u0644\u0627\u062C.',
          '\u062A\u0648\u0627\u0641\u0642 \u0639\u0644\u0649 \u0645\u0634\u0627\u0631\u0643\u0629 \u0645\u0639\u0644\u0648\u0645\u0627\u062A\u0643 \u0645\u0639 \u0627\u0644\u0645\u0639\u0627\u0645\u0644 \u0627\u0644\u062A\u064A \u062A\u0637\u0644\u0628 \u062A\u062D\u0627\u0644\u064A\u0644 \u0645\u0646\u0647\u0627.',
          '\u062A\u0648\u0627\u0641\u0642 \u0639\u0644\u0649 \u0645\u0634\u0627\u0631\u0643\u0629 \u0645\u0639\u0644\u0648\u0645\u0627\u062A\u0643 \u0645\u0639 \u0627\u0644\u0635\u064A\u062F\u0644\u064A\u0627\u062A \u0627\u0644\u062A\u064A \u062A\u062E\u062A\u0627\u0631 \u0625\u0631\u0633\u0627\u0644 \u0648\u0635\u0641\u062A\u0643 \u0625\u0644\u064A\u0647\u0627.',
          '\u062A\u0648\u0627\u0641\u0642 \u0639\u0644\u0649 \u0645\u0634\u0627\u0631\u0643\u0629 \u0645\u0639\u0644\u0648\u0645\u0627\u062A\u0643 \u0645\u0639 \u0634\u0631\u0643\u0627\u062A \u0627\u0644\u062A\u0623\u0645\u064A\u0646 \u0627\u0644\u0645\u0631\u062A\u0628\u0637\u0629 \u0628\u0643 \u0644\u0645\u0639\u0627\u0644\u062C\u0629 \u0627\u0644\u0645\u0637\u0627\u0644\u0628\u0627\u062A.',
          '\u064A\u0645\u0643\u0646\u0643 \u0633\u062D\u0628 \u0647\u0630\u0647 \u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0629 \u0641\u064A \u0623\u064A \u0648\u0642\u062A \u0645\u0646 \u0625\u0639\u062F\u0627\u062F\u0627\u062A \u062D\u0633\u0627\u0628\u0643.',
        ],
      },
      {
        title: '3. \u0645\u0633\u0624\u0648\u0644\u064A\u0627\u062A \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645',
        content: [
          '\u062A\u0642\u062F\u064A\u0645 \u0645\u0639\u0644\u0648\u0645\u0627\u062A \u0635\u062D\u064A\u062D\u0629 \u0648\u062F\u0642\u064A\u0642\u0629 \u0639\u0646 \u062D\u0627\u0644\u062A\u0643 \u0627\u0644\u0635\u062D\u064A\u0629.',
          '\u0639\u062F\u0645 \u0627\u0633\u062A\u062E\u062F\u0627\u0645 \u0627\u0644\u0645\u0646\u0635\u0629 \u0641\u064A \u062D\u0627\u0644\u0627\u062A \u0627\u0644\u0637\u0648\u0627\u0631\u0626 \u0627\u0644\u0641\u0648\u0631\u064A\u0629 \u2014 \u0627\u062A\u0635\u0644 \u0628\u0627\u0644\u0625\u0633\u0639\u0627\u0641 \u0641\u0648\u0631\u0627\u064B.',
          '\u0627\u0644\u062A\u0634\u0627\u0648\u0631 \u0645\u0639 \u0637\u0628\u064A\u0628 \u0645\u0631\u062E\u0635 \u0642\u0628\u0644 \u0627\u062A\u062E\u0627\u0630 \u0623\u064A \u0642\u0631\u0627\u0631 \u0637\u0628\u064A.',
          '\u0627\u0644\u0645\u062D\u0627\u0641\u0638\u0629 \u0639\u0644\u0649 \u0633\u0631\u064A\u0629 \u0628\u064A\u0627\u0646\u0627\u062A \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0627\u0644\u062E\u0627\u0635\u0629 \u0628\u0643.',
          '\u0639\u062F\u0645 \u0645\u0634\u0627\u0631\u0643\u0629 \u062D\u0633\u0627\u0628\u0643 \u0645\u0639 \u0623\u0634\u062E\u0627\u0635 \u0622\u062E\u0631\u064A\u0646.',
          '\u0625\u0628\u0644\u0627\u063A \u062A\u0631\u064A\u062C\u064A \u0641\u0648\u0631\u0627\u064B \u0639\u0646\u062F \u0627\u0643\u062A\u0634\u0627\u0641 \u0623\u064A \u0627\u0633\u062A\u062E\u062F\u0627\u0645 \u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0628\u0647 \u0644\u062D\u0633\u0627\u0628\u0643.',
        ],
      },
      {
        title: '4. \u062D\u062F\u0648\u062F \u0627\u0644\u0645\u0633\u0624\u0648\u0644\u064A\u0629',
        content: [
          '\u062A\u0631\u064A\u062C\u064A \u0644\u064A\u0633 \u0645\u0633\u0624\u0648\u0644\u0627\u064B \u0639\u0646 \u0623\u064A \u0636\u0631\u0631 \u064A\u0646\u062A\u062C \u0639\u0646 \u0627\u0644\u0627\u0639\u062A\u0645\u0627\u062F \u0639\u0644\u0649 \u0627\u0644\u0645\u0639\u0644\u0648\u0645\u0627\u062A \u0643\u062A\u0634\u062E\u064A\u0635 \u0637\u0628\u064A.',
          '\u062A\u0631\u064A\u062C\u064A \u0644\u064A\u0633 \u0645\u0633\u0624\u0648\u0644\u0627\u064B \u0639\u0646 \u062C\u0648\u062F\u0629 \u0627\u0644\u062E\u062F\u0645\u0629 \u0627\u0644\u0637\u0628\u064A\u0629 \u0627\u0644\u0645\u0642\u062F\u0645\u0629 \u0645\u0646 \u0627\u0644\u0623\u0637\u0628\u0627\u0621 \u0623\u0648 \u0627\u0644\u0645\u0639\u0627\u0645\u0644 \u0623\u0648 \u0627\u0644\u0635\u064A\u062F\u0644\u064A\u0627\u062A.',
          '\u062A\u0631\u064A\u062C\u064A \u064A\u0639\u0645\u0644 \u0643\u0648\u0633\u064A\u0637 \u062A\u0646\u0638\u064A\u0645\u064A \u0641\u0642\u0637 \u0628\u064A\u0646 \u0627\u0644\u0645\u0631\u064A\u0636 \u0648\u0645\u0632\u0648\u062F\u064A \u0627\u0644\u062E\u062F\u0645\u0629.',
          '\u0641\u064A \u062D\u0627\u0644\u0627\u062A \u0627\u0646\u0642\u0637\u0627\u0639 \u0627\u0644\u062E\u062F\u0645\u0629\u060C \u0628\u0631\u062C\u0627\u0621 \u0627\u0644\u062A\u0648\u0627\u0635\u0644 \u0645\u0628\u0627\u0634\u0631\u0629 \u0645\u0639 \u0645\u0632\u0648\u062F \u0627\u0644\u062E\u062F\u0645\u0629 \u0627\u0644\u0635\u062D\u064A\u0629.',
        ],
      },
      {
        title: '5. \u0627\u0644\u0645\u0644\u0643\u064A\u0629 \u0627\u0644\u0641\u0643\u0631\u064A\u0629',
        content: [
          '\u062C\u0645\u064A\u0639 \u0645\u062D\u062A\u0648\u064A\u0627\u062A \u062A\u0631\u064A\u062C\u064A \u2014 \u0627\u0644\u0646\u0635\u0648\u0635 \u0648\u0627\u0644\u0635\u0648\u0631 \u0648\u0627\u0644\u0643\u0648\u062F \u0648\u0627\u0644\u062A\u0635\u0645\u064A\u0645 \u2014 \u0645\u062D\u0645\u064A\u0629 \u0628\u062D\u0642\u0648\u0642 \u0627\u0644\u0645\u0644\u0643\u064A\u0629 \u0627\u0644\u0641\u0643\u0631\u064A\u0629.',
          '\u064A\u064F\u0645\u0646\u0639 \u0646\u0633\u062E \u0623\u0648 \u062A\u0648\u0632\u064A\u0639 \u0623\u064A \u0645\u062D\u062A\u0648\u0649 \u0628\u062F\u0648\u0646 \u0625\u0630\u0646 \u0643\u062A\u0627\u0628\u064A \u0645\u0633\u0628\u0642 \u0645\u0646 \u062A\u0631\u064A\u062C\u064A.',
        ],
      },
      {
        title: '6. \u062A\u0639\u062F\u064A\u0644 \u0627\u0644\u0634\u0631\u0648\u0637',
        content: [
          '\u062A\u0631\u064A\u062C\u064A \u064A\u062D\u0642 \u0644\u0647 \u062A\u0639\u062F\u064A\u0644 \u0647\u0630\u0647 \u0627\u0644\u0634\u0631\u0648\u0637 \u0641\u064A \u0623\u064A \u0648\u0642\u062A.',
          '\u0633\u064A\u062A\u0645 \u0625\u0634\u0639\u0627\u0631\u0643 \u0628\u0623\u064A \u062A\u0639\u062F\u064A\u0644\u0627\u062A \u062C\u0648\u0647\u0631\u064A\u0629 \u0639\u0628\u0631 \u0631\u0642\u0645 \u0645\u0648\u0628\u0627\u064A\u0644\u0643 \u0627\u0644\u0645\u0633\u062C\u0651\u0644.',
          '\u0627\u0633\u062A\u0645\u0631\u0627\u0631\u0643 \u0641\u064A \u0627\u0633\u062A\u062E\u062F\u0627\u0645 \u0627\u0644\u0645\u0646\u0635\u0629 \u0628\u0639\u062F \u0627\u0644\u062A\u0639\u062F\u064A\u0644 \u064A\u0639\u0646\u064A \u0645\u0648\u0627\u0641\u0642\u062A\u0643 \u0639\u0644\u0649 \u0627\u0644\u0634\u0631\u0648\u0637 \u0627\u0644\u062C\u062F\u064A\u062F\u0629.',
        ],
      },
      {
        title: '7. \u0627\u0644\u0642\u0627\u0646\u0648\u0646 \u0627\u0644\u0645\u0637\u0628\u0651\u0642',
        content: [
          '\u062A\u062E\u0636\u0639 \u0647\u0630\u0647 \u0627\u0644\u0634\u0631\u0648\u0637 \u0644\u0642\u0648\u0627\u0646\u064A\u0646 \u062C\u0645\u0647\u0648\u0631\u064A\u0629 \u0645\u0635\u0631 \u0627\u0644\u0639\u0631\u0628\u064A\u0629.',
          '\u0623\u064A \u0646\u0632\u0627\u0639 \u064A\u064F\u062D\u0633\u0645 \u0623\u0645\u0627\u0645 \u0627\u0644\u0645\u062D\u0627\u0643\u0645 \u0627\u0644\u0645\u0635\u0631\u064A\u0629 \u0627\u0644\u0645\u062E\u062A\u0635\u0629.',
        ],
      },
    ],
  },
  en: {
    title: 'Terms of Use',
    lastUpdated: 'Last updated: March 2026',
    intro: 'By using Triajji, you agree to these terms. Please read them carefully.',
    sections: [
      {
        title: '1. Nature of the Service \u2014 Most Important',
        important: true,
        content: [
          'Triajji is an organisational platform that helps patients access healthcare \u2014 it is not a medical platform.',
          'Triajji does not provide medical diagnoses, prescribe medications, or offer medical opinions.',
          'The medical triage provided by Triajji is general guidance, not a diagnosis.',
          'The final medical decision always and exclusively rests with the licensed physician.',
          'In medical emergencies, call an ambulance (123) immediately \u2014 do not wait.',
          'Triajji is not responsible for any medical decision made by the user based on platform information.',
        ],
      },
      {
        title: '2. User consent to data sharing',
        consent: true,
        content: [
          'By registering with Triajji, you explicitly agree that Triajji may retain your health information.',
          'You agree to share your information with doctors you book appointments with for treatment purposes.',
          'You agree to share your information with labs you request tests from.',
          'You agree to share your information with pharmacies you choose to send your prescription to.',
          'You agree to share your information with your insurance companies to process claims.',
          'You can withdraw this consent at any time from your account settings.',
        ],
      },
      {
        title: '3. User responsibilities',
        content: [
          'Provide correct and accurate information about your health condition.',
          'Do not use the platform in immediate emergencies \u2014 call an ambulance immediately.',
          'Consult a licensed doctor before making any medical decision.',
          'Keep your login credentials confidential.',
          'Do not share your account with other people.',
          'Notify Triajji immediately upon discovering any unauthorised use of your account.',
        ],
      },
      {
        title: '4. Limitation of liability',
        content: [
          'Triajji is not responsible for any harm resulting from relying on platform information as a medical diagnosis.',
          'Triajji is not responsible for the quality of medical service provided by doctors, labs, or pharmacies.',
          'Triajji operates solely as an organisational intermediary between the patient and service providers.',
          'In case of service interruption, please contact your healthcare provider directly.',
        ],
      },
      {
        title: '5. Intellectual property',
        content: [
          'All Triajji content \u2014 text, images, code, and design \u2014 is protected by intellectual property rights.',
          'Copying or distributing any content without prior written permission from Triajji is prohibited.',
        ],
      },
      {
        title: '6. Amendment of terms',
        content: [
          'Triajji reserves the right to amend these terms at any time.',
          'You will be notified of any material amendments via your registered mobile number.',
          'Continued use of the platform after amendment implies your acceptance of the new terms.',
        ],
      },
      {
        title: '7. Applicable law',
        content: [
          'These terms are governed by the laws of the Arab Republic of Egypt.',
          'Any disputes shall be resolved before the competent Egyptian courts.',
        ],
      },
    ],
  },
};

const LABELS = {
  ar: {
    home: '\u0627\u0644\u0631\u0626\u064A\u0633\u064A\u0629',
    privacy: '\u0633\u064A\u0627\u0633\u0629 \u0627\u0644\u062E\u0635\u0648\u0635\u064A\u0629',
    terms: '\u0634\u0631\u0648\u0637 \u0627\u0644\u0627\u0633\u062A\u062E\u062F\u0627\u0645',
    langToggle: 'English',
    langPath: 'en',
    emergencyDisclaimer:
      '\u062A\u0631\u064A\u062C\u064A \u0645\u0646\u0635\u0629 \u062A\u0646\u0638\u064A\u0645\u064A\u0629 \u0648\u0644\u064A\u0633\u062A \u0645\u0646\u0635\u0629 \u0637\u0628\u064A\u0629. \u0641\u064A \u062D\u0627\u0644\u0627\u062A \u0627\u0644\u0637\u0648\u0627\u0631\u0626 \u0627\u062A\u0635\u0644 \u0628\u0627\u0644\u0625\u0633\u0639\u0627\u0641: 123',
    copyright: '\u062C\u0645\u064A\u0639 \u0627\u0644\u062D\u0642\u0648\u0642 \u0645\u062D\u0641\u0648\u0638\u0629 \u00A9 2026 \u062A\u0631\u064A\u062C\u064A',
  },
  en: {
    home: 'Home',
    privacy: 'Privacy Policy',
    terms: 'Terms of Use',
    langToggle: '\u0639\u0631\u0628\u064A',
    langPath: 'ar',
    emergencyDisclaimer:
      'Triajji is an organisational platform, not a medical platform. In emergencies call an ambulance: 123',
    copyright: 'All rights reserved \u00A9 2026 Triajji',
  },
};

interface StaticPolicyClientProps {
  lang: Lang;
  page: 'privacy' | 'terms';
}

export default function StaticPolicyClient({ lang, page }: StaticPolicyClientProps) {
  const isRtl = lang === 'ar';
  const labels = LABELS[lang];
  const content = page === 'privacy' ? PRIVACY[lang] : TERMS[lang];
  const otherLang = lang === 'ar' ? 'en' : 'ar';

  return (
    <main
      dir={isRtl ? 'rtl' : 'ltr'}
      className="min-h-screen bg-gray-50"
      style={{ fontFamily: "'Cairo', sans-serif" }}
    >
      <SiteNavbar lang={lang} />

      {/* Hero */}
      <section className="bg-gradient-to-b from-[#0D7A7A] to-[#096363] text-white py-12">
        <div className="max-w-3xl mx-auto px-4">
          <h1 className="text-3xl font-bold mb-2">{content.title}</h1>
          <p className="text-teal-200 text-sm mb-4">{content.lastUpdated}</p>
          <p className="text-lg leading-relaxed opacity-90">{content.intro}</p>
        </div>
      </section>

      {/* Sections */}
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {content.sections.map((section, idx) => {
          const isImportant = section.important === true;
          const isConsent = 'consent' in section && section.consent === true;

          let sectionClass = 'bg-white rounded-xl p-6 shadow-sm';
          if (isImportant) {
            sectionClass = `bg-amber-50 rounded-xl p-6 shadow-sm ${
              isRtl ? 'border-r-4 border-amber-400' : 'border-l-4 border-amber-400'
            }`;
          } else if (isConsent) {
            sectionClass = `bg-teal-50 rounded-xl p-6 shadow-sm ${
              isRtl ? 'border-r-4 border-teal-500' : 'border-l-4 border-teal-500'
            }`;
          }

          return (
            <div key={idx} className={sectionClass}>
              <h2
                className={`text-xl font-bold text-[#1A2F4A] mb-4 ${
                  !isImportant && !isConsent ? 'border-b border-gray-200 pb-3' : ''
                }`}
              >
                {section.title}
              </h2>

              {section.intro && (
                <p className="text-gray-600 mb-3 leading-relaxed">{section.intro}</p>
              )}

              <ul className="space-y-2">
                {section.content.map((item, itemIdx) => (
                  <li key={itemIdx} className="flex gap-2 items-start">
                    <span className="text-[#0D7A7A] mt-1 flex-shrink-0">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M13.3 4.3L6 11.6L2.7 8.3L3.3 7.7L6 10.4L12.7 3.7L13.3 4.3Z"
                          fill="currentColor"
                        />
                      </svg>
                    </span>
                    <span className="text-gray-700 leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <SiteFooter lang={lang} />
    </main>
  );
}
