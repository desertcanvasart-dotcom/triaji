import type { MetadataRoute } from 'next';
import { LOCALES, PUBLIC_PAGES, SITE_ORIGIN, publicPath } from '@/lib/seo';

export default function sitemap(): MetadataRoute.Sitemap {
  return Object.keys(PUBLIC_PAGES).flatMap((slug) => LOCALES.map((locale) => ({
    url: SITE_ORIGIN + publicPath(locale, slug),
    alternates: { languages: {
      ar: SITE_ORIGIN + publicPath('ar', slug),
      en: SITE_ORIGIN + publicPath('en', slug),
      'x-default': SITE_ORIGIN + publicPath('ar', slug),
    } },
  })));
}
