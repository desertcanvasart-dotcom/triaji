import { requireAdmin } from '@/lib/auth/session';
import ClinicDashboard from '@/components/clinic/ClinicDashboard';

export default async function ClinicDashboardPage() {
  const admin = await requireAdmin();
  const tenantId = admin.tenant_id;

  if (!tenantId) {
    return (
      <div className="text-center py-20">
        <span className="text-4xl mb-3 block">&#9888;&#65039;</span>
        <p className="text-gray-500">لا يوجد عيادة مرتبطة بحسابك</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">لوحة التحكم</h1>
      <ClinicDashboard tenantId={tenantId} />
    </div>
  );
}
