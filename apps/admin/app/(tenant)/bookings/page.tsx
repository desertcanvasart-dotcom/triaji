'use client';

import { useState, useEffect, useCallback } from 'react';
import { showToast } from '@/components/ui/Toast';
import { TableSkeleton } from '@/components/ui/LoadingSkeleton';
import EmptyState from '@/components/ui/EmptyState';
import LoadError from '@/components/ui/LoadError';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

interface BookingRow {
  id: string;
  patient_name: string | null;
  patient_phone: string;
  appointment_datetime: string;
  status: string;
  created_at: string;
  confirmation_channel: string | null;
  doctors: {
    id: string;
    name_ar: string;
    name_en: string;
    specialties: { name_en: string; name_ar: string };
  };
  triage_sessions: {
    id: string;
    chief_complaint: string | null;
    determined_specialty: string | null;
    urgency_level: string | null;
  } | null;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'badge-amber',
  confirmed: 'badge-green',
  cancelled: 'badge-red',
  completed: 'badge-teal',
  no_show: 'badge-gray',
};

export default function BookingsPage() {
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedBooking, setSelectedBooking] = useState<BookingRow | null>(null);
  const [actionBooking, setActionBooking] = useState<{ booking: BookingRow; action: string } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      if (statusFilter) params.set('status', statusFilter);

      const res = await fetch(`/api/admin/bookings?${params.toString()}`);
      const data = await res.json().catch(() => null);

      if (!res.ok || !data) {
        setLoadError(data?.error ?? 'Could not load bookings.');
        setBookings([]);
        setTotal(0);
        return;
      }
      setBookings(data.bookings ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setLoadError('Could not reach the server.');
      setBookings([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  async function handleStatusChange(bookingId: string, newStatus: string) {
    setActionLoading(true);
    const res = await fetch(`/api/admin/bookings/${bookingId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      showToast(`Booking ${newStatus}.`, 'success');
      fetchBookings();
    } else {
      const data = await res.json();
      showToast(data.error ?? 'Failed to update booking.', 'error');
    }
    setActionLoading(false);
    setActionBooking(null);
  }

  function maskPhone(phone: string): string {
    if (phone.length < 6) return phone;
    return phone.slice(0, 3) + '*'.repeat(phone.length - 6) + phone.slice(-3);
  }

  const totalPages = Math.ceil(total / 20);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Bookings</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="input-field w-48"
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="cancelled">Cancelled</option>
          <option value="completed">Completed</option>
          <option value="no_show">No Show</option>
        </select>
      </div>

      {loading ? (
        <TableSkeleton rows={8} cols={6} />
      ) : loadError ? (
        <LoadError message={loadError} onRetry={fetchBookings} />
      ) : bookings.length === 0 ? (
        <EmptyState icon="📅" title="No bookings found" description="Bookings will appear here when patients make appointments." />
      ) : (
        <>
          <div className="card p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="table-header px-6 py-3">Patient</th>
                    <th className="table-header px-6 py-3">Doctor</th>
                    <th className="table-header px-6 py-3">Specialty</th>
                    <th className="table-header px-6 py-3">Date & Time</th>
                    <th className="table-header px-6 py-3">Status</th>
                    <th className="table-header px-6 py-3">Booked At</th>
                    <th className="table-header px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b) => {
                    const isPast = new Date(b.appointment_datetime) < new Date();
                    const canCancel = !isPast && (b.status === 'pending' || b.status === 'confirmed');
                    const canComplete = isPast && b.status === 'confirmed';
                    const canNoShow = isPast && b.status === 'confirmed';

                    return (
                      <tr
                        key={b.id}
                        className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                        onClick={() => setSelectedBooking(b)}
                      >
                        <td className="px-6 py-4 text-sm">
                          {b.patient_name ?? maskPhone(b.patient_phone)}
                        </td>
                        <td className="px-6 py-4 text-sm" dir="rtl">
                          {b.doctors?.name_ar}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {b.doctors?.specialties?.name_en}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {new Date(b.appointment_datetime).toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric', year: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`badge ${STATUS_COLORS[b.status] ?? 'badge-gray'}`}>
                            {b.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {new Date(b.created_at).toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric',
                          })}
                        </td>
                        <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-2">
                            {canCancel && (
                              <button
                                onClick={() => setActionBooking({ booking: b, action: 'cancelled' })}
                                className="text-red-600 hover:text-red-800 text-xs font-medium"
                              >
                                Cancel
                              </button>
                            )}
                            {canComplete && (
                              <button
                                onClick={() => setActionBooking({ booking: b, action: 'completed' })}
                                className="text-teal-600 hover:text-teal-800 text-xs font-medium"
                              >
                                Complete
                              </button>
                            )}
                            {canNoShow && (
                              <button
                                onClick={() => setActionBooking({ booking: b, action: 'no_show' })}
                                className="text-gray-600 hover:text-gray-800 text-xs font-medium"
                              >
                                No Show
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary text-sm">
                Previous
              </button>
              <span className="text-sm text-gray-500 py-2">Page {page} of {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn-secondary text-sm">
                Next
              </button>
            </div>
          )}
        </>
      )}

      {/* Booking Detail Modal */}
      <Modal
        open={selectedBooking !== null}
        onClose={() => setSelectedBooking(null)}
        title="Booking Details"
        maxWidth="max-w-xl"
      >
        {selectedBooking && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500">Patient</p>
                <p className="text-sm font-medium">{selectedBooking.patient_name ?? maskPhone(selectedBooking.patient_phone)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Phone</p>
                <p className="text-sm font-medium">{maskPhone(selectedBooking.patient_phone)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Doctor</p>
                <p className="text-sm font-medium" dir="rtl">{selectedBooking.doctors?.name_ar}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Specialty</p>
                <p className="text-sm font-medium">{selectedBooking.doctors?.specialties?.name_en}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Appointment</p>
                <p className="text-sm font-medium">
                  {new Date(selectedBooking.appointment_datetime).toLocaleString('en-US', {
                    dateStyle: 'medium', timeStyle: 'short',
                  })}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Status</p>
                <span className={`badge ${STATUS_COLORS[selectedBooking.status] ?? 'badge-gray'}`}>
                  {selectedBooking.status}
                </span>
              </div>
              <div>
                <p className="text-xs text-gray-500">Confirmation Channel</p>
                <p className="text-sm font-medium">{selectedBooking.confirmation_channel ?? 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Booked At</p>
                <p className="text-sm font-medium">
                  {new Date(selectedBooking.created_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
              </div>
            </div>

            {selectedBooking.triage_sessions && (
              <div className="border-t border-gray-200 pt-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-2">Session Summary</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Chief Complaint</p>
                    <p className="text-sm" dir="rtl">{selectedBooking.triage_sessions.chief_complaint ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Determined Specialty</p>
                    <p className="text-sm">{selectedBooking.triage_sessions.determined_specialty ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Urgency Level</p>
                    <p className="text-sm">{selectedBooking.triage_sessions.urgency_level ?? '—'}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Action Confirmation */}
      <ConfirmDialog
        open={actionBooking !== null}
        onClose={() => setActionBooking(null)}
        onConfirm={() => {
          if (actionBooking) {
            handleStatusChange(actionBooking.booking.id, actionBooking.action);
          }
        }}
        title={
          actionBooking?.action === 'cancelled' ? 'Cancel Booking'
          : actionBooking?.action === 'completed' ? 'Mark as Completed'
          : 'Mark as No Show'
        }
        message={
          actionBooking?.action === 'cancelled'
            ? 'Are you sure you want to cancel this booking? The patient will be notified.'
            : actionBooking?.action === 'completed'
            ? 'Mark this booking as completed?'
            : 'Mark this patient as a no-show?'
        }
        confirmLabel={
          actionBooking?.action === 'cancelled' ? 'Cancel Booking' : 'Confirm'
        }
        danger={actionBooking?.action === 'cancelled'}
        loading={actionLoading}
      />
    </div>
  );
}
