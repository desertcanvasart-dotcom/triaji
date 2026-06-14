import { requireAdmin } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/server';
import ReceptionView from '@/components/clinic/ReceptionView';

export default async function ReceptionPage() {
  const admin = await requireAdmin();
  const supabase = createAdminClient();

  const tenantId = admin.tenant_id;
  if (!tenantId) {
    return (
      <div className="text-center py-20">
        <span className="text-4xl mb-3 block">⚠️</span>
        <p className="text-gray-500">لا يوجد عيادة مرتبطة بحسابك</p>
      </div>
    );
  }

  // Fetch tenant config
  const { data: tenantConfig } = await supabase
    .from('tenant_config')
    .select('estimated_minutes_per_patient, clinic_booking_mode')
    .eq('tenant_id', tenantId)
    .single();

  const estimatedMinutesPerPatient = tenantConfig?.estimated_minutes_per_patient ?? 15;
  const bookingMode = tenantConfig?.clinic_booking_mode ?? 'walk_in_only';

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
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">الاستقبال</h1>
      <ReceptionView
        tenantId={tenantId}
        doctors={doctorList}
        estimatedMinutesPerPatient={estimatedMinutesPerPatient}
        bookingMode={bookingMode}
      />
    </div>
  );
}
