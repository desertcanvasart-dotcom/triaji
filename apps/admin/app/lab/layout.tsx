import { requireAdmin } from '@/lib/auth/session';
import { isLabRole } from '@/lib/auth/types';
import LabShell from '@/components/layout/LabShell';
import ToastContainer from '@/components/ui/Toast';
import { redirect } from 'next/navigation';

export default async function LabLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdmin();

  // Only lab roles and platform_admin can access lab routes
  if (!isLabRole(admin.role) && admin.role !== 'platform_admin') {
    redirect('/login');
  }

  return (
    <>
      <LabShell name={admin.name} role={admin.role}>
        {children}
      </LabShell>
      <ToastContainer />
    </>
  );
}
