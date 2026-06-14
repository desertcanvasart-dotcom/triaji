import { createServerClient } from '@triaji/shared/supabase';
import { notFound } from 'next/navigation';
import Link from 'next/link';

// ─── English Patient Results View ───────────────────────────────────────────

interface LabValue {
  test_name_ar?: string;
  test_name_en?: string;
  value?: string | number;
  unit?: string;
  reference_range?: string;
  is_abnormal?: boolean;
}

interface Props {
  params: Promise<{ routingId: string }>;
}

export default async function PatientResultsPage({ params }: Props) {
  const { routingId } = await params;
  const supabase = createServerClient();

  // Fetch routing with result health record
  const { data: routing } = await supabase
    .from('lab_order_routing')
    .select(`
      id,
      status,
      is_urgent,
      results_ready_at,
      lab_tenant_id,
      doctor_id,
      health_record_id,
      result_health_record_id,
      tenants!lab_tenant_id (name_en, slug, tier),
      doctors (name_en, name_ar, title_ar)
    `)
    .eq('id', routingId)
    .single();

  if (!routing) notFound();

  let resultRecord = null;
  if (routing.result_health_record_id) {
    const { data } = await supabase
      .from('health_records')
      .select('id, record_type, lab_values, lab_date, lab_name, file_url, file_name, summary_en, has_abnormal_values')
      .eq('id', routing.result_health_record_id)
      .single();
    resultRecord = data;
  }

  const lab = routing.tenants as unknown as { name_en: string; slug: string; tier: string } | null;
  const doctor = routing.doctors as unknown as { name_en: string; name_ar: string; title_ar: string } | null;
  const labValues = (resultRecord?.lab_values ?? []) as LabValue[];
  const isRadiology = lab?.tier === 'radiology';
  const resultsReady = routing.status === 'results_ready' || routing.status === 'delivered';

  return (
    <div className="min-h-screen bg-gray-50" dir="ltr">
      {/* Header */}
      <header className="bg-teal-700 text-white py-6 px-4">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-xl font-bold">Lab Results</h1>
          {lab && <p className="text-teal-200 text-sm mt-1">{lab.name_en}</p>}
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Status */}
        {!resultsReady && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center">
            <span className="text-3xl block mb-2">⏳</span>
            <p className="text-amber-800 font-medium">Results not ready yet</p>
            <p className="text-amber-600 text-sm mt-1">
              Status: {routing.status === 'sample_collected' ? 'Sample collected' :
                routing.status === 'processing' ? 'Processing' :
                routing.status === 'received' ? 'Received' :
                routing.status === 'routed' ? 'Routed' : routing.status}
            </p>
          </div>
        )}

        {/* Order Info */}
        <div className="bg-white rounded-xl shadow-sm p-5 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Order Information</h2>
            {routing.is_urgent && (
              <span className="text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded-full">Urgent</span>
            )}
          </div>
          {lab && <p className="text-sm text-gray-600">Lab: {lab.name_en}</p>}
          {doctor && <p className="text-sm text-gray-600">Doctor: Dr. {doctor.name_en || doctor.name_ar}</p>}
          {resultRecord?.lab_date && (
            <p className="text-sm text-gray-600">Test Date: {resultRecord.lab_date}</p>
          )}
        </div>

        {/* Results */}
        {resultsReady && resultRecord && (
          <>
            {/* Blood Test Results */}
            {!isRadiology && labValues.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="bg-gray-50 px-5 py-3 border-b border-gray-100">
                  <h2 className="font-semibold text-gray-900">Test Results</h2>
                </div>
                <div className="divide-y divide-gray-50">
                  {labValues.map((lv, idx) => (
                    <div key={idx} className="px-5 py-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {lv.test_name_en ?? lv.test_name_ar ?? 'Test'}
                        </p>
                      </div>
                      <div className="text-right flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900">
                          {lv.value} {lv.unit ?? ''}
                        </span>
                        {lv.is_abnormal ? (
                          <span className="text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded-full">⚠️ Abnormal</span>
                        ) : (
                          <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">✓ Normal</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Radiology Report */}
            {isRadiology && (
              <div className="bg-white rounded-xl shadow-sm p-5 space-y-3">
                <h2 className="font-semibold text-gray-900">Radiology Report</h2>
                {resultRecord.summary_en && (
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {resultRecord.summary_en}
                  </p>
                )}
                {resultRecord.file_url && (
                  <a
                    href={resultRecord.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-teal-600 hover:underline mt-2"
                  >
                    📥 Download File ({resultRecord.file_name})
                  </a>
                )}
              </div>
            )}

            {/* Patient-friendly summary */}
            {resultRecord.summary_en && !isRadiology && (
              <div className="bg-blue-50 rounded-xl p-5">
                <h3 className="font-semibold text-blue-900 mb-2">Summary</h3>
                <p className="text-sm text-blue-800 leading-relaxed">{resultRecord.summary_en}</p>
              </div>
            )}

            {resultRecord.has_abnormal_values && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-sm text-amber-800">
                  ⚠️ Some results are outside the normal range. Please consult your doctor.
                </p>
              </div>
            )}
          </>
        )}

        {/* Doctor Results Link */}
        {doctor && (
          <div className="text-center">
            <Link
              href={`/en/doctor/results/${routingId}`}
              className="text-sm text-teal-600 hover:underline"
            >
              View detailed clinical report (for doctor)
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
