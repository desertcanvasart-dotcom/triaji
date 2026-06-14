import { createServerClient } from '@triaji/shared/supabase';
import { notFound } from 'next/navigation';

// ─── Arabic Pharmacy Profile ────────────────────────────────────────────────

interface Props {
  params: Promise<{ pharmacySlug: string }>;
}

export default async function PharmacyProfilePage({ params }: Props) {
  const { pharmacySlug } = await params;
  const supabase = createServerClient();

  // Fetch pharmacy tenant by slug
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, name_ar, name_en, slug, logo_url, tier, address_ar, phone')
    .eq('slug', pharmacySlug)
    .eq('tier', 'pharmacy')
    .eq('is_active', true)
    .single();

  if (!tenant) notFound();

  // Fetch pharmacy config
  const { data: config } = await supabase
    .from('tenant_config')
    .select(`
      pharmacist_name_ar,
      pharmacist_name_en,
      pharmacy_type,
      license_number,
      delivery_enabled,
      delivery_radius_km,
      delivery_fee_egp,
      accepts_insurance,
      insurance_providers,
      accepts_walk_ins,
      prep_time_minutes,
      opening_time,
      closing_time,
      working_days
    `)
    .eq('tenant_id', tenant.id)
    .single();

  // Check if patient has pending prescriptions (via cookie or session)
  // For now, show the button always — the send flow handles auth
  const hasPendingPrescriptions = true;

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Header */}
      <header className="bg-emerald-700 text-white py-8 px-4">
        <div className="max-w-3xl mx-auto text-center">
          {tenant.logo_url && (
            <img
              src={tenant.logo_url}
              alt={tenant.name_ar}
              className="w-20 h-20 rounded-full mx-auto mb-4 border-2 border-white/20"
            />
          )}
          <h1 className="text-2xl font-bold">{tenant.name_ar}</h1>
          <span className="inline-block mt-2 text-sm px-3 py-1 rounded-full bg-green-500/20 text-green-100">
            صيدلية
          </span>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Pharmacy Info */}
        <div className="bg-white rounded-xl shadow-sm p-5 space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">معلومات الصيدلية</h2>

          {config?.opening_time && config?.closing_time && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>🕐</span>
              <span>ساعات العمل: {config.opening_time} — {config.closing_time}</span>
            </div>
          )}

          {config?.working_days && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>📅</span>
              <span>
                أيام العمل:{' '}
                {(config.working_days as number[])
                  .map((d) => ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'][d])
                  .join('، ')}
              </span>
            </div>
          )}

          {tenant.address_ar && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>📍</span>
              <span>{tenant.address_ar}</span>
            </div>
          )}

          {tenant.phone && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>📞</span>
              <a href={`tel:${tenant.phone}`} dir="ltr" className="text-emerald-600 hover:underline">
                {tenant.phone}
              </a>
            </div>
          )}

          {config?.pharmacist_name_ar && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>👨‍⚕️</span>
              <span>الصيدلي المسؤول: {config.pharmacist_name_ar}</span>
            </div>
          )}

          {config?.prep_time_minutes && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>⏱️</span>
              <span>وقت التحضير: {config.prep_time_minutes} دقيقة</span>
            </div>
          )}

          {/* Badges */}
          <div className="flex flex-wrap gap-2 pt-2">
            {config?.delivery_enabled && (
              <span className="text-xs bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-medium">
                توصيل متاح
                {config.delivery_fee_egp ? ` (${config.delivery_fee_egp} ج.م)` : ''}
              </span>
            )}
            {config?.accepts_insurance && (
              <span className="text-xs bg-purple-50 text-purple-700 px-3 py-1 rounded-full font-medium">
                يقبل تأمين
              </span>
            )}
            {config?.accepts_walk_ins && (
              <span className="text-xs bg-green-50 text-green-700 px-3 py-1 rounded-full font-medium">
                بدون موعد
              </span>
            )}
          </div>
        </div>

        {/* Insurance Providers */}
        {config?.accepts_insurance && config?.insurance_providers && (config.insurance_providers as string[]).length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-5 space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">شركات التأمين المقبولة</h2>
            <div className="flex flex-wrap gap-2">
              {(config.insurance_providers as string[]).map((provider) => (
                <span
                  key={provider}
                  className="text-xs bg-gray-100 text-gray-700 px-3 py-1.5 rounded-full"
                >
                  {provider}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Send Prescription Button */}
        {hasPendingPrescriptions && (
          <div className="sticky bottom-4">
            <a
              href={`/ar/pharmacy/${tenant.slug}/send`}
              className="block w-full text-center bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3.5 rounded-xl shadow-lg transition-colors"
            >
              إرسال روشتة لهذه الصيدلية
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
