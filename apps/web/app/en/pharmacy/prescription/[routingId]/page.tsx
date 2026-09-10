import { createServerClient } from '@triaji/shared/supabase';
import { notFound } from 'next/navigation';

// ─── English Prescription Status ────────────────────────────────────────────

interface Props {
  params: Promise<{ routingId: string }>;
}

type RoutingStatus = 'routed' | 'received' | 'checking_stock' | 'ready' | 'partial_ready' | 'collected';

interface TimelineStep {
  key: string;
  label: string;
  time: string | null;
  state: 'done' | 'current' | 'upcoming';
}

function formatTime(dateStr: string | null): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export default async function PrescriptionStatusPage({ params }: Props) {
  const { routingId } = await params;
  const supabase = createServerClient();

  // Fetch prescription routing
  const { data: routing } = await supabase
    .from('prescription_routing')
    .select(`
      id,
      status,
      routed_at,
      received_at,
      ready_at,
      collected_at,
      pharmacy_tenant_id,
      tenants!pharmacy_tenant_id (name_ar, name_en, slug, address_en, address_ar, phone),
      patients:patient_id (name_ar)
    `)
    .eq('id', routingId)
    .single();

  if (!routing) notFound();

  const pharmacy = routing.tenants as unknown as {
    name_ar: string; name_en: string; slug: string;
    address_en: string; address_ar: string; phone: string;
  } | null;
  const patient = (Array.isArray(routing.patients) ? routing.patients[0] : routing.patients) as { name_ar: string } | null;
  const prescription = { patient_name: patient?.name_ar ?? '' };
  const currentStatus = routing.status as RoutingStatus;

  // Fetch pharmacy config for working hours
  let pharmacyConfig: { opening_time?: string; closing_time?: string; prep_time_minutes?: number } | null = null;
  if (routing.pharmacy_tenant_id) {
    const { data } = await supabase
      .from('tenant_config')
      .select('opening_time, closing_time, prep_time_minutes')
      .eq('tenant_id', routing.pharmacy_tenant_id)
      .single();
    pharmacyConfig = data;
  }

  const pharmacyName = pharmacy?.name_en || pharmacy?.name_ar || 'Pharmacy';
  const pharmacyAddress = pharmacy?.address_en || pharmacy?.address_ar;

  // Build timeline steps with state
  function getStepState(stepStatuses: RoutingStatus[]): 'done' | 'current' | 'upcoming' {
    const statusOrder: RoutingStatus[] = ['routed', 'received', 'checking_stock', 'ready', 'collected'];
    const currentIdx = currentStatus === 'partial_ready'
      ? statusOrder.indexOf('ready')
      : statusOrder.indexOf(currentStatus);
    const stepIdx = Math.max(...stepStatuses.map(s => statusOrder.indexOf(s)));

    if (currentIdx > stepIdx) return 'done';
    if (stepStatuses.includes(currentStatus) || (currentStatus === 'partial_ready' && stepStatuses.includes('ready'))) return 'current';
    if (currentIdx === stepIdx) return 'current';
    return 'upcoming';
  }

  const steps: TimelineStep[] = [
    {
      key: 'sent',
      label: 'Prescription sent',
      time: routing.routed_at,
      state: getStepState(['routed']),
    },
    {
      key: 'received',
      label: 'Pharmacy received',
      time: routing.received_at,
      state: getStepState(['received']),
    },
    {
      key: 'preparing',
      label: 'Preparing',
      time: null,
      state: getStepState(['checking_stock']),
    },
    {
      key: 'ready',
      label: currentStatus === 'partial_ready' ? 'Partially ready' : 'Ready for pickup',
      time: routing.ready_at,
      state: getStepState(['ready']),
    },
    {
      key: 'collected',
      label: 'Collected',
      time: routing.collected_at,
      state: getStepState(['collected']),
    },
  ];

  // Fix: first step (sent) should be done if we have routed_at
  if (routing.routed_at && steps[0] && steps[0].state !== 'done' && currentStatus !== 'routed') {
    steps[0] = { ...steps[0], state: 'done' as const };
  }
  if (currentStatus === 'routed' && steps[0] && steps[1]) {
    steps[0] = { ...steps[0], state: 'done' as const };
    steps[1] = { ...steps[1], state: 'current' as const };
  }

  const isReady = currentStatus === 'ready' || currentStatus === 'partial_ready';

  return (
    <div className="min-h-screen bg-gray-50" dir="ltr">
      {/* Header */}
      <header className="bg-emerald-700 text-white py-6 px-4">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-xl font-bold">
            Your prescription at {pharmacyName}
          </h1>
          {prescription?.patient_name && (
            <p className="text-emerald-200 text-sm mt-1">{prescription.patient_name}</p>
          )}
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Timeline */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="space-y-0">
            {steps.map((step, idx) => (
              <div key={step.key} className="flex items-start gap-4">
                {/* Icon column */}
                <div className="flex flex-col items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      step.state === 'done'
                        ? 'bg-emerald-100 text-emerald-700'
                        : step.state === 'current'
                        ? 'bg-emerald-600 text-white animate-pulse'
                        : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    {step.state === 'done' ? '✓' : step.state === 'current' ? '●' : '○'}
                  </div>
                  {idx < steps.length - 1 && (
                    <div
                      className={`w-0.5 h-8 ${
                        step.state === 'done' ? 'bg-emerald-200' : 'bg-gray-200'
                      }`}
                    />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 pb-4">
                  <p
                    className={`text-sm font-medium ${
                      step.state === 'done'
                        ? 'text-gray-900'
                        : step.state === 'current'
                        ? 'text-emerald-700 font-semibold'
                        : 'text-gray-400'
                    }`}
                  >
                    {step.label}
                  </p>
                  {step.time && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {formatTime(step.time)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Warning */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm text-amber-800">
            ⚠️ Please bring your original prescription
          </p>
        </div>

        {/* Pharmacy Details (when ready) */}
        {isReady && pharmacy && (
          <div className="bg-white rounded-xl shadow-sm p-5 space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">Pharmacy Details</h2>

            {pharmacyAddress && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>📍</span>
                <span>{pharmacyAddress}</span>
              </div>
            )}

            {pharmacy.phone && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>📞</span>
                <a href={`tel:${pharmacy.phone}`} className="text-emerald-600 hover:underline">
                  {pharmacy.phone}
                </a>
              </div>
            )}

            {pharmacyConfig?.opening_time && pharmacyConfig?.closing_time && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>🕐</span>
                <span>Working hours: {pharmacyConfig.opening_time} — {pharmacyConfig.closing_time}</span>
              </div>
            )}
          </div>
        )}

        {/* Reference */}
        <div className="text-center">
          <p className="text-xs text-gray-400">
            Reference: <span className="font-mono">{routingId}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
