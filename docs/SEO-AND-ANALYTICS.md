# Public search and marketing analytics

The canonical public origin is https://doctortrio.online. Arabic and English
homepages are `/ar` and `/en`. `/` and old `/?lang=` links select a language and
redirect. Public pages on `www` and `app` redirect to the main origin; app clinical
routes and API requests keep their existing hosts and behavior.

`apps/web/lib/seo.ts` is the explicit public-page inventory. It drives all 28
sitemap entries, translated metadata, reciprocal hreflang links, and Analytics
eligibility. New public pages should be added there, created in both languages,
and export `marketingMetadata(locale, slug)` from their page files.

Pages outside that inventory inherit `noindex, nofollow`, with matching response
headers from middleware. The admin service is also noindex. Crawlers must be able
to read those rules: robots.txt does not disallow clinical HTML pages. Keep all
existing authentication and authorization controls; noindex is not access control.
Private/API links are never included in the sitemap.

## Deployment

1. Run `pnpm --filter @triaji/web test:seo`, typecheck, lint, and build.
2. Deploy web and admin changes through the normal GitHub/Railway workflow.
3. Verify `/sitemap.xml` and `/robots.txt` return 200 on the public domain.
4. In Google Search Console, verify the **doctortrio.online domain property**
   using Google's supplied DNS TXT record if it is not already verified.
5. Submit `https://doctortrio.online/sitemap.xml` and inspect `/ar`, `/en`, and
   a provider page. Request indexing for these representative public pages.
   Sitemap submission does not guarantee indexing or ranking.

## GA4 activation

Production now defaults to the owner-supplied DoctorTrio web stream ID
`G-1FH5LXEK2N`. Deploying this code activates the consent panel and uses that ID;
no DNS change is needed for Analytics. Development/test builds have no default ID.

An explicit `NEXT_PUBLIC_GA_MEASUREMENT_ID` on the Railway web service overrides
this default. Remove stale overrides or set it to `G-1FH5LXEK2N` before rebuilding.
An explicitly empty or invalid value disables Analytics and the consent panel.
The Measurement ID is public configuration, not a secret.

The bilingual consent panel loads Analytics only after acceptance. Cookie settings
allows withdrawal; consent lasts six months. The parent document never loads
Google's script. After acceptance it creates a small, same-origin `/analytics-frame`
document carrying only an allowlisted public pathname and title. Navigating to a
clinical, account, payment, or token route removes that document and its script.
This prevents an already-loaded Google runtime from watching sensitive SPA routes
or collecting form interactions. No GTM, advertising signals, user IDs, clinical
events, query strings, fragments, or previous-page URLs are sent by this integration.

This intentionally limits source/campaign attribution: incoming referrers and UTM
parameters are not forwarded. It records public page visits rather than application
usage or conversion events. Avoid enabling cross-frame tracking or adding Analytics
scripts to the root document. Keep enhanced measurement off unless specifically
reviewed for this design; it cannot see parent forms or scrolls in the current design.

After deployment, accept cookies and visit several public pages in a browser
without tracking blockers. Verify `g/collect` carries the correct `tid` and canonical
public `dl` URL, and confirm Realtime in the same GA property. Verify no Google
script/iframe loads when consent is unset/declined or on clinical pages. Regular
reports can take 24–48 hours; Realtime should establish collection sooner. Historical
uncollected visits cannot be recovered.

## Verification of this change (October 4, 2026)

- Web and admin TypeScript checks passed.
- Web and admin lint passed with pre-existing warnings.
- All 23 SEO/Analytics regression tests passed and are included in CI.
- Web and admin production builds passed on Node 22.21.1 with a clean isolated
  dependency install: `pnpm install --frozen-lockfile --config.node-linker=isolated`.
- The repository's default hoisted dependency install produced a React useContext
  error when prerendering Next.js error pages in this environment. The untouched
  HEAD reproduced it. The install override above resolved it without changing
  the committed lockfile. After CI reproduced the same failure, `.npmrc` was
  updated to make isolated dependencies the default for normal installs.
- Local browser checks at http://localhost:3100/en and /ar verified language,
  canonical metadata, consent acceptance, withdrawal, and removal of the
  Analytics frame on navigation into /en/chat. No Google scripts loaded in the
  parent document. The preview used a dummy ID, not a real Analytics property.
- Local HTTP checks returned a 28-entry XML sitemap, robots.txt, and a noindex
  header on the medical chat route.

Production deployment, Google Analytics receipt, and Search Console submission
are not yet verified. The owner has supplied G-1FH5LXEK2N, now configured as the
production default. The earlier full production builds preceded this ID-only change;
the updated regression tests and web typecheck were rerun afterward.
