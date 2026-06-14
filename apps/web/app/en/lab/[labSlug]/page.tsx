import { createServerClient } from '@triaji/shared/supabase';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import ChainBranchFinder from '@/components/lab/ChainBranchFinder';

// ─── English Lab Profile ────────────────────────────────────────────────────

interface Props {
  params: Promise<{ labSlug: string }>;
}

export default async function LabProfilePage({ params }: Props) {
  const { labSlug } = await params;
  const supabase = createServerClient();

  // Fetch lab tenant by slug
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, name_ar, name_en, slug, logo_url, tier, address_en, phone')
    .eq('slug', labSlug)
    .in('tier', ['lab', 'radiology'])
    .eq('is_active', true)
    .single();

  if (!tenant) notFound();

  // Fetch lab config
  const { data: config } = await supabase
    .from('tenant_config')
    .select(`
      lab_type,
      accreditation_number,
      medical_director_ar,
      turnaround_hours,
      urgent_turnaround_hours,
      accepts_walk_ins,
      home_collection,
      home_collection_fee_egp,
      collection_notes_ar,
      opening_time,
      closing_time,
      working_days
    `)
    .eq('tenant_id', tenant.id)
    .single();

  // Fetch lab services grouped by category
  const { data: services } = await supabase
    .from('lab_services')
    .select('id, code, name_en, category_ar, service_type, price_egp, fasting_required, sample_type_ar, modality, requires_appointment')
    .eq('tenant_id', tenant.id)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  // Check if this lab is a chain lab
  const { data: chainLab } = await supabase
    .from('lab_chains')
    .select('code, name_ar, name_en')
    .eq('is_active', true)
    .limit(3);

  const matchedChain = (chainLab ?? []).find(
    (c) =>
      (tenant.name_en && c.name_en && tenant.name_en.toLowerCase().includes(c.name_en.toLowerCase()))
  );

  // Group services by category
  const categoryMap: Record<string, string> = {};
  const servicesByCategory: Record<string, typeof services> = {};
  (services ?? []).forEach((svc) => {
    const catKey = svc.category_ar;
    if (!servicesByCategory[catKey]) {
      servicesByCategory[catKey] = [];
    }
    servicesByCategory[catKey]!.push(svc);
  });

  const isRadiology = tenant.tier === 'radiology';
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return (
    <div className="min-h-screen bg-gray-50" dir="ltr">
      {/* Lab Header */}
      <header className="bg-teal-700 text-white py-8 px-4">
        <div className="max-w-3xl mx-auto text-center">
          {tenant.logo_url && (
            <img
              src={tenant.logo_url}
              alt={tenant.name_en ?? ''}
              className="w-20 h-20 rounded-full mx-auto mb-4 border-2 border-white/20"
            />
          )}
          <h1 className="text-2xl font-bold">{tenant.name_en}</h1>
          <span className={`inline-block mt-2 text-sm px-3 py-1 rounded-full ${
            isRadiology
              ? 'bg-purple-500/20 text-purple-100'
              : 'bg-blue-500/20 text-blue-100'
          }`}>
            {isRadiology ? 'Radiology Center' : 'Laboratory'}
          </span>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Lab Info */}
        <div className="bg-white rounded-xl shadow-sm p-5 space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">Lab Information</h2>

          {config?.opening_time && config?.closing_time && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>🕐</span>
              <span>Hours: {config.opening_time} — {config.closing_time}</span>
            </div>
          )}

          {config?.working_days && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>📅</span>
              <span>
                Working Days:{' '}
                {(config.working_days as number[]).map((d) => dayNames[d]).join(', ')}
              </span>
            </div>
          )}

          {tenant.address_en && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>📍</span>
              <span>{tenant.address_en}</span>
            </div>
          )}

          {tenant.phone && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>📞</span>
              <a href={`tel:${tenant.phone}`} className="text-teal-600 hover:underline">
                {tenant.phone}
              </a>
            </div>
          )}

          {config?.turnaround_hours && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>⏱️</span>
              <span>Turnaround: {config.turnaround_hours} hours</span>
            </div>
          )}

          {/* Badges */}
          <div className="flex flex-wrap gap-2 pt-2">
            {config?.accepts_walk_ins && (
              <span className="text-xs bg-green-50 text-green-700 px-3 py-1 rounded-full font-medium">
                Walk-ins accepted
              </span>
            )}
            {config?.home_collection && (
              <span className="text-xs bg-amber-50 text-amber-700 px-3 py-1 rounded-full font-medium">
                Home collection
                {config.home_collection_fee_egp && ` (EGP ${config.home_collection_fee_egp})`}
              </span>
            )}
          </div>
        </div>

        {/* Services */}
        {Object.keys(servicesByCategory).length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Available Services</h2>

            {Object.entries(servicesByCategory).map(([category, categoryServices]) => (
              <div key={category} className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="bg-gray-50 px-5 py-3 border-b border-gray-100">
                  <h3 className="font-medium text-gray-700">{category}</h3>
                </div>
                <div className="divide-y divide-gray-50">
                  {(categoryServices ?? []).map((svc) => (
                    <div key={svc.id} className="px-5 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{svc.name_en}</p>
                        <div className="flex gap-2 mt-1">
                          {svc.fasting_required && (
                            <span className="text-xs text-red-600">Fasting required</span>
                          )}
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-teal-700">
                        EGP {svc.price_egp}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Chain Branches Section */}
        {matchedChain && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Lab Branches</h2>
              <Link
                href={`/en/lab/${tenant.slug}/branches`}
                className="text-sm text-teal-600 hover:underline"
              >
                View all
              </Link>
            </div>
            <ChainBranchFinder
              chainCode={matchedChain.code}
              chainNameAr={matchedChain.name_ar}
              chainNameEn={matchedChain.name_en}
              lang="en"
            />
          </div>
        )}

        {/* Book Button */}
        <div className="sticky bottom-4">
          <Link
            href={`/en/lab/${tenant.slug}/book`}
            className="block w-full text-center bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3.5 rounded-xl shadow-lg transition-colors"
          >
            Book Appointment
          </Link>
        </div>
      </div>
    </div>
  );
}
