import { requireAdmin } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/server';
import ChainDashboard from '@/components/chain/ChainDashboard';
import { redirect } from 'next/navigation';

export default async function ChainDashboardPage() {
  const admin = await requireAdmin();

  if (admin.role !== 'chain_owner' && admin.role !== 'platform_admin') {
    redirect('/login');
  }

  // Get chain_id for this admin
  let chainId = admin.chain_id;

  // If platform_admin, find first chain (or use query param)
  if (!chainId && admin.role === 'platform_admin') {
    const supabase = createAdminClient();
    const { data: firstChain } = await supabase
      .from('chains')
      .select('id')
      .eq('is_active', true)
      .limit(1)
      .single();
    chainId = firstChain?.id ?? null;
  }

  if (!chainId) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No Chain Found</h2>
          <p className="text-gray-500">
            No chain is associated with your account. Please contact a platform admin.
          </p>
        </div>
      </div>
    );
  }

  return <ChainDashboard chainId={chainId} />;
}
