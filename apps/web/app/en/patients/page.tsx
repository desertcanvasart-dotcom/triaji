import { marketingMetadata } from '@/lib/seo';

export const metadata = marketingMetadata('en', 'patients');

import PatientsLanding from '@/components/landing/PatientsLanding';

export default function PatientsEN() {
  return <PatientsLanding lang="en" />;
}
