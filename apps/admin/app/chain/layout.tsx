import { requireAdmin } from '@/lib/auth/session';
import { isChainRole } from '@/lib/auth/types';
import ChainShell from '@/components/chain/ChainShell';
import ToastContainer from '@/components/ui/Toast';
import { redirect } from 'next/navigation';

export default async function ChainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdmin();

  // Only chain_owner and platform_admin can access chain routes
  if (admin.role !== 'chain_owner' && admin.role !== 'platform_admin') {
    redirect('/login');
  }

  return (
    <>
      <ChainShell name={admin.name} role={admin.role}>
        {children}
      </ChainShell>
      <ToastContainer />
    </>
  );
}
