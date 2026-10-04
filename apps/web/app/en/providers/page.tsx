import { marketingMetadata } from '@/lib/seo';

export const metadata = marketingMetadata('en', 'providers');

import ProvidersLanding from '@/components/landing/ProvidersLanding';

export default function ProvidersEN() {
  return <ProvidersLanding lang="en" />;
}
