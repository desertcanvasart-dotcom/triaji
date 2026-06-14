import { requireAdmin } from '@/lib/auth/session';
import { isPharmacyRole } from '@/lib/auth/types';
import PharmacyShell from '@/components/layout/PharmacyShell';
import ToastContainer from '@/components/ui/Toast';
import { redirect } from 'next/navigation';

export default async function PharmacyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdmin();

  // Only pharmacy roles and platform_admin can access pharmacy routes
  if (!isPharmacyRole(admin.role) && admin.role !== 'platform_admin') {
    redirect('/login');
  }

  return (
    <>
      <PharmacyShell name={admin.name} role={admin.role}>
        {children}
      </PharmacyShell>
      <ToastContainer />
    </>
  );
}
