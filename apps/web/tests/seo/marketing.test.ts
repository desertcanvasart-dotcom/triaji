import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { NextRequest } from 'next/server';
import { middleware } from '../../middleware';
import sitemap from '../../app/sitemap';
import robots from '../../app/robots';
import { GET } from '../../app/analytics-frame/route';
import { analyticsDocument, measurementId } from '../../lib/marketing-analytics';
import { marketingMetadata, publicPage, SITE_ORIGIN } from '../../lib/seo';

afterEach(() => vi.unstubAllEnvs());
const request = (path: string, headers?: Record<string, string>) => new NextRequest(SITE_ORIGIN + path, { headers });

describe('public search surface', () => {
  it('lists only 28 real canonical pages with reciprocal language alternates', () => {
    const entries = sitemap();
    expect(entries).toHaveLength(28);
    expect(new Set(entries.map((e) => e.url)).size).toBe(28);
    for (const entry of entries) {
      const path = new URL(entry.url).pathname;
      expect(publicPage(path)).not.toBeNull();
      expect(existsSync(`app${path}/page.tsx`)).toBe(true);
      const page = publicPage(path)!;
      const metadata = marketingMetadata(page.locale, page.slug);
      expect(metadata.alternates?.canonical).toBe(entry.url);
      expect(metadata.alternates?.languages).toEqual(entry.alternates?.languages);
      expect(metadata.robots).toEqual({ index: true, follow: true });
      expect(middleware(request(path)).headers.get('X-Robots-Tag')).toBeNull();
    }
    expect(new Set(entries.map((e) => {
      const p = publicPage(new URL(e.url).pathname)!;
      return marketingMetadata(p.locale, p.slug).title;
    })).size).toBe(28);
  });

  it.each(['/ar/chat', '/en/medical-record', '/ar/share/medical-record/token', '/en/lab/results/id', '/ar/pay/id', '/ar/doctor/dashboard', '/ar/providers/unknown'])('excludes %s and supplies noindex', (path) => {
    expect(publicPage(path)).toBeNull();
    expect(middleware(request(path)).headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
  });

  it('leaves sitemap and robots accessible without locale redirects', () => {
    for (const path of ['/sitemap.xml', '/robots.txt']) {
      const result = middleware(request(path));
      expect(result.headers.get('location')).toBeNull();
      expect(result.headers.get('X-Robots-Tag')).toBeNull();
    }
    expect(robots().sitemap).toBe(SITE_ORIGIN + '/sitemap.xml');
  });

  it('keeps public images crawlable', () => {
    expect(middleware(request('/logo.png')).headers.get('X-Robots-Tag')).toBeNull();
  });

  it('preserves old language switches and chooses language only at the root', () => {
    expect(middleware(request('/?lang=en')).headers.get('location')).toBe(SITE_ORIGIN + '/en');
    expect(middleware(request('/', { 'accept-language': 'en-US' })).headers.get('location')).toBe(SITE_ORIGIN + '/en');
    const english = middleware(request('/en/about', { cookie: 'lang=ar', 'x-site-locale': 'ar' }));
    expect(english.headers.get('location')).toBeNull();
    expect(english.headers.get('x-middleware-request-x-site-locale')).toBe('en');
  });

  it('redirects duplicate public hosts while preserving app workflows and APIs', () => {
    for (const host of ['www', 'app']) {
      const response = middleware(new NextRequest(`https://${host}.doctortrio.online/en/about`));
      expect(response.status).toBe(308);
      expect(response.headers.get('location')).toBe(SITE_ORIGIN + '/en/about');
    }
    expect(middleware(new NextRequest('https://app.doctortrio.online/ar/chat')).headers.get('location')).toBeNull();
    const api = middleware(new NextRequest('https://www.doctortrio.online/api/chat', { method: 'POST' }));
    expect(api.headers.get('location')).toBeNull();
    expect(api.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });
});

describe('consented marketing analytics', () => {
  it('uses the supplied production ID, while local and test builds stay disabled', () => {
    vi.stubEnv('NEXT_PUBLIC_GA_MEASUREMENT_ID', undefined);
    vi.stubEnv('NODE_ENV', 'production');
    expect(measurementId()).toBe('G-1FH5LXEK2N');
    vi.stubEnv('NODE_ENV', 'development');
    expect(measurementId()).toBeNull();
    vi.stubEnv('NODE_ENV', 'test');
    expect(measurementId()).toBeNull();
  });

  it('allows explicit overrides and an empty production value disables tracking', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_GA_MEASUREMENT_ID', 'G-OVERRIDE123');
    expect(measurementId()).toBe('G-OVERRIDE123');
    vi.stubEnv('NEXT_PUBLIC_GA_MEASUREMENT_ID', '');
    expect(measurementId()).toBeNull();
    vi.stubEnv('NEXT_PUBLIC_GA_MEASUREMENT_ID', 'invalid');
    expect(measurementId()).toBeNull();
  });
  it('does not return tracking code without both configuration and consent', () => {
    vi.stubEnv('NEXT_PUBLIC_GA_MEASUREMENT_ID', 'G-TEST12345');
    expect(GET(request('/analytics-frame?path=/en')).status).toBe(404);
    expect(GET(request('/analytics-frame?path=/en', { cookie: 'doctortrio-analytics-consent=denied' })).status).toBe(404);
    vi.stubEnv('NEXT_PUBLIC_GA_MEASUREMENT_ID', '');
    expect(GET(request('/analytics-frame?path=/en', { cookie: 'doctortrio-analytics-consent=granted' })).status).toBe(404);
  });

  it.each(['/en/chat', '/en?email=private@example.com', '/en#symptoms', '/en/providers/unknown', '/ar/share/medical-record/token', '//evil.example/en'])('rejects sensitive or non-public input %s', (path) => {
    expect(analyticsDocument(path, 'G-TEST12345')).toBeNull();
  });

  it('rejects extra iframe query data', () => {
    vi.stubEnv('NEXT_PUBLIC_GA_MEASUREMENT_ID', 'G-TEST12345');
    expect(GET(request('/analytics-frame?path=/en&email=private@example.com', { cookie: 'doctortrio-analytics-consent=granted' })).status).toBe(404);
  });

  it('queues real Arguments objects and only sanitized public page metadata', async () => {
    vi.stubEnv('NEXT_PUBLIC_GA_MEASUREMENT_ID', 'G-TEST12345');
    const res = GET(request('/analytics-frame?path=/en/about', { cookie: 'doctortrio-analytics-consent=granted' }));
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    expect(res.headers.get('Referrer-Policy')).toBe('no-referrer');
    const html = await res.text();
    const window = { dataLayer: [] as IArguments[] };
    runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)![1]!, { window });
    const config = window.dataLayer.find((args) => args[0] === 'config')!;
    expect(Object.prototype.toString.call(config)).toBe('[object Arguments]');
    expect(config[1]).toBe('G-TEST12345');
    expect(config[2].page_location).toBe(SITE_ORIGIN + '/en/about');
    expect(config[2].page_referrer).toBe('');
    expect(html).not.toContain('parent.location');
  });
});
