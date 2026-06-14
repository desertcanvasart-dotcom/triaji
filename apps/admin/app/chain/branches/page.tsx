import { requireAdmin } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/server';
import BranchList from '@/components/chain/BranchList';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export default async function BranchesPage() {
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Branches</h1>
        <Link
          href="/chain/branches/new"
          className="inline-flex items-center gap-2 bg-violet-600 text-white px-4 py-2.5 rounded-lg hover:bg-violet-700 transition-colors text-sm font-medium"
        >
          + Add Branch
        </Link>
      </div>
      <BranchList chainId={chainId} />
    </div>
  );
}
