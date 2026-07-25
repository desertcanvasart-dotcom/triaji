import { createServerClient } from '@triaji/shared/supabase';
import { notFound } from 'next/navigation';

// ─── English Pharmacy Profile ───────────────────────────────────────────────

interface Props {
  params: Promise<{ pharmacySlug: string }>;
}

export default async function PharmacyProfilePage({ params }: Props) {
  const { pharmacySlug } = await params;
  const supabase = createServerClient();

  // Fetch pharmacy tenant by slug
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, name_ar, name_en, slug, logo_url, tier, address_en, address_ar, phone')
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
      license_number:pharmacy_license_number,
      delivery_enabled:delivery_available,
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

  const displayName = tenant.name_en || tenant.name_ar;
  const displayAddress = tenant.address_en || tenant.address_ar;
  const pharmacistName = config?.pharmacist_name_en || config?.pharmacist_name_ar;
  const hasPendingPrescriptions = true;

  const DAY_NAMES_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return (
    <div className="min-h-screen bg-gray-50" dir="ltr">
      {/* Header */}
      <header className="bg-emerald-700 text-white py-8 px-4">
        <div className="max-w-3xl mx-auto text-center">
          {tenant.logo_url && (
            <img
              src={tenant.logo_url}
              alt={displayName}
              className="w-20 h-20 rounded-full mx-auto mb-4 border-2 border-white/20"
            />
          )}
          <h1 className="text-2xl font-bold">{displayName}</h1>
          <span className="inline-block mt-2 text-sm px-3 py-1 rounded-full bg-green-500/20 text-green-100">
            Pharmacy
          </span>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Pharmacy Info */}
        <div className="bg-white rounded-xl shadow-sm p-5 space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">Pharmacy Information</h2>

          {config?.opening_time && config?.closing_time && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>🕐</span>
              <span>Working hours: {config.opening_time} — {config.closing_time}</span>
            </div>
          )}

          {config?.working_days && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>📅</span>
              <span>
                Working days:{' '}
                {(config.working_days as number[])
                  .map((d) => DAY_NAMES_EN[d])
                  .join(', ')}
              </span>
            </div>
          )}

          {displayAddress && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>📍</span>
              <span>{displayAddress}</span>
            </div>
          )}

          {tenant.phone && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>📞</span>
              <a href={`tel:${tenant.phone}`} className="text-emerald-600 hover:underline">
                {tenant.phone}
              </a>
            </div>
          )}

          {pharmacistName && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>👨‍⚕️</span>
              <span>Head pharmacist: {pharmacistName}</span>
            </div>
          )}

          {config?.prep_time_minutes && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>⏱️</span>
              <span>Preparation time: {config.prep_time_minutes} minutes</span>
            </div>
          )}

          {/* Badges */}
          <div className="flex flex-wrap gap-2 pt-2">
            {config?.delivery_enabled && (
              <span className="text-xs bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-medium">
                Delivery available
                {config.delivery_fee_egp ? ` (${config.delivery_fee_egp} EGP)` : ''}
              </span>
            )}
            {config?.accepts_insurance && (
              <span className="text-xs bg-purple-50 text-purple-700 px-3 py-1 rounded-full font-medium">
                Accepts insurance
              </span>
            )}
            {config?.accepts_walk_ins && (
              <span className="text-xs bg-green-50 text-green-700 px-3 py-1 rounded-full font-medium">
                Walk-ins accepted
              </span>
            )}
          </div>
        </div>

        {/* Insurance Providers */}
        {config?.accepts_insurance && config?.insurance_providers && (config.insurance_providers as string[]).length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-5 space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">Accepted Insurance Providers</h2>
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
              href={`/en/pharmacy/${tenant.slug}/send`}
              className="block w-full text-center bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3.5 rounded-xl shadow-lg transition-colors"
            >
              Send prescription to this pharmacy
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
