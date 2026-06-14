import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import type { AdminUser } from './types';

/**
 * Get the current admin session from cookies on the server side.
 * Returns null if not authenticated or not an admin.
 */
export async function getAdminSession(): Promise<AdminUser | null> {
  const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const supabaseServiceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  const supabaseAnonKey = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

  if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
    return null;
  }

  const cookieStore = await cookies();
  const accessToken = cookieStore.get('sb-access-token')?.value;
  const refreshToken = cookieStore.get('sb-refresh-token')?.value;

  if (!accessToken) return null;

  // Verify the token using anon client
  const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: { user }, error } = await anonClient.auth.getUser(accessToken);

  if (error || !user) {
    // Try refresh
    if (refreshToken) {
      const { data: refreshData } = await anonClient.auth.refreshSession({
        refresh_token: refreshToken,
      });
      if (!refreshData.user) return null;
      // Fetch admin record with service key
      const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: adminUser } = await adminClient
        .from('admin_users')
        .select('*')
        .eq('id', refreshData.user.id)
        .eq('is_active', true)
        .single();
      return adminUser as AdminUser | null;
    }
    return null;
  }

  // Fetch admin record with service key
  const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: adminUser } = await adminClient
    .from('admin_users')
    .select('*')
    .eq('id', user.id)
    .eq('is_active', true)
    .single();

  return adminUser as AdminUser | null;
}

/**
 * Require admin session — throws redirect if not authenticated.
 */
export async function requireAdmin(): Promise<AdminUser> {
  const admin = await getAdminSession();
  if (!admin) {
    redirect('/login');
  }
  return admin;
}

/**
 * Require platform admin — throws redirect if not platform admin.
 */
export async function requirePlatformAdmin(): Promise<AdminUser> {
  const admin = await requireAdmin();
  if (admin.role !== 'platform_admin') {
    redirect('/dashboard?error=forbidden');
  }
  return admin;
}
