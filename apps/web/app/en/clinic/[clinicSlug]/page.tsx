import { createServerClient } from '@triaji/shared/supabase';
import { notFound } from 'next/navigation';
import ClinicBookingClient from './ClinicBookingClient';

interface Props {
  params: Promise<{ clinicSlug: string }>;
}

const DAY_NAMES_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default async function ClinicPage({ params }: Props) {
  const { clinicSlug } = await params;
  const supabase = createServerClient();

  // Fetch clinic (tenant) by slug
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, name_ar, name_en, slug, logo_url, tier')
    .eq('slug', clinicSlug)
    .eq('tier', 'clinic')
    .eq('is_active', true)
    .single();

  if (!tenant) notFound();

  // Fetch clinic config
  const { data: config } = await supabase
    .from('tenant_config')
    .select('clinic_specialty_ar, clinic_specialty_en, clinic_floor_ar, clinic_phone, opening_time, closing_time, working_days, clinic_booking_mode, estimated_minutes_per_patient')
    .eq('tenant_id', tenant.id)
    .single();

  const bookingMode = config?.clinic_booking_mode ?? 'walk_in_only';

  // Fetch doctors
  const { data: doctors } = await supabase
    .from('doctors')
    .select('id, name_ar, name_en, title_ar, photo_url, specialties(name_ar, name_en)')
    .eq('tenant_id', tenant.id)
    .eq('is_active', true)
    .order('name_ar', { ascending: true });

  const clinicDisplayName = tenant.name_en ?? tenant.name_ar;

  return (
    <div className="min-h-screen bg-gray-50" dir="ltr">
      {/* Clinic Header */}
      <header className="bg-teal-700 text-white py-8 px-4">
        <div className="max-w-3xl mx-auto text-center">
          {tenant.logo_url && (
            <img
              src={tenant.logo_url}
              alt={clinicDisplayName}
              className="w-20 h-20 rounded-full mx-auto mb-4 border-2 border-white/20"
            />
          )}
          <h1 className="text-2xl font-bold">{clinicDisplayName}</h1>
          {(config?.clinic_specialty_en ?? config?.clinic_specialty_ar) && (
            <p className="text-teal-100 mt-1">{config?.clinic_specialty_en ?? config?.clinic_specialty_ar}</p>
          )}
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Clinic Info */}
        <div className="bg-white rounded-xl shadow-sm p-5 space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">Clinic information</h2>

          {config?.opening_time && config?.closing_time && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>🕐</span>
              <span>
                Working hours: {config.opening_time} — {config.closing_time}
              </span>
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

          {config?.clinic_floor_ar && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>📍</span>
              <span>{config.clinic_floor_ar}</span>
            </div>
          )}

          {config?.clinic_phone && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>📞</span>
              <a href={`tel:${config.clinic_phone}`} className="text-teal-600 hover:underline">
                {config.clinic_phone}
              </a>
            </div>
          )}
        </div>

        {/* Walk-in Only Mode */}
        {bookingMode === 'walk_in_only' && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center">
            <span className="text-3xl block mb-2">🚶</span>
            <p className="text-sm font-medium text-amber-800">
              This clinic operates on a walk-in basis
            </p>
            <p className="text-xs text-amber-600 mt-1">
              Arrive during working hours and join the queue
            </p>
          </div>
        )}

        {/* Doctors List */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Doctors</h2>
          {(doctors ?? []).map((doctor) => (
            <div key={doctor.id} className="bg-white rounded-xl shadow-sm p-5">
              <div className="flex items-center gap-4">
                {doctor.photo_url ? (
                  <img
                    src={doctor.photo_url}
                    alt={doctor.name_en ?? doctor.name_ar}
                    className="w-14 h-14 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 text-xl font-bold">
                    {((doctor.name_en ?? doctor.name_ar) as string)?.[0] ?? ''}
                  </div>
                )}
                <div>
                  <p className="font-semibold text-gray-900">
                    Dr. {doctor.name_en ?? doctor.name_ar}
                  </p>
                  {doctor.specialties && (
                    <p className="text-xs text-gray-500">
                      {(doctor.specialties as unknown as { name_en: string; name_ar: string })?.name_en ??
                        (doctor.specialties as unknown as { name_ar: string })?.name_ar ?? ''}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Booking Section — only for slots_only or both */}
        {(bookingMode === 'slots_only' || bookingMode === 'both') && (
          <ClinicBookingClient
            tenantId={tenant.id}
            clinicName={clinicDisplayName}
            doctors={(doctors ?? []).map((d) => ({
              id: d.id as string,
              name_en: (d.name_en as string) ?? (d.name_ar as string),
              name_ar: d.name_ar as string,
              title_ar: (d.title_ar as string) ?? 'Dr.',
            }))}
            bookingMode={bookingMode}
          />
        )}

        {/* "Both" mode hint */}
        {bookingMode === 'both' && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
            <p className="text-sm text-gray-500">
              Walk-ins also accepted — join the queue during working hours 🚶
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
