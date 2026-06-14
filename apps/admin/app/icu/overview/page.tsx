import { requirePlatformAdmin } from '@/lib/auth/session';
import IcuNationalOverview from '@/components/icu/IcuNationalOverview';

export default async function IcuOverviewPage() {
  await requirePlatformAdmin();

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">ICU National Overview</h1>
        <p className="text-gray-500 mt-1">
          Platform-wide ICU bed availability across all registered hospitals.
        </p>
      </div>
      <IcuNationalOverview />
    </div>
  );
}
