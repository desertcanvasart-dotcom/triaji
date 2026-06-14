import { requireAdmin } from '@/lib/auth/session';
import BillingView from '@/components/clinic/BillingView';
import PaymentStatsPanel from '@/components/clinic/PaymentStatsPanel';

export default async function LabBillingPage() {
  const admin = await requireAdmin();
  const tenantId = admin.tenant_id;

  if (!tenantId) {
    return (
      <div className="text-center py-20">
        <span className="text-4xl mb-3 block">&#9888;&#65039;</span>
        <p className="text-gray-500">لا يوجد معمل مرتبط بحسابك</p>
      </div>
    );
  }

  // Labs don't have per-doctor billing — pass empty doctors array
  // BillingView handles this gracefully (doctor column shows '-')
  const doctorList: Array<{ id: string; name_ar: string }> = [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">الفواتير</h1>

      {/* Online Payment Stats */}
      <PaymentStatsPanel tenantId={tenantId} />

      {/* Invoice List */}
      <BillingView tenantId={tenantId} doctors={doctorList} />
    </div>
  );
}
