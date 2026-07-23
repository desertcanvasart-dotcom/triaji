'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import GpInteractionAlerts from '@/components/doctor/GpInteractionAlerts';

// ─── Types ──────────────────────────────────────────────────────────────────

interface DoctorAppointment {
  id: string;
  booking_id: string;
  appointment_datetime: string;
  patient_phone: string;
  appointment_type: 'in_person' | 'telehealth';
  chief_complaint_ar: string | null;
  urgency_level: 'routine' | 'urgent' | 'emergency';
  patient_name_ar: string | null;
}

interface DashboardData {
  appointments: DoctorAppointment[];
  doctor_name_ar: string;
  doctor_account_id: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatEnglishDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatEnglishTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function maskPhone(phone: string): string {
  if (phone.length < 7) return phone;
  const first3 = phone.slice(0, 3);
  const last3 = phone.slice(-3);
  return `${first3}****${last3}`;
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

function isWithin30Minutes(isoString: string): boolean {
  const appointmentTime = new Date(isoString).getTime();
  const now = Date.now();
  const thirtyMinutesMs = 30 * 60 * 1000;
  return appointmentTime - now <= thirtyMinutesMs;
}

function isToday(isoString: string): boolean {
  const date = new Date(isoString);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

// ─── Urgency Badge ──────────────────────────────────────────────────────────

const URGENCY_CONFIG: Record<
  DoctorAppointment['urgency_level'],
  { label: string; className: string }
> = {
  emergency: {
    label: 'Emergency',
    className: 'bg-red-100 text-red-700',
  },
  urgent: {
    label: 'Urgent',
    className: 'bg-amber-100 text-amber-800',
  },
  routine: {
    label: 'Routine',
    className: 'bg-green-100 text-green-800',
  },
};

function UrgencyBadge({ level }: { level: DoctorAppointment['urgency_level'] }) {
  const config = URGENCY_CONFIG[level];
  return (
    <span
      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}
    >
      {config.label}
    </span>
  );
}

// ─── Appointment Type Badge ─────────────────────────────────────────────────

function TypeBadge({ type }: { type: DoctorAppointment['appointment_type'] }) {
  const isClinic = type === 'in_person';
  return (
    <span
      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${
        isClinic
          ? 'bg-blue-50 text-blue-700'
          : 'bg-purple-50 text-purple-700'
      }`}
    >
      {isClinic ? 'In-person' : 'Online'}
    </span>
  );
}

// ─── Loading Skeleton ───────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="p-6 md:p-8 animate-pulse space-y-6">
      <div className="h-8 bg-gray-200 rounded w-1/3" />
      <div className="h-4 bg-gray-200 rounded w-1/4" />
      <div className="mt-6 bg-white rounded-xl p-6 space-y-4">
        <div className="h-6 bg-gray-200 rounded w-1/4" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 bg-gray-100 rounded" />
        ))}
      </div>
    </div>
  );
}

// ─── Empty State ────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
      <div className="text-5xl mb-4">📋</div>
      <p className="text-gray-500 text-lg mb-6">
        No upcoming appointments right now
      </p>
      <Link
        href="/en/doctor/quick-intake"
        className="inline-flex items-center gap-2 px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-lg transition-colors"
      >
        <span>⚡</span>
        <span>Start quick intake</span>
      </Link>
    </div>
  );
}

// ─── Dashboard Page ─────────────────────────────────────────────────────────

export default function DoctorDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAppointments() {
      try {
        const res = await fetch('/api/doctor/dashboard/appointments');

        if (!res.ok) {
          setError('Failed to load appointments');
          return;
        }

        const result: DashboardData = await res.json();
        setData(result);
      } catch {
        setError('Failed to load appointments');
      } finally {
        setLoading(false);
      }
    }

    fetchAppointments();
  }, []);

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <div className="p-6 md:p-8" dir="ltr">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-700">{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const appointments = data?.appointments ?? [];
  const todayAppointments = appointments.filter((a) =>
    isToday(a.appointment_datetime)
  );

  return (
    <div className="p-6 md:p-8 space-y-6" dir="ltr">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#1A2F4A]">
          Welcome, Dr. {data?.doctor_name_ar}
        </h1>
        <p className="text-gray-500 mt-1">{formatEnglishDate(new Date())}</p>
      </div>

      {/* Today's appointments summary */}
      {todayAppointments.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 border-l-4 border-l-teal-500 p-5">
          <h2 className="text-lg font-bold text-[#1A2F4A]">
            Today&apos;s appointments ({todayAppointments.length})
          </h2>
        </div>
      )}

      {/* ICU Bed Availability Panel */}
      <div className="bg-red-50 rounded-xl border-2 border-red-200 p-5">
        <div className="flex items-start gap-4">
          <div className="text-3xl flex-shrink-0">🏥</div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-red-800">
              ICU Bed Availability
            </h2>
            <p className="text-sm text-red-700 mt-1">
              Find available ICU beds near you in real-time. Search across all DoctorTrio-registered hospitals.
            </p>
            <Link
              href="/en/icu"
              className="mt-3 inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors text-sm"
            >
              <span>Search ICU Beds</span>
              <span>&rarr;</span>
            </Link>
          </div>
        </div>
      </div>

      {/* GP Patient Interaction Alerts */}
      {data?.doctor_account_id && (
        <GpInteractionAlerts
          doctorAccountId={data.doctor_account_id}
          lang="en"
        />
      )}

      {/* Appointments table or empty state */}
      {appointments.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-semibold text-[#1A2F4A]">
                    Time
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-[#1A2F4A]">
                    Patient
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-[#1A2F4A]">
                    Visit type
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-[#1A2F4A]">
                    Symptoms
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-[#1A2F4A]">
                    Urgency
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-[#1A2F4A]">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {appointments.map((appointment) => {
                  const within30 = isWithin30Minutes(
                    appointment.appointment_datetime
                  );

                  return (
                    <tr
                      key={appointment.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                        {formatEnglishTime(appointment.appointment_datetime)}
                      </td>
                      <td className="px-4 py-3 text-gray-700 font-mono whitespace-nowrap">
                        {maskPhone(appointment.patient_phone)}
                      </td>
                      <td className="px-4 py-3">
                        <TypeBadge type={appointment.appointment_type} />
                      </td>
                      <td className="px-4 py-3 text-gray-600 max-w-[200px]">
                        {appointment.chief_complaint_ar
                          ? truncateText(appointment.chief_complaint_ar, 40)
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <UrgencyBadge level={appointment.urgency_level} />
                      </td>
                      <td className="px-4 py-3">
                        {within30 ? (
                          <Link
                            href={`/en/doctor/consultation/${appointment.booking_id}`}
                            className="inline-flex items-center px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-medium rounded-lg transition-colors whitespace-nowrap"
                          >
                            Start consultation
                          </Link>
                        ) : (
                          <Link
                            href={`/en/doctor/consultation/${appointment.booking_id}`}
                            className="inline-flex items-center px-4 py-2 border border-teal-600 text-teal-600 hover:bg-teal-50 text-xs font-medium rounded-lg transition-colors whitespace-nowrap"
                          >
                            View summary
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
