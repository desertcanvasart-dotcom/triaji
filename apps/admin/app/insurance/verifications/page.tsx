import { requireAdmin } from '@/lib/auth/session';
import VerificationQueue from '@/components/insurance/VerificationQueue';

export default async function InsuranceVerificationsPage() {
  await requireAdmin();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">التحقق من البوليصات</h1>
      <VerificationQueue />
    </div>
  );
}
