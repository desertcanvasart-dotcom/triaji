import SetDocumentLocale from '@/components/i18n/SetDocumentLocale';

export default function ArabicLayout({ children }: { children: React.ReactNode }) {
  return <><SetDocumentLocale lang="ar" dir="rtl" />{children}</>;
}
