import { requireAdmin } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/server';
import {
  getClinicRedirect,
  getLabRedirect,
  getPharmacyRedirect,
  getInsuranceRedirect,
  getChainRedirect,
  type AdminRole,
} from '@/lib/auth/types';
import AccountClient from './AccountClient';
import ToastContainer from '@/components/ui/Toast';

export const dynamic = 'force-dynamic';

/**
 * Self-service account page for every admin role.
 *
 * Sits outside the role-specific route groups on purpose: a clinic owner, lab
 * technician and platform admin all need it, and each of those groups' layouts
 * gates on its own roles. `requireAdmin` is the only check it needs.
 */

/** The dashboard this role actually lands on, for the back link. */
function homeFor(role: AdminRole): string {
  return (
    getChainRedirect(role) ??
    getClinicRedirect(role) ??
    getLabRedirect(role) ??
    getPharmacyRedirect(role) ??
    getInsuranceRedirect(role) ??
    '/dashboard'
  );
}

export default async function AccountPage() {
  const admin = await requireAdmin();

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('admin_users')
    .select('phone')
    .eq('id', admin.id)
    .maybeSingle();

  // Reads as "no mobile on file" until migration 067 is applied.
  const phone = error ? null : ((data?.phone as string | null) ?? null);

  return (
    <>
      <AccountClient
        name={admin.name}
        email={admin.email}
        role={admin.role}
        initialPhone={phone}
        homeHref={homeFor(admin.role)}
      />
      <ToastContainer />
    </>
  );
}
