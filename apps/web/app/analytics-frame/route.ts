import type { NextRequest } from 'next/server';
import { analyticsDocument, CONSENT_COOKIE, measurementId } from '@/lib/marketing-analytics';

export const dynamic = 'force-dynamic';

export function GET(request: NextRequest) {
  const id = measurementId();
  const consent = request.cookies.get(CONSENT_COOKIE)?.value === 'granted';
  const query = request.nextUrl.searchParams;
  const cleanQuery = [...query.keys()].every((key) => key === 'path') && query.getAll('path').length === 1;
  const html = id && consent && cleanQuery ? analyticsDocument(request.nextUrl.searchParams.get('path') ?? '', id) : null;
  return new Response(html, {
    status: html ? 200 : 404,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex, nofollow',
      'Referrer-Policy': 'no-referrer',
      'X-Frame-Options': 'SAMEORIGIN',
      'Content-Security-Policy': "frame-ancestors 'self'",
    },
  });
}
