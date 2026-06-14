import { requireAdmin } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/server';
import BillingView from '@/components/clinic/BillingView';
import PaymentStatsPanel from '@/components/clinic/PaymentStatsPanel';

export default async function BillingPage() {
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

  const supabase = createAdminClient();

  // Fetch active doctors for this clinic
  const { data: doctors } = await supabase
    .from('doctors')
    .select('id, name_ar')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('name_ar', { ascending: true });

  const doctorList = (doctors ?? []).map((d) => ({
    id: d.id as string,
    name_ar: d.name_ar as string,
  }));

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
