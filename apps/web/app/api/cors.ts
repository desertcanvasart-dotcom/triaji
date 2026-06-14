/**
 * CORS helper for widget-facing API routes.
 *
 * All widget API routes must accept cross-origin requests
 * because the widget runs on hospital websites (different origin).
 *
 * Domain allowlist validation is done in the /api/embed/config handler,
 * not via CORS headers — we return 403 for blocked domains to give
 * hospital IT teams clear error messages.
 */

import { NextResponse } from 'next/server';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

/**
 * Add CORS headers to a NextResponse.
 */
export function withCors(response: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}

/**
 * Create a CORS-enabled JSON response.
 */
export function corsJson(
  data: unknown,
  options?: { status?: number; cache?: string }
): NextResponse {
  const response = NextResponse.json(data, { status: options?.status ?? 200 });

  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    response.headers.set(key, value);
  }

  if (options?.cache) {
    response.headers.set('Cache-Control', options.cache);
  }

  return response;
}

/**
 * Handle CORS preflight OPTIONS request.
 */
export function corsOptions(): NextResponse {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}
