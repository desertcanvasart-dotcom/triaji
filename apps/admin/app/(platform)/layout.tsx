import { requirePlatformAdmin } from '@/lib/auth/session';
import AdminShell from '@/components/layout/AdminShell';
import ToastContainer from '@/components/ui/Toast';

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requirePlatformAdmin();

  return (
    <>
      <AdminShell name={admin.name} role={admin.role}>
        {children}
      </AdminShell>
      <ToastContainer />
    </>
  );
}
