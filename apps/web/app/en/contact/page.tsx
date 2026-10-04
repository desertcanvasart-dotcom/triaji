import { marketingMetadata } from '@/lib/seo';

export const metadata = marketingMetadata('en', 'contact');

import ContactClient from '@/components/shared/ContactClient';

export default function EnglishContactPage() {
  return <ContactClient lang="en" />;
}
