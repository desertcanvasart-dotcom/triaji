import { requireAdmin } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/server';
import { isPlatformAdmin } from '@/lib/auth/types';
import Link from 'next/link';

interface StatCard {
  label: string;
  value: string | number;
  icon: string;
  href?: string;
}

export default async function DashboardPage() {
  const admin = await requireAdmin();
  const supabase = createAdminClient();
  const tenantId = admin.tenant_id;
  const isPA = isPlatformAdmin(admin.role);

  // Fetch stats
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const monthAgo = new Date(today);
  monthAgo.setDate(monthAgo.getDate() - 30);

  // Doctors count
  let doctorsQuery = supabase
    .from('doctors')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true);
  if (!isPA && tenantId) {
    doctorsQuery = doctorsQuery.eq('tenant_id', tenantId);
  }
  const { count: doctorCount } = await doctorsQuery;

  // Today's bookings
  let todayBookingsQuery = supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .gte('appointment_datetime', today.toISOString())
    .lt('appointment_datetime', new Date(today.getTime() + 86400000).toISOString());
  if (!isPA && tenantId) {
    todayBookingsQuery = todayBookingsQuery.eq('tenant_id', tenantId);
  }
  const { count: todayBookings } = await todayBookingsQuery;

  // Pending bookings
  let pendingQuery = supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');
  if (!isPA && tenantId) {
    pendingQuery = pendingQuery.eq('tenant_id', tenantId);
  }
  const { count: pendingBookings } = await pendingQuery;

  // Week sessions
  let sessionsQuery = supabase
    .from('triage_sessions')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', weekAgo.toISOString());
  if (!isPA && tenantId) {
    sessionsQuery = sessionsQuery.eq('tenant_id', tenantId);
  }
  const { count: weekSessions } = await sessionsQuery;

  const tenantStats: StatCard[] = [
    { label: "Today's Bookings", value: todayBookings ?? 0, icon: '📅', href: '/bookings' },
    { label: 'Triage Sessions (7d)', value: weekSessions ?? 0, icon: '💬' },
    { label: 'Pending Bookings', value: pendingBookings ?? 0, icon: '⏳', href: '/bookings' },
    { label: 'Active Doctors', value: doctorCount ?? 0, icon: '👨‍⚕️', href: '/doctors' },
  ];

  // Platform admin extra stats
  let platformStats: StatCard[] = [];
  if (isPA) {
    const { count: tenantCount } = await supabase
      .from('tenants')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true);

    const { count: totalSessions } = await supabase
      .from('triage_sessions')
      .select('id', { count: 'exact', head: true });

    const { count: totalBookings } = await supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true });

    const { count: kbDocs } = await supabase
      .from('kb_documents')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true);

    platformStats = [
      { label: 'Active Tenants', value: tenantCount ?? 0, icon: '🏢', href: '/tenants' },
      { label: 'Total Sessions', value: totalSessions ?? 0, icon: '📊' },
      { label: 'Total Bookings', value: totalBookings ?? 0, icon: '📋' },
      { label: 'KB Documents', value: kbDocs ?? 0, icon: '📚', href: '/knowledge-base' },
    ];
  }

  // Recent bookings
  let recentQuery = supabase
    .from('bookings')
    .select(`
      id,
      appointment_datetime,
      status,
      created_at,
      patients:patient_id(name_ar, phone_number),
      doctors!inner(name_ar, name_en)
    `)
    .order('created_at', { ascending: false })
    .limit(10);
  if (!isPA && tenantId) {
    recentQuery = recentQuery.eq('tenant_id', tenantId);
  }
  const { data: recentBookings } = await recentQuery;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {tenantStats.map((stat) => (
          <StatCardComponent key={stat.label} stat={stat} />
        ))}
      </div>

      {/* Platform admin stats */}
      {isPA && platformStats.length > 0 && (
        <>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Platform Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {platformStats.map((stat) => (
              <StatCardComponent key={stat.label} stat={stat} />
            ))}
          </div>
        </>
      )}

      {/* Quick Links */}
      <div className="flex gap-3 mb-8">
        <Link href="/doctors/new" className="btn-primary">
          Add Doctor
        </Link>
        <Link href="/bookings" className="btn-secondary">
          View Bookings
        </Link>
      </div>

      {/* Recent Bookings */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Bookings</h2>
        {recentBookings && recentBookings.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="table-header px-4 py-3">Patient</th>
                  <th className="table-header px-4 py-3">Doctor</th>
                  <th className="table-header px-4 py-3">Date</th>
                  <th className="table-header px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentBookings.map((b) => {
                  const doctor = b.doctors as unknown as { name_ar: string; name_en: string };
                  const patient = (Array.isArray(b.patients) ? b.patients[0] : b.patients) as
                    | { name_ar?: string | null; phone_number?: string | null }
                    | null
                    | undefined;
                  return (
                    <tr key={b.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm">
                        {patient?.name_ar ?? (patient?.phone_number ? maskPhone(patient.phone_number) : '—')}
                      </td>
                      <td className="px-4 py-3 text-sm" dir="rtl">
                        {doctor?.name_ar ?? doctor?.name_en ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {b.appointment_datetime
                          ? new Date(b.appointment_datetime).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={b.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-500">No bookings yet.</p>
        )}
      </div>
    </div>
  );
}

function StatCardComponent({ stat }: { stat: StatCard }) {
  const content = (
    <div className="card hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500">{stat.label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
        </div>
        <span className="text-2xl">{stat.icon}</span>
      </div>
    </div>
  );

  if (stat.href) {
    return <Link href={stat.href}>{content}</Link>;
  }
  return content;
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: 'badge-amber',
    confirmed: 'badge-green',
    cancelled: 'badge-red',
    completed: 'badge-teal',
    no_show: 'badge-gray',
  };

  return (
    <span className={`badge ${colors[status] ?? 'badge-gray'}`}>
      {status}
    </span>
  );
}

function maskPhone(phone: string): string {
  if (phone.length < 6) return phone;
  return phone.slice(0, 3) + '*'.repeat(phone.length - 6) + phone.slice(-3);
}
