import { requireAdmin } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/server';
import SettingsForm from '@/components/clinic/SettingsForm';

export default async function ClinicSettingsPage() {
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

  // Fetch current tenant config
  const { data: tenant } = await supabase
    .from('tenants')
    .select(
      'opening_time, closing_time, working_days, estimated_minutes_per_patient, queue_whatsapp_enabled, queue_sms_fallback, specialty_ar, specialty_en, floor_address, phone'
    )
    .eq('id', tenantId)
    .single();

  const config = tenant ?? {};

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">الإعدادات</h1>
      <SettingsForm tenantId={tenantId} initialConfig={config} />
    </div>
  );
}
