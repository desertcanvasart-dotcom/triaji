import type { Metadata } from 'next';
import SetDocumentLocale from '@/components/i18n/SetDocumentLocale';

export const metadata: Metadata = {
  title: 'Triaji — The right doctor, in the right place',
  description:
    'AI-powered medical triage & booking for Egypt — the right doctor, in the right place',
};

export default function EnglishLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SetDocumentLocale lang="en" dir="ltr" />
      {children}
    </>
  );
}
