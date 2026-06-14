import { requireAdmin } from '@/lib/auth/session';
import ProviderInsuranceDashboard from '@/components/insurance/ProviderInsuranceDashboard';

export default async function ClinicBillingInsurancePage() {
  const admin = await requireAdmin();
  const tenantId = admin.tenant_id;

  if (!tenantId) {
    return (
      <div className="text-center py-20">
        <span className="text-4xl mb-3 block">⚠️</span>
        <p className="text-gray-500">لا يوجد عيادة مرتبطة بحسابك</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">مطالبات التأمين</h1>
      <ProviderInsuranceDashboard tenantId={tenantId} />
    </div>
  );
}
