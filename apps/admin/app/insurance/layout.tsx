import { requireAdmin } from '@/lib/auth/session';
import { isInsuranceRole } from '@/lib/auth/types';
import InsuranceShell from '@/components/insurance/InsuranceShell';
import ToastContainer from '@/components/ui/Toast';
import { redirect } from 'next/navigation';

export default async function InsuranceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdmin();

  // Only insurance roles and platform_admin can access insurance routes
  if (!isInsuranceRole(admin.role) && admin.role !== 'platform_admin') {
    redirect('/login');
  }

  return (
    <>
      <InsuranceShell name={admin.name} role={admin.role}>
        {children}
      </InsuranceShell>
      <ToastContainer />
    </>
  );
}
