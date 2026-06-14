import { requireAdmin } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/server';
import LabSettings from '@/components/lab/LabSettings';
import PaymentSettingsSection from '@/components/clinic/PaymentSettingsSection';

export default async function LabSettingsPage() {
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

  const supabase = createAdminClient();

  // Fetch current lab config
  const { data: labConfig } = await supabase
    .from('tenants')
    .select(
      'lab_type, accreditation_number, medical_director, turnaround_hours, urgent_turnaround_hours, accepts_walk_ins, home_collection, home_collection_fee, collection_notes'
    )
    .eq('id', tenantId)
    .single();

  const config = labConfig ?? {};

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">الإعدادات</h1>
      <LabSettings tenantId={tenantId} initialConfig={config} />

      {/* Online Payment Settings */}
      <div className="max-w-2xl" dir="rtl">
        <PaymentSettingsSection tenantId={tenantId} />
      </div>
    </div>
  );
}
