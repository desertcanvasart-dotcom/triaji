import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { AdminUser } from './types';
import { isClinicRole, isLabRole, isPharmacyRole, isInsuranceRole, isIcuHospitalRole, isChainRole } from './types';

/**
 * Authenticate an API route request and return the admin user.
 * Returns 401 if not authenticated, 403 if not an admin.
 */
export async function authenticateAdmin(
  request: NextRequest
): Promise<{ admin: AdminUser } | NextResponse> {
  const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const supabaseServiceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  const supabaseAnonKey = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

  if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
    return NextResponse.json(
      { error: 'Server configuration error' },
      { status: 500 }
    );
  }

  const accessToken =
    request.cookies.get('sb-access-token')?.value ??
    request.headers.get('Authorization')?.replace('Bearer ', '');

  if (!accessToken) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  // Verify token
  const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: { user }, error } = await anonClient.auth.getUser(accessToken);

  if (error || !user) {
    return NextResponse.json(
      { error: 'Invalid or expired token' },
      { status: 401 }
    );
  }

  // Fetch admin record
  const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: adminUser } = await adminClient
    .from('admin_users')
    .select('*')
    .eq('id', user.id)
    .eq('is_active', true)
    .single();

  if (!adminUser) {
    return NextResponse.json(
      { error: 'Access denied. Not an admin user.' },
      { status: 403 }
    );
  }

  return { admin: adminUser as AdminUser };
}

/**
 * Build a tenant-scoped query filter.
 * Platform admins see all data; tenant admins see only their tenant.
 */
/**
 * Require clinic-level access. Allows clinic roles and platform_admin.
 * Returns 403 if the admin does not have clinic access.
 */
export function requireClinicAccess(
  admin: AdminUser
): NextResponse | null {
  if (admin.role === 'platform_admin' || isClinicRole(admin.role)) {
    return null;
  }
  return NextResponse.json(
    { error: 'Forbidden. Clinic access required.' },
    { status: 403 }
  );
}

/**
 * Require lab-level access. Allows lab roles and platform_admin.
 * Returns 403 if the admin does not have lab access.
 */
export function requireLabAccess(
  admin: AdminUser
): NextResponse | null {
  if (admin.role === 'platform_admin' || isLabRole(admin.role)) {
    return null;
  }
  return NextResponse.json(
    { error: 'Forbidden. Lab access required.' },
    { status: 403 }
  );
}

/**
 * Require pharmacy-level access. Allows pharmacy roles and platform_admin.
 * Returns 403 if the admin does not have pharmacy access.
 */
export function requirePharmacyAccess(
  admin: AdminUser
): NextResponse | null {
  if (admin.role === 'platform_admin' || isPharmacyRole(admin.role)) {
    return null;
  }
  return NextResponse.json(
    { error: 'Forbidden. Pharmacy access required.' },
    { status: 403 }
  );
}

/**
 * Require insurance-level access. Allows insurance roles and platform_admin.
 * Returns 403 if the admin does not have insurance access.
 */
export function requireInsuranceAccess(
  admin: AdminUser
): NextResponse | null {
  if (admin.role === 'platform_admin' || isInsuranceRole(admin.role)) {
    return null;
  }
  return NextResponse.json(
    { error: 'Forbidden. Insurance access required.' },
    { status: 403 }
  );
}

/**
 * Require ICU-level access. Allows ICU hospital roles and platform_admin.
 * Returns 403 if the admin does not have ICU access.
 */
export function requireIcuAccess(
  admin: AdminUser
): NextResponse | null {
  if (admin.role === 'platform_admin' || isIcuHospitalRole(admin.role)) {
    return null;
  }
  return NextResponse.json(
    { error: 'Forbidden. ICU access required.' },
    { status: 403 }
  );
}

export function tenantScope(admin: AdminUser): string | null {
  if (admin.role === 'platform_admin') return null;
  return admin.tenant_id;
}

/**
 * Require chain-level access. Validates chain_owner role + matching chain_id.
 * Returns 403 if the admin does not have chain access or chain_id doesn't match.
 */
export function requireChainAccess(
  admin: AdminUser,
  chainId?: string
): NextResponse | null {
  if (admin.role === 'platform_admin') return null;
  if (admin.role !== 'chain_owner') {
    return NextResponse.json(
      { error: 'Forbidden. Chain owner access required.' },
      { status: 403 }
    );
  }
  if (chainId && admin.chain_id && admin.chain_id !== chainId) {
    return NextResponse.json(
      { error: 'Forbidden. Access denied to this chain.' },
      { status: 403 }
    );
  }
  return null;
}
