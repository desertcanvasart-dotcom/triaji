import { requireAdmin } from '@/lib/auth/session';
import InsuranceSettingsForm from '@/components/insurance/InsuranceSettingsForm';

export default async function InsuranceSettingsPage() {
  const admin = await requireAdmin();
  const tenantId = admin.tenant_id;

  if (!tenantId) {
    return (
      <div className="text-center py-20">
        <span className="text-4xl mb-3 block">⚠️</span>
        <p className="text-gray-500">لا توجد شركة تأمين مرتبطة بحسابك</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">الإعدادات</h1>
      <InsuranceSettingsForm />
    </div>
  );
}
