export type AdminRole = 'platform_admin' | 'tenant_admin' | 'tenant_manager' | 'clinic_owner' | 'clinic_receptionist' | 'clinic_billing' | 'clinic_doctor' | 'lab_owner' | 'lab_receptionist' | 'lab_technician' | 'lab_billing' | 'pharmacy_owner' | 'pharmacy_staff' | 'pharmacy_billing' | 'insurance_admin' | 'insurance_reviewer' | 'insurance_finance' | 'icu_coordinator' | 'chain_owner' | 'branch_manager';

export interface AdminUser {
  id: string;
  tenant_id: string | null;
  chain_id: string | null;
  branch_tenant_id: string | null;
  role: AdminRole;
  name: string;
  email: string;
  is_active: boolean;
  created_at: string;
}

export interface AuthSession {
  user: AdminUser;
  accessToken: string;
}

export function getRoleBadge(role: AdminRole): { label: string; className: string } {
  switch (role) {
    case 'platform_admin':
      return { label: 'Platform Admin', className: 'badge-gold' };
    case 'tenant_admin':
      return { label: 'Tenant Admin', className: 'badge-teal' };
    case 'tenant_manager':
      return { label: 'Manager', className: 'badge-slate' };
    case 'clinic_owner':
      return { label: 'Clinic Owner', className: 'badge-teal' };
    case 'clinic_receptionist':
      return { label: 'Receptionist', className: 'badge-slate' };
    case 'clinic_billing':
      return { label: 'Billing', className: 'badge-slate' };
    case 'clinic_doctor':
      return { label: 'Doctor', className: 'badge-teal' };
    case 'lab_owner':
      return { label: 'Lab Owner', className: 'badge-emerald' };
    case 'lab_receptionist':
      return { label: 'Lab Receptionist', className: 'badge-slate' };
    case 'lab_technician':
      return { label: 'Lab Technician', className: 'badge-emerald' };
    case 'lab_billing':
      return { label: 'Lab Billing', className: 'badge-slate' };
    case 'pharmacy_owner':
      return { label: 'Pharmacy Owner', className: 'badge-purple' };
    case 'pharmacy_staff':
      return { label: 'Pharmacy Staff', className: 'badge-purple' };
    case 'pharmacy_billing':
      return { label: 'Pharmacy Billing', className: 'badge-purple' };
    case 'insurance_admin':
      return { label: 'Insurance Admin', className: 'badge-amber' };
    case 'insurance_reviewer':
      return { label: 'Insurance Reviewer', className: 'badge-amber' };
    case 'insurance_finance':
      return { label: 'Insurance Finance', className: 'badge-amber' };
    case 'icu_coordinator':
      return { label: 'ICU', className: 'bg-red-100 text-red-700' };
    case 'chain_owner':
      return { label: 'Chain Owner', className: 'bg-violet-100 text-violet-700' };
    case 'branch_manager':
      return { label: 'Branch Manager', className: 'bg-violet-100 text-violet-700' };
    default:
      return { label: role, className: 'badge-slate' };
  }
}

export function isPlatformAdmin(role: AdminRole): boolean {
  return role === 'platform_admin';
}

export function isTenantLevel(role: AdminRole): boolean {
  return role === 'tenant_admin' || role === 'tenant_manager';
}

export function isClinicRole(role: string): boolean {
  return ['clinic_owner', 'clinic_receptionist', 'clinic_billing', 'clinic_doctor'].includes(role);
}

export function isLabRole(role: string): boolean {
  return ['lab_owner', 'lab_receptionist', 'lab_technician', 'lab_billing'].includes(role);
}

export function getLabRedirect(role: string): string | null {
  const redirects: Record<string, string> = {
    lab_owner: '/lab/dashboard',
    lab_receptionist: '/lab/reception',
    lab_technician: '/lab/results',
    lab_billing: '/lab/billing',
  };
  return redirects[role] ?? null;
}

export function getClinicRedirect(role: string): string | null {
  const redirects: Record<string, string> = {
    clinic_owner: '/clinic/dashboard',
    clinic_receptionist: '/clinic/reception',
    clinic_billing: '/clinic/billing',
    clinic_doctor: '/clinic/reception',
  };
  return redirects[role] ?? null;
}

export function isPharmacyRole(role: string): boolean {
  return ['pharmacy_owner', 'pharmacy_staff', 'pharmacy_billing'].includes(role);
}

export function getPharmacyRedirect(role: string): string | null {
  const redirects: Record<string, string> = {
    pharmacy_owner: '/pharmacy/dashboard',
    pharmacy_staff: '/pharmacy/prescriptions',
    pharmacy_billing: '/pharmacy/billing',
  };
  return redirects[role] ?? null;
}

export function isInsuranceRole(role: string): boolean {
  return ['insurance_admin', 'insurance_reviewer', 'insurance_finance'].includes(role);
}

export function getInsuranceRedirect(role: string): string | null {
  const redirects: Record<string, string> = {
    insurance_admin: '/insurance/dashboard',
    insurance_reviewer: '/insurance/pre-auth',
    insurance_finance: '/insurance/remittance',
  };
  return redirects[role] ?? null;
}

export function isIcuHospitalRole(role: AdminRole): boolean {
  return ['tenant_admin', 'tenant_manager', 'icu_coordinator'].includes(role);
}

export function getIcuRedirect(role: AdminRole): string | null {
  if (role === 'icu_coordinator') return '/icu/beds';
  if (role === 'tenant_admin' || role === 'tenant_manager') return '/icu/setup';
  return null;
}

export function isChainRole(role: string): boolean {
  return ['chain_owner', 'branch_manager'].includes(role);
}

export function getChainRedirect(role: string): string | null {
  if (role === 'chain_owner') return '/chain/dashboard';
  // branch_manager uses existing branch admin — no chain-level redirect
  return null;
}
