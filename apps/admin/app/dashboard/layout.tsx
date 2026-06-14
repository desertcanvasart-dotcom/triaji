import { requireAdmin } from '@/lib/auth/session';
import AdminShell from '@/components/layout/AdminShell';
import ToastContainer from '@/components/ui/Toast';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdmin();

  return (
    <>
      <AdminShell name={admin.name} role={admin.role}>
        {children}
      </AdminShell>
      <ToastContainer />
    </>
  );
}
