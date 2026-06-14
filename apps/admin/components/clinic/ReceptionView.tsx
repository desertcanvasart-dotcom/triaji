'use client';

import { useState, useCallback } from 'react';
import { useQueueRealtime } from '@/lib/clinic/use-queue-realtime';
import { showToast } from '@/components/ui/Toast';
import FastAddForm from './FastAddForm';
import QueueList from './QueueList';
import TodayBookings from './TodayBookings';

// ─── Props ──────────────────────────────────────────────────────────────────

interface ReceptionViewProps {
  tenantId: string;
  doctors: Array<{ id: string; name_ar: string }>;
  estimatedMinutesPerPatient: number;
  bookingMode?: string; // 'walk_in_only' | 'slots_only' | 'both'
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function ReceptionView({
  tenantId,
  doctors,
  estimatedMinutesPerPatient,
  bookingMode = 'walk_in_only',
}: ReceptionViewProps) {
  const showFastAdd = bookingMode !== 'slots_only';
  const showBookings = bookingMode !== 'walk_in_only';
  const [selectedDoctorId, setSelectedDoctorId] = useState(doctors[0]?.id ?? '');
  const [bookingsKey, setBookingsKey] = useState(0);

  // Real-time queue data for selected doctor
  const { entries, loading, error } = useQueueRealtime(tenantId, selectedDoctorId);

  // Count waiting per doctor (only for the selected doctor since hook is per-doctor)
  const waitingCount = entries.filter((e) => e.status === 'waiting').length;

  // ─── Actions ──────────────────────────────────────────────────────────────

  const handleCallNext = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/queue/call-next', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doctor_id: selectedDoctorId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'فشل في استدعاء المريض التالي');
      }

      const data = await res.json();
      showToast(
        `تم استدعاء المريض رقم ${data.queue_number ?? ''}`,
        'success'
      );
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'حدث خطأ',
        'error'
      );
    }
  }, [selectedDoctorId]);

  const handleUpdateStatus = useCallback(async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/admin/queue/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'فشل في تحديث الحالة');
      }
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'حدث خطأ',
        'error'
      );
    }
  }, []);

  const handleAdded = useCallback(() => {
    // Queue refreshes automatically via realtime
    // Also refresh bookings in case check-in was done
    setBookingsKey((k) => k + 1);
  }, []);

  const handleCheckIn = useCallback(() => {
    // Queue refreshes automatically via realtime
    setBookingsKey((k) => k + 1);
  }, []);

  // ─── Render ───────────────────────────────────────────────────────────────

  if (!selectedDoctorId) {
    return (
      <div className="text-center py-20">
        <span className="text-4xl mb-3 block">⚕️</span>
        <p className="text-gray-500">لا يوجد أطباء مسجلين</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Doctor Tab Switcher (if multiple doctors) */}
      {doctors.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {doctors.map((doc) => (
            <button
              key={doc.id}
              onClick={() => setSelectedDoctorId(doc.id)}
              className={`flex-shrink-0 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                selectedDoctorId === doc.id
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {doc.name_ar}
              {selectedDoctorId === doc.id && waitingCount > 0 && (
                <span className="inline-flex items-center justify-center mr-2 w-5 h-5 text-xs font-bold rounded-full bg-white/20">
                  {waitingCount}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2.5">
          خطأ في تحميل الطابور: {error}
        </div>
      )}

      {/* Main Layout — two columns on desktop, single on mobile */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Mobile: FastAddForm first (hidden in slots_only mode) */}
        {showFastAdd && (
          <div className="lg:hidden">
            <FastAddForm
              doctorId={selectedDoctorId}
              tenantId={tenantId}
              onAdded={handleAdded}
            />
          </div>
        )}

        {/* Left Column: Queue + Bookings */}
        <div className="flex-1 lg:w-[60%] space-y-4">
          {loading ? (
            <div className="animate-pulse space-y-3">
              <div className="h-14 bg-gray-100 rounded-xl" />
              <div className="h-10 bg-gray-100 rounded-lg" />
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 bg-gray-100 rounded-lg" />
              ))}
            </div>
          ) : (
            <QueueList
              entries={entries}
              onCallNext={handleCallNext}
              onUpdateStatus={handleUpdateStatus}
              estimatedMinutesPerPatient={estimatedMinutesPerPatient}
            />
          )}

          {/* Today's Bookings (shown in 'both' and 'slots_only' modes) */}
          {showBookings && (
            <TodayBookings
              key={bookingsKey}
              doctorId={selectedDoctorId}
              tenantId={tenantId}
              onCheckIn={handleCheckIn}
            />
          )}
        </div>

        {/* Right Column: FastAddForm (desktop only, hidden in slots_only mode) */}
        {showFastAdd && (
          <div className="hidden lg:block lg:w-[40%]">
            <div className="sticky top-4">
              <FastAddForm
                doctorId={selectedDoctorId}
                tenantId={tenantId}
                onAdded={handleAdded}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
