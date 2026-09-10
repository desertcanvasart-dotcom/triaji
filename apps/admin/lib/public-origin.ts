import type { NextRequest } from 'next/server';

/**
 * The public origin the browser actually reached, honouring the reverse proxy.
 *
 * Behind Railway's proxy `request.nextUrl.origin` is the app's internal bound
 * host (e.g. http://0.0.0.0:8080), not the public domain
 * (https://admin.doctortrio.online). Using it to build Supabase invite /
 * recovery `redirectTo` links produced URLs that don't match Supabase's
 * Redirect-URL allowlist, so Supabase silently fell back to the Site URL and
 * dropped the user on the home page instead of /set-password.
 *
 * Prefer the proxy's forwarded headers when present; fall back to
 * nextUrl.origin for direct (local) requests.
 */
export function getPublicOrigin(request: NextRequest): string {
  const fwdHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  if (!fwdHost) return request.nextUrl.origin;
  const fwdProto =
    request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() ||
    request.nextUrl.protocol.replace(':', '');
  return `${fwdProto}://${fwdHost}`;
}
