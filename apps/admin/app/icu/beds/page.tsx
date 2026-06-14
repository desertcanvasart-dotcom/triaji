import { requireAdmin } from '@/lib/auth/session';
import IcuBedManager from '@/components/icu/IcuBedManager';

export default async function IcuBedsPage() {
  const admin = await requireAdmin();
  const tenantId = admin.tenant_id;

  if (!tenantId) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">No tenant associated with this account.</p>
      </div>
    );
  }

  return <IcuBedManager tenantId={tenantId} />;
}
