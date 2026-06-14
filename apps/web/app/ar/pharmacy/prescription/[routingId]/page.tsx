import { createServerClient } from '@triaji/shared/supabase';
import { notFound } from 'next/navigation';

// ─── Arabic Prescription Status ─────────────────────────────────────────────

interface Props {
  params: Promise<{ routingId: string }>;
}

type RoutingStatus = 'routed' | 'received' | 'checking_stock' | 'ready' | 'partial_ready' | 'collected';

interface TimelineStep {
  key: RoutingStatus | 'sent';
  label: string;
  time: string | null;
  state: 'done' | 'current' | 'upcoming';
}

function formatTime(dateStr: string | null): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString('ar-EG', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

const STATUS_ORDER: RoutingStatus[] = ['routed', 'received', 'checking_stock', 'ready', 'collected'];

function getStatusIndex(status: RoutingStatus): number {
  // partial_ready maps to same position as ready
  if (status === 'partial_ready') return STATUS_ORDER.indexOf('ready');
  return STATUS_ORDER.indexOf(status);
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
      stock_checked_at,
      ready_at,
      collected_at,
      pharmacy_tenant_id,
      prescription_id,
      tenants!pharmacy_tenant_id (name_ar, slug, address_ar, phone),
      prescriptions (doctor_name_ar, patient_name)
    `)
    .eq('id', routingId)
    .single();

  if (!routing) notFound();

  const pharmacy = routing.tenants as unknown as { name_ar: string; slug: string; address_ar: string; phone: string } | null;
  const prescription = routing.prescriptions as unknown as { doctor_name_ar: string; patient_name: string } | null;
  const currentStatus = routing.status as RoutingStatus;
  const currentIdx = getStatusIndex(currentStatus);

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

  const steps: TimelineStep[] = [
    {
      key: 'sent',
      label: 'تم إرسال الروشتة',
      time: routing.routed_at,
      state: currentIdx >= 0 ? 'done' : 'upcoming',
    },
    {
      key: 'received',
      label: 'استلمت الصيدلية الروشتة',
      time: routing.received_at,
      state: currentIdx >= 1 ? 'done' : currentIdx === 0 ? 'current' : 'upcoming',
    },
    {
      key: 'checking_stock',
      label: 'جاري التحضير',
      time: routing.stock_checked_at,
      state: currentIdx >= 3 ? 'done' : currentIdx === 2 ? 'current' : currentIdx === 1 ? 'current' : 'upcoming',
    },
    {
      key: 'ready',
      label: currentStatus === 'partial_ready' ? 'جاهزة جزئياً' : 'جاهزة للاستلام',
      time: routing.ready_at,
      state: currentIdx >= 3 ? (currentIdx > 3 ? 'done' : 'current') : 'upcoming',
    },
    {
      key: 'collected',
      label: 'تم الاستلام',
      time: routing.collected_at,
      state: currentIdx >= 4 ? 'done' : 'upcoming',
    },
  ];

  // Adjust: if current status is exactly at a step, mark it current
  const adjustedSteps = steps.map((step, idx) => {
    if (currentStatus === 'routed' && idx === 0) return { ...step, state: 'done' as const };
    if (currentStatus === 'routed' && idx === 1) return { ...step, state: 'current' as const };
    if (currentStatus === 'received' && idx <= 1) return { ...step, state: 'done' as const };
    if (currentStatus === 'received' && idx === 2) return { ...step, state: 'current' as const };
    if ((currentStatus === 'checking_stock') && idx <= 2) return { ...step, state: 'done' as const };
    if ((currentStatus === 'checking_stock') && idx === 3) return { ...step, state: 'current' as const };
    if ((currentStatus === 'ready' || currentStatus === 'partial_ready') && idx <= 3) return { ...step, state: 'done' as const };
    if ((currentStatus === 'ready' || currentStatus === 'partial_ready') && idx === 3) return { ...step, state: 'current' as const };
    if (currentStatus === 'collected' && idx <= 4) return { ...step, state: 'done' as const };
    return step;
  });

  const isReady = currentStatus === 'ready' || currentStatus === 'partial_ready';

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Header */}
      <header className="bg-emerald-700 text-white py-6 px-4">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-xl font-bold">
            روشتتك في {pharmacy?.name_ar ?? 'الصيدلية'}
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
            {adjustedSteps.map((step, idx) => (
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
                  {idx < adjustedSteps.length - 1 && (
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
                    <p className="text-xs text-gray-400 mt-0.5" dir="ltr">
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
            ⚠️ لازم تاخد معاك الروشتة الأصلية
          </p>
        </div>

        {/* Pharmacy Details (when ready) */}
        {isReady && pharmacy && (
          <div className="bg-white rounded-xl shadow-sm p-5 space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">بيانات الصيدلية</h2>

            {pharmacy.address_ar && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>📍</span>
                <span>{pharmacy.address_ar}</span>
              </div>
            )}

            {pharmacy.phone && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>📞</span>
                <a href={`tel:${pharmacy.phone}`} dir="ltr" className="text-emerald-600 hover:underline">
                  {pharmacy.phone}
                </a>
              </div>
            )}

            {pharmacyConfig?.opening_time && pharmacyConfig?.closing_time && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>🕐</span>
                <span>ساعات العمل: {pharmacyConfig.opening_time} — {pharmacyConfig.closing_time}</span>
              </div>
            )}
          </div>
        )}

        {/* Reference */}
        <div className="text-center">
          <p className="text-xs text-gray-400">
            رقم المرجع: <span className="font-mono" dir="ltr">{routingId}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
