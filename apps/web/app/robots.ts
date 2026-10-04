import type { MetadataRoute } from 'next';
import { SITE_ORIGIN } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  // Let crawlers see noindex on non-marketing pages. robots.txt is not access control.
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/analytics-frame'] },
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
  };
}
