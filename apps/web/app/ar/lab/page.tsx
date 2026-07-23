import { createServerClient } from '@triaji/shared/supabase';
import Link from 'next/link';

// ─── Arabic Lab Directory ───────────────────────────────────────────────────

export const dynamic = 'force-dynamic';

export default async function LabDirectoryPage() {
  const supabase = createServerClient();

  const { data: labs } = await supabase
    .from('tenants')
    .select(`
      id,
      name_ar,
      slug,
      logo_url,
      tier,
      address_ar,
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
    .order('name_ar', { ascending: true });

  const labList = labs ?? [];

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Header */}
      <header className="bg-teal-700 text-white py-8 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-2xl font-bold">المعامل ومراكز الأشعة</h1>
          <p className="text-teal-100 mt-2">ابحث عن أقرب معمل تحاليل أو مركز أشعة</p>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Lab count */}
        <p className="text-sm text-gray-500 mb-4">
          {labList.length} {labList.length === 1 ? 'نتيجة' : 'نتائج'}
        </p>

        {labList.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <p className="text-gray-400 text-lg mb-2">لا توجد معامل مسجلة حاليا</p>
            <p className="text-gray-400 text-sm">سيتم إضافة المعامل قريبا</p>
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
                        alt={lab.name_ar}
                        className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-lg bg-teal-100 flex items-center justify-center text-teal-700 text-xl font-bold flex-shrink-0">
                        {isRadiology ? '🔬' : '🧪'}
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <h2 className="font-semibold text-gray-900 text-lg">
                        {lab.name_ar}
                      </h2>

                      <span className={`inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                        isRadiology
                          ? 'bg-purple-50 text-purple-700'
                          : 'bg-blue-50 text-blue-700'
                      }`}>
                        {isRadiology ? 'مركز أشعة' : 'معمل تحاليل'}
                      </span>

                      {lab.address_ar && (
                        <p className="text-sm text-gray-500 mt-2">{lab.address_ar}</p>
                      )}

                      {lab.phone && (
                        <p className="text-sm text-gray-500 mt-1">
                          هاتف:{' '}
                          <a href={`tel:${lab.phone}`} dir="ltr" className="text-teal-600 hover:underline">
                            {lab.phone}
                          </a>
                        </p>
                      )}

                      {/* Badges */}
                      <div className="flex flex-wrap gap-2 mt-3">
                        {config?.accepts_walk_ins && (
                          <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">
                            يقبل الحضور المباشر
                          </span>
                        )}
                        {config?.home_collection && (
                          <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">
                            سحب عينات منزلي
                          </span>
                        )}
                        {config?.turnaround_hours && (
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                            النتائج خلال {config.turnaround_hours} ساعة
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-100">
                    <Link
                      href={`/ar/lab/${lab.slug}`}
                      className="block w-full text-center bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
                    >
                      عرض التفاصيل
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
