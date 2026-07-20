'use client';

import { useEffect } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';

/**
 * Keeps the httpOnly session cookies in step with the browser client's tokens.
 *
 * The Supabase browser client auto-refreshes the access token (~hourly) and
 * rotates the refresh token in the process. Without this, the httpOnly cookie
 * the middleware trusts would still hold the ORIGINAL access token and go stale
 * after ~1h, bouncing the user to /login mid-session. On every refresh (and
 * sign-in) we POST the current tokens to the server so the cookie stays fresh;
 * on sign-out we clear it. The middleware only ever READS the cookie, so the
 * client stays the single token refresher (no refresh-token-rotation conflict).
 *
 * Mounted once, app-wide, in the root layout.
 */
export default function SessionSync() {
  useEffect(() => {
    const supabase = getSupabaseBrowser();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        void fetch('/api/admin/auth/session', { method: 'DELETE' });
        return;
      }

      if (
        (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') &&
        session?.access_token &&
        session?.refresh_token
      ) {
        void fetch('/api/admin/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
          }),
        });
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  return null;
}
