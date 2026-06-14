import { requireAdmin } from '@/lib/auth/session';
import ClaimsQueue from '@/components/insurance/ClaimsQueue';

export default async function InsuranceClaimsPage() {
  await requireAdmin();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">المطالبات</h1>
      <ClaimsQueue />
    </div>
  );
}
