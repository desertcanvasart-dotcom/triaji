import { requireAdmin } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/server';
import AddBranchWizard from '@/components/chain/AddBranchWizard';
import { redirect } from 'next/navigation';

export default async function NewBranchPage() {
  const admin = await requireAdmin();

  if (admin.role !== 'chain_owner' && admin.role !== 'platform_admin') {
    redirect('/login');
  }

  let chainId = admin.chain_id;

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
        <p className="text-gray-500">No chain found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Add New Branch</h1>
      <AddBranchWizard chainId={chainId} />
    </div>
  );
}
