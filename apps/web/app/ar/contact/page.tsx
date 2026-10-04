import { marketingMetadata } from '@/lib/seo';

export const metadata = marketingMetadata('ar', 'contact');

import ContactClient from '@/components/shared/ContactClient';

export default function ArabicContactPage() {
  return <ContactClient lang="ar" />;
}
