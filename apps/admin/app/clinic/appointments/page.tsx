import { requireAdmin } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/server';
import Link from 'next/link';

export default async function AppointmentsPage() {
  const admin = await requireAdmin();
  const tenantId = admin.tenant_id;

  if (!tenantId) {
    return (
      <div className="text-center py-20">
        <span className="text-4xl mb-3 block">⚠️</span>
        <p className="text-gray-500">لا يوجد عيادة مرتبطة بحسابك</p>
      </div>
    );
  }

  const supabase = createAdminClient();

  // Fetch active doctors
  const { data: doctors } = await supabase
    .from('doctors')
    .select('id, name_ar, name_en, title_ar')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('name_ar', { ascending: true });

  const today = new Date().toISOString().split('T')[0];

  // Fetch today's bookings per doctor
  const { data: todayBookings } = await supabase
    .from('bookings')
    .select('id, doctor_id, appointment_datetime, status, patient_name, patient_phone')
    .eq('tenant_id', tenantId)
    .gte('appointment_datetime', `${today}T00:00:00`)
    .lte('appointment_datetime', `${today}T23:59:59`)
    .order('appointment_datetime', { ascending: true });

  const bookingsByDoctor = new Map<string, typeof todayBookings>();
  for (const b of todayBookings ?? []) {
    const doctorId = b.doctor_id as string;
    if (!bookingsByDoctor.has(doctorId)) bookingsByDoctor.set(doctorId, []);
    bookingsByDoctor.get(doctorId)!.push(b);
  }

  return (
    <div dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">المواعيد</h1>
        <p className="text-sm text-gray-500">اليوم: {today}</p>
      </div>

      {!doctors || doctors.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl shadow-sm">
          <span className="text-4xl mb-3 block">⚕️</span>
          <p className="text-gray-500">لا يوجد أطباء مسجلين</p>
        </div>
      ) : (
        <div className="space-y-6">
          {doctors.map((doctor) => {
            const bookings = bookingsByDoctor.get(doctor.id as string) ?? [];
            return (
              <div key={doctor.id} className="bg-white rounded-xl shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      {doctor.title_ar ?? 'د.'} {doctor.name_ar}
                    </h2>
                    <p className="text-xs text-gray-400">
                      {bookings.length} موعد اليوم
                    </p>
                  </div>
                  <Link
                    href={`/doctors/${doctor.id}/availability`}
                    className="text-sm text-teal-600 hover:text-teal-700 font-medium"
                  >
                    إدارة الجدول →
                  </Link>
                </div>

                {bookings.length === 0 ? (
                  <p className="text-sm text-gray-400 py-4 text-center">
                    لا توجد مواعيد لهذا اليوم
                  </p>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {bookings.map((booking) => {
                      const time = new Date(booking.appointment_datetime as string)
                        .toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
                      const statusMap: Record<string, { label: string; className: string }> = {
                        pending: { label: 'قادم', className: 'bg-yellow-100 text-yellow-700' },
                        confirmed: { label: 'مؤكد', className: 'bg-blue-100 text-blue-700' },
                        completed: { label: 'مكتمل', className: 'bg-green-100 text-green-700' },
                        cancelled: { label: 'ملغي', className: 'bg-red-100 text-red-600' },
                        no_show: { label: 'لم يحضر', className: 'bg-gray-100 text-gray-600' },
                      };
                      const badge = statusMap[booking.status as string] ?? { label: 'قادم', className: 'bg-yellow-100 text-yellow-700' };

                      return (
                        <div key={booking.id} className="flex items-center justify-between py-3">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-mono text-gray-500 w-16" dir="ltr">
                              {time}
                            </span>
                            <div>
                              <p className="text-sm font-medium text-gray-800">
                                {booking.patient_name ?? 'مريض'}
                              </p>
                              {booking.patient_phone && (
                                <p className="text-xs text-gray-400" dir="ltr">
                                  {booking.patient_phone}
                                </p>
                              )}
                            </div>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.className}`}>
                            {badge.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
