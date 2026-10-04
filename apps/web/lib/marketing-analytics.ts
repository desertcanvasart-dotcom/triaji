import { publicPage, SITE_ORIGIN } from './seo';

export const CONSENT_COOKIE = 'doctortrio-analytics-consent';

export function measurementId(): string | null {
  // Public web-stream ID supplied by the site owner. Local/test builds stay quiet.
  // An explicit env value overrides the default; an empty value disables tracking.
  const value = (process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ??
    (process.env.NODE_ENV === 'production' ? 'G-1FH5LXEK2N' : '')).trim();
  return value && /^G-[A-Z0-9]+$/.test(value) ? value : null;
}

export function analyticsDocument(pathname: string, id: string): string | null {
  const page = publicPage(pathname);
  if (!page || !/^G-[A-Z0-9]+$/.test(id)) return null;
  const json = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c');
  const config = {
    page_location: SITE_ORIGIN + pathname,
    page_title: page.title,
    page_referrer: '',
    send_page_view: true,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    cookie_flags: 'SameSite=Lax;Secure',
  };
  // Google only sees this empty document, never the parent form, query, or clinical URL.
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"></head><body>
<script>
window.dataLayer = window.dataLayer || [];
function gtag(){ window.dataLayer.push(arguments); }
gtag('consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
gtag('js', new Date());
gtag('config', ${json(id)}, ${json(config)});
</script><script async src="https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}"></script>
</body></html>`;
}
