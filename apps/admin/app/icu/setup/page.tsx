import { requireAdmin } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import IcuSetupWizard from '@/components/icu/IcuSetupWizard';

export default async function IcuSetupPage() {
  const admin = await requireAdmin();

  // Only tenant_admin (and platform_admin via layout) can access setup
  if (admin.role !== 'tenant_admin' && admin.role !== 'platform_admin') {
    redirect('/icu/beds');
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">ICU Setup</h1>
        <p className="text-sm text-gray-500 mt-1">
          Configure your hospital ICU units and bed capacity.
        </p>
      </div>
      <IcuSetupWizard />
    </div>
  );
}
