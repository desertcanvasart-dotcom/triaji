import { marketingMetadata } from '@/lib/seo';

export const metadata = marketingMetadata('ar', 'patients');

import PatientsLanding from '@/components/landing/PatientsLanding';

export default function PatientsAR() {
  return <PatientsLanding lang="ar" />;
}
