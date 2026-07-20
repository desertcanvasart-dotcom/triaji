import type { NextResponse } from 'next/server';

/**
 * Canonical session-cookie handling for the admin panel.
 *
 * The Supabase session tokens live in httpOnly cookies so client JS can't read
 * them (XSS can't exfiltrate the server-trusted token). They must therefore be
 * set/cleared server-side — the browser can no longer write them via
 * document.cookie. Cookie NAMES are unchanged (sb-access-token /
 * sb-refresh-token) so middleware, authenticateAdmin, and getAdminSession keep
 * reading the same contract.
 */

const ACCESS_MAX_AGE = 60 * 60 * 24 * 7; // 7 days
const REFRESH_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

const baseOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
};

export function setSessionCookies(
  response: NextResponse,
  accessToken: string,
  refreshToken: string,
): void {
  response.cookies.set('sb-access-token', accessToken, {
    ...baseOptions,
    maxAge: ACCESS_MAX_AGE,
  });
  response.cookies.set('sb-refresh-token', refreshToken, {
    ...baseOptions,
    maxAge: REFRESH_MAX_AGE,
  });
}

export function clearSessionCookies(response: NextResponse): void {
  response.cookies.set('sb-access-token', '', { ...baseOptions, maxAge: 0 });
  response.cookies.set('sb-refresh-token', '', { ...baseOptions, maxAge: 0 });
  // Also drop the middleware auth cache (bound to the old access token).
  response.cookies.set('admin-mw-cache', '', { ...baseOptions, maxAge: 0 });
}
