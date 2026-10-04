import { marketingMetadata } from '@/lib/seo';

export const metadata = marketingMetadata('en', 'about');

import AboutClient from '@/components/shared/AboutClient';
export default function EnglishAboutPage() { return <AboutClient lang="en" />; }
