import { marketingMetadata } from '@/lib/seo';

export const metadata = marketingMetadata('en', 'terms');

import StaticPolicyClient from '@/components/shared/StaticPolicyClient';

export default function EnglishTermsPage() {
  return <StaticPolicyClient lang="en" page="terms" />;
}
