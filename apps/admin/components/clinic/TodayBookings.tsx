'use client';

import { useState, useEffect, useCallback } from 'react';
import { showToast } from '@/components/ui/Toast';
import type { Booking } from '@triaji/shared/types';

// ─── Props ──────────────────────────────────────────────────────────────────

interface TodayBookingsProps {
  doctorId: string;
  tenantId: string;
  onCheckIn: () => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function TodayBookings({ doctorId, tenantId, onCheckIn }: TodayBookingsProps) {
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState<string | null>(null);

  // ─── Fetch Today's Bookings ─────────────────────────────────────────────

  const fetchBookings = useCallback(async () => {
    try {
      const today = new Date().toISOString().split('T')[0] ?? '';
      const res = await fetch(`/api/admin/bookings?doctor=${doctorId}&dateFrom=${today}&dateTo=${today}`);
      if (!res.ok) throw new Error('Failed to fetch bookings');

      const data = await res.json();
      // The API may return bookings with patient info joined
      setBookings(data.bookings ?? data ?? []);
    } catch {
      // Silently fail — bookings panel is secondary
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, [doctorId]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  // ─── Check In ─────────────────────────────────────────────────────────────

  const handleCheckIn = async (bookingId: string) => {
    setCheckingIn(bookingId);
    try {
      const res = await fetch('/api/admin/queue/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: bookingId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'فشل تسجيل الحضور');
      }

      showToast('تم تسجيل الحضور وإضافة المريض للطابور', 'success');
      onCheckIn();
      // Refresh bookings to show updated status
      fetchBookings();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'حدث خطأ',
        'error'
      );
    } finally {
      setCheckingIn(null);
    }
  };

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const formatTime = (datetime: string) => {
    try {
      const date = new Date(datetime);
      return date.toLocaleTimeString('ar-EG', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return '--:--';
    }
  };

  // Only show pending/confirmed bookings (not already completed/cancelled)
  const activeBookings = bookings.filter(
    (b) => b.status === 'pending' || b.status === 'confirmed'
  );

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-base font-bold text-gray-900 mb-3">حجوزات اليوم</h3>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-gray-100 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-bold text-gray-900">حجوزات اليوم</h3>
        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
          {activeBookings.length} حجز
        </span>
      </div>

      {activeBookings.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">لا توجد حجوزات لهذا اليوم</p>
      ) : (
        <ul className="space-y-2">
          {activeBookings.map((booking) => (
            <li
              key={booking.id}
              className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-100"
            >
              {/* Time */}
              <div className="flex-shrink-0 text-sm font-mono font-medium text-teal-700 bg-teal-50 px-2 py-1 rounded" dir="ltr">
                {formatTime(booking.appointment_datetime)}
              </div>

              {/* Patient Name */}
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-gray-900 truncate block">
                  {booking.patient_name_ar ?? booking.patient_id?.slice(0, 8) ?? '---'}
                </span>
                {booking.notes_ar && (
                  <span className="text-xs text-gray-400 truncate block">
                    {booking.notes_ar}
                  </span>
                )}
              </div>

              {/* Check In Button */}
              <button
                onClick={() => handleCheckIn(booking.id)}
                disabled={checkingIn === booking.id}
                className="flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded-md bg-teal-600 text-white hover:bg-teal-700 transition-colors disabled:opacity-50"
              >
                {checkingIn === booking.id ? '...' : 'تسجيل حضور ✓'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Internal Types ─────────────────────────────────────────────────────────

interface BookingRow extends Booking {
  // May be joined from the patients table
  patient_name_ar?: string;
}
