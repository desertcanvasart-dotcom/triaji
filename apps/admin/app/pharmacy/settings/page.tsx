import { requireAdmin } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/server';
import PharmacySettings from '@/components/pharmacy/PharmacySettings';
import PaymentSettingsSection from '@/components/clinic/PaymentSettingsSection';

export default async function PharmacySettingsPage() {
  const admin = await requireAdmin();
  const tenantId = admin.tenant_id;

  if (!tenantId) {
    return (
      <div className="text-center py-20">
        <span className="text-4xl mb-3 block">&#9888;&#65039;</span>
        <p className="text-gray-500">لا توجد صيدلية مرتبطة بحسابك</p>
      </div>
    );
  }

  const supabase = createAdminClient();

  // Fetch existing pharmacy config
  const { data: config } = await supabase
    .from('tenant_config')
    .select(`
      license_number:pharmacy_license_number,
      pharmacist_name_ar,
      pharmacist_name_en,
      pharmacy_type,
      delivery_enabled:delivery_available,
      delivery_radius_km,
      delivery_fee_egp,
      accepts_insurance,
      insurance_providers,
      prep_time_minutes
    `)
    .eq('tenant_id', tenantId)
    .single();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">الإعدادات</h1>
      <PharmacySettings tenantId={tenantId} initialConfig={config ?? {}} />

      {/* Online Payment Settings */}
      <div className="max-w-2xl" dir="rtl">
        <PaymentSettingsSection tenantId={tenantId} />
      </div>
    </div>
  );
}
