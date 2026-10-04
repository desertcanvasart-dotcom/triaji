import { marketingMetadata } from '@/lib/seo';

export const metadata = marketingMetadata('en', 'privacy');

import StaticPolicyClient from '@/components/shared/StaticPolicyClient';

export default function EnglishPrivacyPage() {
  return <StaticPolicyClient lang="en" page="privacy" />;
}
