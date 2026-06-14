'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { showToast } from '@/components/ui/Toast';

// ─── Types ───────────────────────────────────────────────────────────────────

interface LabAppointment {
  id: string;
  patient_name: string;
  patient_phone: string;
  scheduled_time: string;
  tests: string[];
  status: 'scheduled' | 'checked_in';
  routing_id: string | null;
}

interface LabQueueEntry {
  id: string;
  patient_name: string;
  patient_phone: string;
  tests: string[];
  status: 'waiting' | 'sample_taken' | 'completed';
  routing_id: string | null;
  arrived_at: string;
  queue_number: number;
}

// ─── Status Config ───────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  string,
  { label: string; emoji: string; badgeClass: string; numberBg: string }
> = {
  waiting: {
    label: 'ينتظر',
    emoji: '⏳',
    badgeClass: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    numberBg: 'bg-teal-600 text-white',
  },
  sample_taken: {
    label: 'تم أخذ العينة',
    emoji: '🧪',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-200',
    numberBg: 'bg-blue-600 text-white',
  },
  completed: {
    label: 'مكتمل',
    emoji: '✓',
    badgeClass: 'bg-green-100 text-green-800 border-green-200',
    numberBg: 'bg-green-600 text-white',
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatMinutesAgo(isoDate: string): string {
  const mins = Math.floor((Date.now() - new Date(isoDate).getTime()) / 60_000);
  if (mins < 1) return 'الآن';
  if (mins === 1) return 'منذ دقيقة';
  if (mins === 2) return 'منذ دقيقتين';
  if (mins <= 10) return `منذ ${mins} دقائق`;
  return `منذ ${mins} دقيقة`;
}

function formatTime(isoDate: string): string {
  return new Date(isoDate).toLocaleTimeString('ar-EG', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function LabReception({ tenantId }: { tenantId: string }) {
  // Walk-in form state
  const [patientName, setPatientName] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [hasOrder, setHasOrder] = useState(false);
  const [routingId, setRoutingId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Data state
  const [appointments, setAppointments] = useState<LabAppointment[]>([]);
  const [queue, setQueue] = useState<LabQueueEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const nameRef = useRef<HTMLInputElement>(null);

  // ─── Fetch Data ──────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    try {
      const [apptRes, queueRes] = await Promise.all([
        fetch('/api/admin/lab/appointments'),
        fetch('/api/admin/lab/queue'),
      ]);

      if (apptRes.ok) {
        const data = await apptRes.json();
        setAppointments(data.appointments ?? data ?? []);
      }
      if (queueRes.ok) {
        const data = await queueRes.json();
        setQueue(data.entries ?? data ?? []);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15_000); // Poll every 15s
    return () => clearInterval(interval);
  }, [fetchData]);

  // ─── Walk-in Submit ────────────────────────────────────────────────────────

  const handleWalkInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = patientName.trim();
    if (!trimmedName) {
      showToast('اسم المريض مطلوب', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/lab/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_name: trimmedName,
          patient_phone: patientPhone.trim() || null,
          routing_id: hasOrder && routingId.trim() ? routingId.trim() : null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'فشل في الإضافة');
      }

      // Clear form
      setPatientName('');
      setPatientPhone('');
      setHasOrder(false);
      setRoutingId('');
      showToast('تمت الإضافة للطابور', 'success');
      fetchData();
      nameRef.current?.focus();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'حدث خطأ غير متوقع',
        'error'
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Check-in Appointment ──────────────────────────────────────────────────

  const handleCheckIn = async (appointmentId: string) => {
    try {
      const res = await fetch(`/api/admin/lab/appointments/${appointmentId}/check-in`, {
        method: 'POST',
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'فشل في تسجيل الحضور');
      }

      showToast('تم تسجيل الحضور', 'success');
      fetchData();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'حدث خطأ',
        'error'
      );
    }
  };

  // ─── Update Queue Status ───────────────────────────────────────────────────

  const handleUpdateStatus = async (entryId: string, status: string) => {
    try {
      const res = await fetch(`/api/admin/lab/queue/${entryId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'فشل في تحديث الحالة');
      }

      fetchData();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'حدث خطأ',
        'error'
      );
    }
  };

  // ─── Queue Stats ───────────────────────────────────────────────────────────

  const waitingCount = queue.filter((e) => e.status === 'waiting').length;
  const sampleTakenCount = queue.filter((e) => e.status === 'sample_taken').length;
  const completedCount = queue.filter((e) => e.status === 'completed').length;

  // ─── Sorted Queue ──────────────────────────────────────────────────────────

  const sortedQueue = [...queue].sort((a, b) => {
    const order: Record<string, number> = { waiting: 0, sample_taken: 1, completed: 2 };
    const oa = order[a.status] ?? 9;
    const ob = order[b.status] ?? 9;
    if (oa !== ob) return oa - ob;
    return a.queue_number - b.queue_number;
  });

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-3">
          <div className="h-14 bg-gray-100 rounded-xl" />
          <div className="h-10 bg-gray-100 rounded-lg" />
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4" dir="rtl">
      {/* Main Layout */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Mobile: Walk-in form first */}
        <div className="lg:hidden">
          <WalkInForm
            nameRef={nameRef}
            patientName={patientName}
            setPatientName={setPatientName}
            patientPhone={patientPhone}
            setPatientPhone={setPatientPhone}
            hasOrder={hasOrder}
            setHasOrder={setHasOrder}
            routingId={routingId}
            setRoutingId={setRoutingId}
            submitting={submitting}
            onSubmit={handleWalkInSubmit}
          />
        </div>

        {/* Left Column: Queue + Appointments */}
        <div className="flex-1 lg:w-[60%] space-y-4">
          {/* Stats Bar */}
          <div className="flex items-center gap-4 text-sm bg-gray-50 rounded-lg px-4 py-2.5 border border-gray-100">
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-yellow-400" />
              <span className="text-gray-600">ينتظرون:</span>
              <span className="font-bold text-gray-900">{waitingCount}</span>
            </div>
            <div className="h-4 w-px bg-gray-300" />
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500" />
              <span className="text-gray-600">عينات:</span>
              <span className="font-bold text-gray-900">{sampleTakenCount}</span>
            </div>
            <div className="h-4 w-px bg-gray-300" />
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500" />
              <span className="text-gray-600">مكتمل:</span>
              <span className="font-bold text-gray-900">{completedCount}</span>
            </div>
          </div>

          {/* Queue List */}
          {sortedQueue.length === 0 ? (
            <div className="text-center py-16">
              <span className="text-4xl mb-3 block">🧪</span>
              <p className="text-gray-500 text-sm">لا يوجد مرضى في الطابور اليوم</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {sortedQueue.map((entry) => {
                const config = STATUS_CONFIG[entry.status] ?? { emoji: '⏳', label: 'انتظار', badgeClass: 'bg-yellow-50 border-yellow-200 text-yellow-700', numberBg: 'bg-yellow-100 text-yellow-700' };
                const isActive = entry.status !== 'completed';

                return (
                  <li
                    key={entry.id}
                    className={`group bg-white rounded-lg border px-4 py-3 flex items-center gap-3 transition-colors ${
                      isActive
                        ? 'border-gray-200 hover:border-teal-300 hover:bg-teal-50/30'
                        : 'border-gray-100 opacity-70'
                    }`}
                  >
                    {/* Queue Number */}
                    <div
                      className={`flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-lg font-bold ${config.numberBg}`}
                    >
                      {entry.queue_number}
                    </div>

                    {/* Patient Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gray-900 text-sm truncate">
                          {entry.patient_name}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${config.badgeClass}`}
                        >
                          <span>{config.emoji}</span>
                          <span>{config.label}</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                        <span>{formatMinutesAgo(entry.arrived_at)}</span>
                        {entry.tests.length > 0 && (
                          <>
                            <span className="text-gray-300">|</span>
                            <div className="flex flex-wrap gap-1">
                              {entry.tests.map((test, i) => (
                                <span
                                  key={i}
                                  className="bg-indigo-50 text-indigo-700 text-[10px] px-1.5 py-0.5 rounded-full border border-indigo-100"
                                >
                                  {test}
                                </span>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex-shrink-0 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      {entry.status === 'waiting' && (
                        <button
                          onClick={() => handleUpdateStatus(entry.id, 'sample_taken')}
                          className="px-3 py-1.5 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                        >
                          أخذ عينة 🧪
                        </button>
                      )}
                      {entry.status === 'sample_taken' && (
                        <button
                          onClick={() => handleUpdateStatus(entry.id, 'completed')}
                          className="px-3 py-1.5 text-xs font-medium rounded-md bg-green-600 text-white hover:bg-green-700 transition-colors"
                        >
                          أكمل
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Today's Appointments */}
          {appointments.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                <h3 className="text-sm font-semibold text-gray-700">
                  مواعيد اليوم ({appointments.length})
                </h3>
              </div>
              <ul className="divide-y divide-gray-100">
                {appointments.map((appt) => (
                  <li key={appt.id} className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{appt.patient_name}</p>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                        <span>{formatTime(appt.scheduled_time)}</span>
                        {appt.tests.length > 0 && (
                          <>
                            <span className="text-gray-300">|</span>
                            <span>{appt.tests.join('، ')}</span>
                          </>
                        )}
                      </div>
                    </div>
                    {appt.status === 'scheduled' ? (
                      <button
                        onClick={() => handleCheckIn(appt.id)}
                        className="px-3 py-1.5 text-xs font-medium rounded-md bg-teal-600 text-white hover:bg-teal-700 transition-colors"
                      >
                        تسجيل حضور
                      </button>
                    ) : (
                      <span className="text-xs text-green-600 font-medium">حاضر</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Right Column: Walk-in Form (desktop only) */}
        <div className="hidden lg:block lg:w-[40%]">
          <div className="sticky top-4">
            <WalkInForm
              nameRef={nameRef}
              patientName={patientName}
              setPatientName={setPatientName}
              patientPhone={patientPhone}
              setPatientPhone={setPatientPhone}
              hasOrder={hasOrder}
              setHasOrder={setHasOrder}
              routingId={routingId}
              setRoutingId={setRoutingId}
              submitting={submitting}
              onSubmit={handleWalkInSubmit}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Walk-in Form Sub-component ──────────────────────────────────────────────

function WalkInForm({
  nameRef,
  patientName,
  setPatientName,
  patientPhone,
  setPatientPhone,
  hasOrder,
  setHasOrder,
  routingId,
  setRoutingId,
  submitting,
  onSubmit,
}: {
  nameRef: React.RefObject<HTMLInputElement | null>;
  patientName: string;
  setPatientName: (v: string) => void;
  patientPhone: string;
  setPatientPhone: (v: string) => void;
  hasOrder: boolean;
  setHasOrder: (v: boolean) => void;
  routingId: string;
  setRoutingId: (v: string) => void;
  submitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <h3 className="text-lg font-bold text-gray-900 mb-1">إضافة مريض (حضوري)</h3>

      {/* Patient Name */}
      <div>
        <label htmlFor="lab-name" className="block text-sm font-medium text-gray-700 mb-1">
          اسم المريض <span className="text-red-500">*</span>
        </label>
        <input
          ref={nameRef}
          id="lab-name"
          type="text"
          dir="rtl"
          placeholder="الاسم بالعربي"
          value={patientName}
          onChange={(e) => setPatientName(e.target.value)}
          required
          className="w-full h-12 px-4 rounded-lg border border-gray-300 text-base focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-colors"
        />
      </div>

      {/* Phone */}
      <div>
        <label htmlFor="lab-phone" className="block text-sm font-medium text-gray-700 mb-1">
          رقم الهاتف
          <span className="text-gray-400 text-xs mr-1">(اختياري)</span>
        </label>
        <input
          id="lab-phone"
          type="tel"
          dir="ltr"
          placeholder="01xxxxxxxxx"
          value={patientPhone}
          onChange={(e) => setPatientPhone(e.target.value)}
          className="w-full h-12 px-4 rounded-lg border border-gray-300 text-base focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-colors"
          autoComplete="off"
        />
      </div>

      {/* Has Order Toggle */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-gray-700">لديه طلب تحاليل؟</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setHasOrder(true)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              hasOrder
                ? 'bg-teal-600 text-white'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            نعم
          </button>
          <button
            type="button"
            onClick={() => {
              setHasOrder(false);
              setRoutingId('');
            }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              !hasOrder
                ? 'bg-teal-600 text-white'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            لا
          </button>
        </div>
      </div>

      {/* Routing ID (if has order) */}
      {hasOrder && (
        <div>
          <label htmlFor="lab-routing" className="block text-sm font-medium text-gray-700 mb-1">
            رقم التحويل
            <span className="text-gray-400 text-xs mr-1">(اختياري)</span>
          </label>
          <input
            id="lab-routing"
            type="text"
            dir="ltr"
            placeholder="مثال: RT-XXXX"
            value={routingId}
            onChange={(e) => setRoutingId(e.target.value)}
            className="w-full h-12 px-4 rounded-lg border border-gray-300 text-base focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-colors"
          />
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={submitting || !patientName.trim()}
        className="w-full h-14 rounded-lg bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white text-lg font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting ? 'جارٍ الإضافة...' : 'إضافة للطابور ➕'}
      </button>
    </form>
  );
}
