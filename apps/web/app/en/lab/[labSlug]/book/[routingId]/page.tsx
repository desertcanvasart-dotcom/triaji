import { createServerClient } from '@triaji/shared/supabase';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';

// ─── English Order-Linked Booking ───────────────────────────────────────────

interface Props {
  params: Promise<{ labSlug: string; routingId: string }>;
}

export default async function OrderLinkedBookingPage({ params }: Props) {
  const { labSlug, routingId } = await params;
  const supabase = createServerClient();

  // Fetch routing record
  const { data: routing } = await supabase
    .from('lab_order_routing')
    .select(`
      id,
      health_record_id,
      lab_tenant_id,
      doctor_id,
      patient_id,
      is_urgent,
      status,
      routing_note_ar,
      doctors (name_en, name_ar, title_ar),
      health_records (
        record_type,
        lab_values,
        summary_en
      )
    `)
    .eq('id', routingId)
    .single();

  if (!routing) notFound();

  // Fetch lab tenant
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, name_en, slug, logo_url, tier')
    .eq('slug', labSlug)
    .in('tier', ['lab', 'radiology'])
    .eq('is_active', true)
    .single();

  if (!tenant) notFound();

  // Fetch lab config
  const { data: config } = await supabase
    .from('tenant_config')
    .select('accepts_walk_ins, home_collection, home_collection_fee_egp, turnaround_hours')
    .eq('tenant_id', tenant.id)
    .single();

  const labValues = (routing.health_records as { lab_values?: unknown[] } | null)?.lab_values ?? [];
  const hasFasting = Array.isArray(labValues) && labValues.some(
    (v: unknown) => (v as { fasting_required?: boolean })?.fasting_required
  );

  const doctor = routing.doctors as unknown as { name_en: string; name_ar: string; title_ar: string } | null;
  const acceptsWalkIns = config?.accepts_walk_ins ?? true;
  const hasHomeCollection = config?.home_collection ?? false;

  async function createBooking(formData: FormData) {
    'use server';

    const bookingType = formData.get('booking_type') as string;
    const patientName = formData.get('patient_name') as string;
    const patientPhone = formData.get('patient_phone') as string;
    const appointmentDate = formData.get('appointment_date') as string;
    const appointmentTime = formData.get('appointment_time') as string;
    const collectionAddress = formData.get('collection_address') as string;

    if (!patientName || !patientPhone) return;

    const sb = createServerClient();

    const appointmentDatetime = bookingType === 'scheduled' && appointmentDate && appointmentTime
      ? `${appointmentDate}T${appointmentTime}:00`
      : null;

    const { data: appointment, error } = await sb
      .from('lab_appointments')
      .insert({
        lab_tenant_id: tenant!.id,
        patient_id: routing!.patient_id,
        patient_name_ar: patientName,
        patient_phone: patientPhone,
        lab_order_routing_id: routingId,
        appointment_datetime: appointmentDatetime,
        is_walk_in: bookingType === 'walk_in',
        is_home_collection: bookingType === 'home_collection',
        collection_address_ar: bookingType === 'home_collection' ? collectionAddress : null,
        status: 'scheduled',
      })
      .select('id')
      .single();

    if (error || !appointment) return;

    await sb
      .from('lab_order_routing')
      .update({
        status: 'received',
        received_at: new Date().toISOString(),
        lab_appointment_id: appointment.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', routingId);

    redirect(`/en/lab/${labSlug}?booked=true`);
  }

  return (
    <div className="min-h-screen bg-gray-50" dir="ltr">
      {/* Header */}
      <header className="bg-teal-700 text-white py-6 px-4">
        <div className="max-w-3xl mx-auto">
          <Link href={`/en/lab/${tenant.slug}`} className="text-teal-200 hover:text-white text-sm">
            ← {tenant.name_en}
          </Link>
          <h1 className="text-xl font-bold mt-2">Book Appointment — Doctor Order</h1>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Doctor's Order Info */}
        <div className="bg-white rounded-xl shadow-sm p-5 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">👨‍⚕️</span>
            <h2 className="text-lg font-semibold text-gray-900">Doctor&apos;s Order</h2>
          </div>

          {doctor && (
            <p className="text-sm text-gray-600">
              Dr. {doctor.name_en || doctor.name_ar}
            </p>
          )}

          {routing.routing_note_ar && (
            <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{routing.routing_note_ar}</p>
          )}

          {routing.is_urgent && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-700 font-medium">🚨 Urgent Order</p>
            </div>
          )}
        </div>

        {/* Fasting Warning */}
        {hasFasting && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-sm text-amber-800 font-medium">⚠️ Fasting Required</p>
            <p className="text-xs text-amber-700 mt-1">
              Some ordered tests require fasting for 8-12 hours. Please do not eat or drink (except water) before your appointment.
            </p>
          </div>
        )}

        {/* Booking Form */}
        <form action={createBooking} className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm p-5 space-y-3">
            <h3 className="font-semibold text-gray-900">Booking Type</h3>

            {acceptsWalkIns && (
              <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input type="radio" name="booking_type" value="walk_in" defaultChecked className="w-5 h-5 text-teal-600" />
                <div>
                  <p className="font-medium text-gray-900">🚶 Walk-in</p>
                  <p className="text-xs text-gray-500">Visit the lab during working hours</p>
                </div>
              </label>
            )}

            <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer">
              <input type="radio" name="booking_type" value="scheduled" className="w-5 h-5 text-teal-600" />
              <div>
                <p className="font-medium text-gray-900">📅 Scheduled Appointment</p>
                <p className="text-xs text-gray-500">Book a convenient time</p>
              </div>
            </label>

            {hasHomeCollection && (
              <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input type="radio" name="booking_type" value="home_collection" className="w-5 h-5 text-teal-600" />
                <div>
                  <p className="font-medium text-gray-900">🏠 Home Collection</p>
                  <p className="text-xs text-gray-500">
                    A technician visits your home
                    {config?.home_collection_fee_egp && (
                      <span className="text-amber-600"> (+EGP {config.home_collection_fee_egp})</span>
                    )}
                  </p>
                </div>
              </label>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm p-5 space-y-3">
            <h3 className="font-semibold text-gray-900">Date & Time (for scheduled)</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Date</label>
                <input
                  type="date"
                  name="appointment_date"
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Time</label>
                <input
                  type="time"
                  name="appointment_time"
                  className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-5 space-y-3">
            <h3 className="font-semibold text-gray-900">Your Information</h3>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Full Name</label>
              <input
                type="text"
                name="patient_name"
                required
                placeholder="Enter your full name"
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Phone Number</label>
              <input
                type="tel"
                name="patient_phone"
                required
                placeholder="01xxxxxxxxx"
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Address (for home collection)</label>
              <textarea
                name="collection_address"
                placeholder="Enter your full address..."
                rows={2}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3.5 rounded-xl transition-colors"
          >
            Confirm Booking
          </button>
        </form>
      </div>
    </div>
  );
}
