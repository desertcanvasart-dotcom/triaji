import { marketingMetadata } from '@/lib/seo';

export const metadata = marketingMetadata('ar', 'terms');

import StaticPolicyClient from '@/components/shared/StaticPolicyClient';

export default function ArabicTermsPage() {
  return <StaticPolicyClient lang="ar" page="terms" />;
}
