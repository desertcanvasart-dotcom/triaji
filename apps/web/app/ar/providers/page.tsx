import { marketingMetadata } from '@/lib/seo';

export const metadata = marketingMetadata('ar', 'providers');

import ProvidersLanding from '@/components/landing/ProvidersLanding';

export default function ProvidersAR() {
  return <ProvidersLanding lang="ar" />;
}
