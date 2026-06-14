import { requireAdmin } from '@/lib/auth/session';
import ClaimDetail from '@/components/insurance/ClaimDetail';

export default async function InsuranceClaimDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">تفاصيل المطالبة</h1>
      <ClaimDetail claimId={id} />
    </div>
  );
}
