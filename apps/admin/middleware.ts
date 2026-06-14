import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const PUBLIC_PATHS = ['/login', '/api/admin/auth/login', '/api/admin/auth/logout', '/api/admin/queue/position'];

const CLINIC_ROLES = ['clinic_owner', 'clinic_receptionist', 'clinic_billing', 'clinic_doctor'];

const LAB_ROLES = ['lab_owner', 'lab_receptionist', 'lab_technician', 'lab_billing'];

const PHARMACY_ROLES = ['pharmacy_owner', 'pharmacy_staff', 'pharmacy_billing'];

const INSURANCE_ROLES = ['insurance_admin', 'insurance_reviewer', 'insurance_finance'];

const ICU_ROLES = ['tenant_admin', 'tenant_manager', 'icu_coordinator'];

const CHAIN_ROLES = ['chain_owner', 'branch_manager'];

const ICU_COORDINATOR_ALLOWED_PATHS = ['/icu/beds', '/icu/transfers', '/api/admin/icu'];

const TENANT_ONLY_PREFIXES = ['/dashboard', '/doctors', '/bookings', '/analytics', '/calls', '/widget', '/his'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow static assets and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  const accessToken = request.cookies.get('sb-access-token')?.value;

  if (!accessToken) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const supabaseAnonKey = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];
  const supabaseServiceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Verify user
  const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: { user }, error } = await anonClient.auth.getUser(accessToken);

  if (error || !user) {
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('sb-access-token');
    response.cookies.delete('sb-refresh-token');
    return response;
  }

  // Check admin role
  const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: adminUser } = await serviceClient
    .from('admin_users')
    .select('role, tenant_id, chain_id, branch_tenant_id')
    .eq('id', user.id)
    .eq('is_active', true)
    .single();

  if (!adminUser) {
    const response = NextResponse.redirect(new URL('/login?error=not_admin', request.url));
    response.cookies.delete('sb-access-token');
    response.cookies.delete('sb-refresh-token');
    return response;
  }

  // Chain route access control
  const isChainRoute =
    pathname.startsWith('/chain') ||
    pathname.startsWith('/api/admin/chain');

  const isChainUser = CHAIN_ROLES.includes(adminUser.role);

  if (isChainRoute && adminUser.role !== 'chain_owner' && adminUser.role !== 'platform_admin') {
    return NextResponse.json(
      { error: 'Forbidden. Chain owner access required.' },
      { status: 403 }
    );
  }

  // chain_owner redirected from clinic/lab/pharmacy routes to /chain/dashboard
  if (adminUser.role === 'chain_owner') {
    const isBranchAdminRoute =
      pathname.startsWith('/clinic') ||
      pathname.startsWith('/lab') ||
      pathname.startsWith('/pharmacy') ||
      pathname.startsWith('/dashboard') ||
      pathname.startsWith('/doctors') ||
      pathname.startsWith('/bookings') ||
      pathname.startsWith('/analytics');

    if (isBranchAdminRoute) {
      return NextResponse.redirect(new URL('/chain/dashboard', request.url));
    }
  }

  // branch_manager scope enforcement: validate branch_tenant_id on EVERY request
  if (adminUser.role === 'branch_manager') {
    // Block access to /chain/* routes entirely
    if (isChainRoute) {
      return NextResponse.json(
        { error: 'Forbidden. Chain owner access required.' },
        { status: 403 }
      );
    }

    // For clinic/lab/pharmacy routes, verify accessed tenant matches branch_tenant_id
    const branchTenantId = adminUser.branch_tenant_id;
    if (branchTenantId) {
      // Check tenant_id from query params or path for API routes
      const url = request.nextUrl;
      const requestedTenantId = url.searchParams.get('tenant_id');
      if (requestedTenantId && requestedTenantId !== branchTenantId) {
        return NextResponse.json(
          { error: 'Forbidden. Access limited to your assigned branch.' },
          { status: 403 }
        );
      }
    }
  }

  // Block tenant admins from platform routes
  const isPlatformRoute =
    pathname.startsWith('/tenants') ||
    pathname.startsWith('/knowledge-base') ||
    pathname.startsWith('/emergency-rules') ||
    pathname.startsWith('/api/admin/kb') ||
    pathname.startsWith('/api/admin/emergency-rules') ||
    pathname.startsWith('/api/admin/tenants');

  if (isPlatformRoute && adminUser.role !== 'platform_admin') {
    return NextResponse.json(
      { error: 'Forbidden. Platform admin access required.' },
      { status: 403 }
    );
  }

  // Clinic route access control
  const isClinicRoute =
    pathname.startsWith('/clinic') ||
    pathname.startsWith('/api/admin/queue') ||
    pathname.startsWith('/api/admin/invoices') ||
    pathname.startsWith('/api/admin/clinic');

  const isClinicUser = CLINIC_ROLES.includes(adminUser.role);
  // branch_manager can access branch routes (scoped by tenant_id check above)
  const isBranchManager = adminUser.role === 'branch_manager';

  if (isClinicRoute && !isClinicUser && !isBranchManager && adminUser.role !== 'platform_admin') {
    return NextResponse.json(
      { error: 'Forbidden. Clinic access required.' },
      { status: 403 }
    );
  }

  // Lab route access control
  const isLabRoute =
    pathname.startsWith('/lab') ||
    pathname.startsWith('/api/admin/lab');

  const isLabUser = LAB_ROLES.includes(adminUser.role);

  if (isLabRoute && !isLabUser && !isBranchManager && adminUser.role !== 'platform_admin') {
    return NextResponse.json(
      { error: 'Forbidden. Lab access required.' },
      { status: 403 }
    );
  }

  // Pharmacy route access control
  const isPharmacyRoute =
    pathname.startsWith('/pharmacy') ||
    pathname.startsWith('/api/admin/pharmacy');

  const isPharmacyUser = PHARMACY_ROLES.includes(adminUser.role);

  if (isPharmacyRoute && !isPharmacyUser && !isBranchManager && adminUser.role !== 'platform_admin') {
    return NextResponse.json(
      { error: 'Forbidden. Pharmacy access required.' },
      { status: 403 }
    );
  }

  // Insurance route access control
  const isInsuranceRoute =
    pathname.startsWith('/insurance') ||
    pathname.startsWith('/api/admin/insurance');

  const isInsuranceUser = INSURANCE_ROLES.includes(adminUser.role);

  if (isInsuranceRoute && !isInsuranceUser && adminUser.role !== 'platform_admin') {
    return NextResponse.json(
      { error: 'Forbidden. Insurance access required.' },
      { status: 403 }
    );
  }

  // ICU route access control
  const isIcuRoute =
    pathname.startsWith('/icu') ||
    pathname.startsWith('/api/admin/icu');

  const isIcuUser = ICU_ROLES.includes(adminUser.role);

  if (isIcuRoute && !isIcuUser && adminUser.role !== 'platform_admin') {
    return NextResponse.json(
      { error: 'Forbidden. ICU access required.' },
      { status: 403 }
    );
  }

  // ICU coordinator: block from all admin sections except ICU beds and transfers
  if (adminUser.role === 'icu_coordinator') {
    const isAllowedIcuPath = ICU_COORDINATOR_ALLOWED_PATHS.some((p) => pathname.startsWith(p));
    if (!isAllowedIcuPath) {
      return NextResponse.redirect(new URL('/icu/beds', request.url));
    }
  }

  // Redirect branch_manager from tenant-only routes to their branch dashboard
  if (isBranchManager && TENANT_ONLY_PREFIXES.some((p) => pathname.startsWith(p))) {
    // Default to clinic dashboard; the branch_manager sees only their branch data
    return NextResponse.redirect(new URL('/clinic/dashboard', request.url));
  }

  // Redirect clinic roles from tenant-only routes to their clinic dashboard
  if (isClinicUser && TENANT_ONLY_PREFIXES.some((p) => pathname.startsWith(p))) {
    const clinicRedirects: Record<string, string> = {
      clinic_owner: '/clinic/dashboard',
      clinic_receptionist: '/clinic/reception',
      clinic_billing: '/clinic/billing',
      clinic_doctor: '/clinic/reception',
    };
    const target = clinicRedirects[adminUser.role] ?? '/clinic/dashboard';
    return NextResponse.redirect(new URL(target, request.url));
  }

  // Redirect lab roles from tenant/clinic routes to their lab dashboard
  if (isLabUser && (TENANT_ONLY_PREFIXES.some((p) => pathname.startsWith(p)) || isClinicRoute)) {
    const labRedirects: Record<string, string> = {
      lab_owner: '/lab/dashboard',
      lab_receptionist: '/lab/reception',
      lab_technician: '/lab/results',
      lab_billing: '/lab/billing',
    };
    const target = labRedirects[adminUser.role] ?? '/lab/dashboard';
    return NextResponse.redirect(new URL(target, request.url));
  }

  // Redirect pharmacy roles from tenant/clinic/lab routes to their pharmacy dashboard
  if (isPharmacyUser && (TENANT_ONLY_PREFIXES.some((p) => pathname.startsWith(p)) || isClinicRoute || isLabRoute)) {
    const pharmacyRedirects: Record<string, string> = {
      pharmacy_owner: '/pharmacy/dashboard',
      pharmacy_staff: '/pharmacy/prescriptions',
      pharmacy_billing: '/pharmacy/billing',
    };
    const target = pharmacyRedirects[adminUser.role] ?? '/pharmacy/dashboard';
    return NextResponse.redirect(new URL(target, request.url));
  }

  // Redirect insurance roles from tenant/clinic/lab/pharmacy routes to their insurance dashboard
  if (isInsuranceUser && (TENANT_ONLY_PREFIXES.some((p) => pathname.startsWith(p)) || isClinicRoute || isLabRoute || isPharmacyRoute)) {
    const insuranceRedirects: Record<string, string> = {
      insurance_admin: '/insurance/dashboard',
      insurance_reviewer: '/insurance/pre-auth',
      insurance_finance: '/insurance/remittance',
    };
    const target = insuranceRedirects[adminUser.role] ?? '/insurance/dashboard';
    return NextResponse.redirect(new URL(target, request.url));
  }

  // Inject admin info into request headers
  const response = NextResponse.next();
  response.headers.set('x-admin-role', adminUser.role);
  response.headers.set('x-admin-tenant-id', adminUser.tenant_id ?? '');
  response.headers.set('x-admin-chain-id', adminUser.chain_id ?? '');
  response.headers.set('x-admin-branch-tenant-id', adminUser.branch_tenant_id ?? '');

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
