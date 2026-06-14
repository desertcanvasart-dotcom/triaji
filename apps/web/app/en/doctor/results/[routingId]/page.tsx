import { createServerClient } from '@triaji/shared/supabase';
import { notFound } from 'next/navigation';

// ─── English Doctor Results View (Clinical Format) ──────────────────────────

interface LabValue {
  test_name_ar?: string;
  test_name_en?: string;
  test_code?: string;
  value?: string | number;
  unit?: string;
  reference_range?: string;
  reference_min?: number;
  reference_max?: number;
  is_abnormal?: boolean;
}

interface Props {
  params: Promise<{ routingId: string }>;
}

export default async function DoctorResultsPage({ params }: Props) {
  const { routingId } = await params;
  const supabase = createServerClient();

  const { data: routing } = await supabase
    .from('lab_order_routing')
    .select(`
      id,
      status,
      is_urgent,
      results_ready_at,
      routed_at,
      received_at,
      sample_collected_at,
      delivered_at,
      routing_note_ar,
      lab_tenant_id,
      doctor_id,
      patient_id,
      health_record_id,
      result_health_record_id,
      tenants!lab_tenant_id (name_en, slug, tier),
      doctors (name_en, name_ar),
      patients (name_ar, phone_number)
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

  let orderRecord = null;
  if (routing.health_record_id) {
    const { data } = await supabase
      .from('health_records')
      .select('id, record_type, lab_values, summary_en')
      .eq('id', routing.health_record_id)
      .single();
    orderRecord = data;
  }

  const lab = routing.tenants as unknown as { name_en: string; slug: string; tier: string } | null;
  const doctor = routing.doctors as unknown as { name_en: string; name_ar: string } | null;
  const patient = routing.patients as unknown as { name_ar: string; phone_number: string } | null;
  const labValues = (resultRecord?.lab_values ?? []) as LabValue[];
  const isRadiology = lab?.tier === 'radiology';
  const resultsReady = routing.status === 'results_ready' || routing.status === 'delivered';
  const abnormalValues = labValues.filter((lv) => lv.is_abnormal);

  return (
    <div className="min-h-screen bg-gray-50" dir="ltr">
      {/* Header */}
      <header className="bg-[#1A2F4A] text-white py-6 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">Results Report — Clinical View</h1>
              {lab && <p className="text-gray-300 text-sm mt-1">{lab.name_en}</p>}
            </div>
            {routing.is_urgent && (
              <span className="bg-red-500 text-white text-xs px-3 py-1 rounded-full font-medium">Urgent</span>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Patient + Order Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl shadow-sm p-5 space-y-2">
            <h2 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">Patient Information</h2>
            {patient && (
              <>
                <p className="text-sm text-gray-700">Name: {patient.name_ar ?? '—'}</p>
                <p className="text-sm text-gray-700">Phone: {patient.phone_number}</p>
              </>
            )}
          </div>
          <div className="bg-white rounded-xl shadow-sm p-5 space-y-2">
            <h2 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">Order Details</h2>
            <p className="text-sm text-gray-700">Status: {
              routing.status === 'results_ready' ? 'Results Ready' :
              routing.status === 'delivered' ? 'Delivered' :
              routing.status === 'processing' ? 'Processing' :
              routing.status
            }</p>
            {resultRecord?.lab_date && (
              <p className="text-sm text-gray-700">Test Date: {resultRecord.lab_date}</p>
            )}
            {routing.results_ready_at && (
              <p className="text-sm text-gray-700">
                Results Date: {new Date(routing.results_ready_at).toLocaleDateString('en-US')}
              </p>
            )}
          </div>
        </div>

        {/* Status — if not ready */}
        {!resultsReady && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center">
            <p className="text-amber-800 font-medium">Results not available yet</p>
            <div className="mt-3 text-sm text-amber-700 space-y-1">
              {routing.routed_at && <p>Routed: {new Date(routing.routed_at).toLocaleString('en-US')}</p>}
              {routing.received_at && <p>Received: {new Date(routing.received_at).toLocaleString('en-US')}</p>}
              {routing.sample_collected_at && <p>Sample Collected: {new Date(routing.sample_collected_at).toLocaleString('en-US')}</p>}
            </div>
          </div>
        )}

        {/* Clinical Results */}
        {resultsReady && resultRecord && (
          <>
            {/* Abnormal Summary */}
            {abnormalValues.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-5">
                <h2 className="font-semibold text-red-900 mb-3">⚠️ Abnormal Values ({abnormalValues.length})</h2>
                <div className="space-y-2">
                  {abnormalValues.map((lv, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <span className="text-red-800 font-medium">
                        {lv.test_name_en ?? lv.test_name_ar}
                        {lv.test_code && <span className="text-red-500 text-xs ml-2">({lv.test_code})</span>}
                      </span>
                      <span className="text-red-900 font-bold">
                        {lv.value} {lv.unit ?? ''}
                        {lv.reference_range && (
                          <span className="text-red-500 text-xs font-normal ml-2">
                            (ref: {lv.reference_range})
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Full Results Table — Blood Tests */}
            {!isRadiology && labValues.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="bg-gray-50 px-5 py-3 border-b border-gray-100">
                  <h2 className="font-semibold text-gray-900">Detailed Results</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="text-left px-5 py-3 font-medium">Test</th>
                        <th className="text-left px-5 py-3 font-medium">Code</th>
                        <th className="text-center px-5 py-3 font-medium">Result</th>
                        <th className="text-center px-5 py-3 font-medium">Unit</th>
                        <th className="text-center px-5 py-3 font-medium">Reference Range</th>
                        <th className="text-center px-5 py-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {labValues.map((lv, idx) => (
                        <tr key={idx} className={lv.is_abnormal ? 'bg-red-50/50' : ''}>
                          <td className="px-5 py-3 font-medium text-gray-900">
                            {lv.test_name_en ?? lv.test_name_ar}
                          </td>
                          <td className="px-5 py-3 text-gray-500 text-xs">{lv.test_code ?? '—'}</td>
                          <td className="px-5 py-3 text-center font-semibold text-gray-900">
                            {lv.value}
                          </td>
                          <td className="px-5 py-3 text-center text-gray-500">{lv.unit ?? '—'}</td>
                          <td className="px-5 py-3 text-center text-gray-500">
                            {lv.reference_range ?? (lv.reference_min != null && lv.reference_max != null
                              ? `${lv.reference_min} - ${lv.reference_max}`
                              : '—')}
                          </td>
                          <td className="px-5 py-3 text-center">
                            {lv.is_abnormal ? (
                              <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">⚠️</span>
                            ) : (
                              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">✓</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Radiology Report — Clinical */}
            {isRadiology && (
              <div className="bg-white rounded-xl shadow-sm p-5 space-y-3">
                <h2 className="font-semibold text-gray-900">Radiology Report</h2>
                {resultRecord.summary_en && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap font-mono">
                      {resultRecord.summary_en}
                    </p>
                  </div>
                )}
                {resultRecord.file_url && (
                  <a
                    href={resultRecord.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-teal-50 text-teal-700 text-sm px-4 py-2 rounded-lg hover:bg-teal-100 transition-colors"
                  >
                    📥 Download File ({resultRecord.file_name})
                  </a>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
