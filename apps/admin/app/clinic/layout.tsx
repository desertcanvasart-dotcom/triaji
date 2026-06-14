import { requireAdmin } from '@/lib/auth/session';
import { isClinicRole } from '@/lib/auth/types';
import { createAdminClient } from '@/lib/supabase/server';
import ClinicShell from '@/components/layout/ClinicShell';
import ToastContainer from '@/components/ui/Toast';
import { redirect } from 'next/navigation';

export default async function ClinicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdmin();

  // Only clinic roles and platform_admin can access clinic routes
  if (!isClinicRole(admin.role) && admin.role !== 'platform_admin') {
    redirect('/login');
  }

  // Fetch booking mode for sidebar conditional nav
  let bookingMode = 'walk_in_only';
  if (admin.tenant_id) {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from('tenant_config')
      .select('clinic_booking_mode')
      .eq('tenant_id', admin.tenant_id)
      .single();
    bookingMode = data?.clinic_booking_mode ?? 'walk_in_only';
  }

  return (
    <>
      <ClinicShell name={admin.name} role={admin.role} bookingMode={bookingMode}>
        {children}
      </ClinicShell>
      <ToastContainer />
    </>
  );
}
