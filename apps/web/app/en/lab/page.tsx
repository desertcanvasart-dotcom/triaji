import { createServerClient } from '@triaji/shared/supabase';
import Link from 'next/link';

// ─── English Lab Directory ──────────────────────────────────────────────────

export default async function LabDirectoryPage() {
  const supabase = createServerClient();

  const { data: labs } = await supabase
    .from('tenants')
    .select(`
      id,
      name_en,
      slug,
      logo_url,
      tier,
      address_en,
      phone,
      tenant_config (
        lab_type,
        turnaround_hours,
        accepts_walk_ins,
        home_collection,
        opening_time,
        closing_time
      )
    `)
    .in('tier', ['lab', 'radiology'])
    .eq('is_active', true)
    .order('name_en', { ascending: true });

  const labList = labs ?? [];

  return (
    <div className="min-h-screen bg-gray-50" dir="ltr">
      {/* Header */}
      <header className="bg-teal-700 text-white py-8 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-2xl font-bold">Labs & Radiology Centers</h1>
          <p className="text-teal-100 mt-2">Find the nearest lab or imaging center</p>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Lab count */}
        <p className="text-sm text-gray-500 mb-4">
          {labList.length} {labList.length === 1 ? 'result' : 'results'}
        </p>

        {labList.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <p className="text-gray-400 text-lg mb-2">No labs registered yet</p>
            <p className="text-gray-400 text-sm">Labs will be added soon</p>
          </div>
        ) : (
          <div className="space-y-4">
            {labList.map((lab) => {
              const config = Array.isArray(lab.tenant_config)
                ? lab.tenant_config[0]
                : lab.tenant_config;
              const isRadiology = lab.tier === 'radiology';

              return (
                <div key={lab.id} className="bg-white rounded-xl shadow-sm p-5">
                  <div className="flex items-start gap-4">
                    {lab.logo_url ? (
                      <img
                        src={lab.logo_url}
                        alt={lab.name_en ?? ''}
                        className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-lg bg-teal-100 flex items-center justify-center text-teal-700 text-xl font-bold flex-shrink-0">
                        {isRadiology ? '🔬' : '🧪'}
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <h2 className="font-semibold text-gray-900 text-lg">
                        {lab.name_en}
                      </h2>

                      <span className={`inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                        isRadiology
                          ? 'bg-purple-50 text-purple-700'
                          : 'bg-blue-50 text-blue-700'
                      }`}>
                        {isRadiology ? 'Radiology Center' : 'Lab'}
                      </span>

                      {lab.address_en && (
                        <p className="text-sm text-gray-500 mt-2">{lab.address_en}</p>
                      )}

                      {lab.phone && (
                        <p className="text-sm text-gray-500 mt-1">
                          Phone:{' '}
                          <a href={`tel:${lab.phone}`} className="text-teal-600 hover:underline">
                            {lab.phone}
                          </a>
                        </p>
                      )}

                      {/* Badges */}
                      <div className="flex flex-wrap gap-2 mt-3">
                        {config?.accepts_walk_ins && (
                          <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">
                            Walk-ins accepted
                          </span>
                        )}
                        {config?.home_collection && (
                          <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">
                            Home collection available
                          </span>
                        )}
                        {config?.turnaround_hours && (
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                            Results in {config.turnaround_hours}h
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-100">
                    <Link
                      href={`/en/lab/${lab.slug}`}
                      className="block w-full text-center bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
                    >
                      View Details
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
