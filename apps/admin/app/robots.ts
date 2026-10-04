import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  // Crawling remains possible so the site-wide noindex header can be observed.
  return { rules: { userAgent: '*', allow: '/', disallow: '/api/' } };
}
