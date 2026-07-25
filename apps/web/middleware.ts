import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SUPPORTED_LOCALES = ['ar', 'en'] as const;
type Locale = (typeof SUPPORTED_LOCALES)[number];

/** Routes that the embedded widget calls cross-origin */
const WIDGET_API_ROUTES = [
  '/api/embed',
  '/api/session',
  '/api/chat',
  '/api/booking',
  '/api/doctors',
];

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

/** Doctor routes that require authentication */
const DOCTOR_PROTECTED_ROUTES = [
  '/ar/doctor/dashboard',
  '/ar/doctor/consultation',
  '/ar/doctor/quick-intake',
  '/ar/doctor/settings',
];

/** Doctor routes that only need login (any status) */
const DOCTOR_AUTH_ROUTES = [
  '/ar/doctor/pending',
  // Document upload is exactly what a *pending* doctor needs, so it sits here
  // rather than behind the verified-only gate.
  '/ar/doctor/documents',
  '/en/doctor/documents',
];

function isWidgetRoute(pathname: string): boolean {
  return WIDGET_API_ROUTES.some((route) => pathname.startsWith(route));
}

function isDoctorProtectedRoute(pathname: string): boolean {
  return DOCTOR_PROTECTED_ROUTES.some((route) => pathname.startsWith(route));
}

function isDoctorAuthRoute(pathname: string): boolean {
  return DOCTOR_AUTH_ROUTES.some((route) => pathname.startsWith(route));
}

/**
 * Detect preferred language from:
 * 1. `lang` cookie (explicit user choice — highest priority)
 * 2. Accept-Language header (browser default)
 * 3. Default to Arabic
 */
function detectLocale(request: NextRequest): Locale {
  // 1. Check lang cookie
  const langCookie = request.cookies.get('lang')?.value;
  if (langCookie && SUPPORTED_LOCALES.includes(langCookie as Locale)) {
    return langCookie as Locale;
  }

  // 2. Check Accept-Language header
  const acceptLang = request.headers.get('accept-language') ?? '';
  if (acceptLang.startsWith('en')) {
    return 'en';
  }

  // 3. Default to Arabic
  return 'ar';
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Handle CORS preflight for widget-facing API routes
  if (request.method === 'OPTIONS' && isWidgetRoute(pathname)) {
    return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
  }

  // Add CORS headers to widget-facing API responses
  if (pathname.startsWith('/api/') && isWidgetRoute(pathname)) {
    const response = NextResponse.next();
    for (const [key, value] of Object.entries(CORS_HEADERS)) {
      response.headers.set(key, value);
    }
    return response;
  }

  // Skip other API routes and static assets
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Doctor protected routes — check for access token cookie
  if (isDoctorProtectedRoute(pathname) || isDoctorAuthRoute(pathname)) {
    const accessToken = request.cookies.get('sb-access-token')?.value;
    if (!accessToken) {
      const url = request.nextUrl.clone();
      url.pathname = '/ar/doctor/login';
      return NextResponse.redirect(url);
    }
    // Actual verification_status check happens in the layout component
    // (middleware can't easily call Supabase to check doctor status)
    return NextResponse.next();
  }

  // Check if pathname already has a locale prefix
  const hasLocale = SUPPORTED_LOCALES.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );

  if (!hasLocale && pathname !== '/') {
    // Redirect to detected locale
    const locale = detectLocale(request);
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}${pathname}`;
    return NextResponse.redirect(url);
  }

  // Root path — handle lang switch and serve homepage
  if (pathname === '/') {
    const langParam = request.nextUrl.searchParams.get('lang');
    if (langParam && SUPPORTED_LOCALES.includes(langParam as Locale)) {
      const url = request.nextUrl.clone();
      url.searchParams.delete('lang');
      const response = NextResponse.redirect(url);
      response.cookies.set('lang', langParam, {
        path: '/',
        maxAge: 60 * 60 * 24 * 365,
        sameSite: 'lax',
      });
      return response;
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
