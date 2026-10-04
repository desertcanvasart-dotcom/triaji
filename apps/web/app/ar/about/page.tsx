import { marketingMetadata } from '@/lib/seo';

export const metadata = marketingMetadata('ar', 'about');

import AboutClient from '@/components/shared/AboutClient';
export default function ArabicAboutPage() { return <AboutClient lang="ar" />; }
