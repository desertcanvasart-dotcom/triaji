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

  // These all live on tenant_config, not tenants, and four of them under
  // clinic_-prefixed names. Aliased back to what the form expects.
  const { data: tenant } = await supabase
    .from('tenant_config')
    .select(
      'opening_time, closing_time, working_days, estimated_minutes_per_patient, queue_whatsapp_enabled, queue_sms_fallback, clinic_booking_mode, specialty_ar:clinic_specialty_ar, specialty_en:clinic_specialty_en, floor_address:clinic_floor_ar, phone:clinic_phone'
    )
    .eq('tenant_id', tenantId)
    .maybeSingle();

  const config = tenant ?? {};

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">الإعدادات</h1>
      <SettingsForm tenantId={tenantId} initialConfig={config} />
    </div>
  );
}
