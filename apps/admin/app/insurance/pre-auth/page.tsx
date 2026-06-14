import { requireAdmin } from '@/lib/auth/session';
import PreAuthQueue from '@/components/insurance/PreAuthQueue';

export default async function InsurancePreAuthPage() {
  await requireAdmin();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">الموافقات المسبقة</h1>
      <PreAuthQueue />
    </div>
  );
}
