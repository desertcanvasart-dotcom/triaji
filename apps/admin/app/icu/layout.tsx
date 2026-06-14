import { requireAdmin } from '@/lib/auth/session';
import { isIcuHospitalRole, isPlatformAdmin } from '@/lib/auth/types';
import AdminShell from '@/components/layout/AdminShell';
import ToastContainer from '@/components/ui/Toast';
import { redirect } from 'next/navigation';

export default async function IcuLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdmin();

  // Only ICU hospital roles and platform_admin can access ICU routes
  if (!isIcuHospitalRole(admin.role) && !isPlatformAdmin(admin.role)) {
    redirect('/login');
  }

  return (
    <>
      <AdminShell name={admin.name} role={admin.role}>
        {children}
      </AdminShell>
      <ToastContainer />
    </>
  );
}
