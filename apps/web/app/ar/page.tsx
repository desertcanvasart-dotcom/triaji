import { marketingMetadata } from '@/lib/seo';

export const metadata = marketingMetadata('ar', '');

import HomeLanding from '@/components/landing/HomeLanding';

export default function HomePage() { return <HomeLanding lang="ar" />; }
