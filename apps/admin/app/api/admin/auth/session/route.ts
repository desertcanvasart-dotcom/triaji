/**
 * POST   /api/admin/auth/session  — set the httpOnly session cookies from
 *                                    { access_token, refresh_token }.
 * DELETE /api/admin/auth/session  — clear the session cookies (logout).
 *
 * The tokens are never written to a JS-readable cookie: the client obtains
 * them from supabase.auth (sign-in / token refresh) and posts them here so the
 * server sets httpOnly cookies. The token is still independently verified by
 * middleware and authenticateAdmin on every request, so a bogus token in the
 * cookie simply fails verification. Same-origin is required to blunt login-CSRF.
 */

import { NextRequest, NextResponse } from 'next/server';
import { setSessionCookies, clearSessionCookies } from '@/lib/auth/session-cookies';

export const dynamic = 'force-dynamic';

function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true; // same-origin fetches may omit Origin
  try {
    return new URL(origin).host === request.nextUrl.host;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: { access_token?: string; refresh_token?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.access_token || !body.refresh_token) {
    return NextResponse.json(
      { error: 'access_token and refresh_token are required' },
      { status: 400 },
    );
  }

  const response = NextResponse.json({ ok: true });
  setSessionCookies(response, body.access_token, body.refresh_token);
  return response;
}

export async function DELETE(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const response = NextResponse.json({ ok: true });
  clearSessionCookies(response);
  return response;
}
