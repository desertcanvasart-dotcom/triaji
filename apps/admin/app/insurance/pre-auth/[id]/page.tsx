import { requireAdmin } from '@/lib/auth/session';
import PreAuthDetail from '@/components/insurance/PreAuthDetail';

export default async function InsurancePreAuthDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">تفاصيل الموافقة المسبقة</h1>
      <PreAuthDetail requestId={id} />
    </div>
  );
}
