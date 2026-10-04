import { marketingMetadata } from '@/lib/seo';

export const metadata = marketingMetadata('ar', 'privacy');

import StaticPolicyClient from '@/components/shared/StaticPolicyClient';

export default function ArabicPrivacyPage() {
  return <StaticPolicyClient lang="ar" page="privacy" />;
}
