import { requireAdmin } from '@/lib/auth/session';
import RemittanceManager from '@/components/insurance/RemittanceManager';

export default async function InsuranceRemittancePage() {
  await requireAdmin();

  return (
    <div>
      <RemittanceManager />
    </div>
  );
}
