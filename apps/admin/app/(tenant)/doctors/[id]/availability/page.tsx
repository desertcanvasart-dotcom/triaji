'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { showToast } from '@/components/ui/Toast';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

interface Slot {
  id: string;
  slot_datetime: string;
  duration_minutes: number;
  is_booked: boolean;
}

const QUICK_TEMPLATES = [
  { label: 'Morning (9, 10, 11)', times: ['09:00', '10:00', '11:00'] },
  { label: 'Afternoon (14, 15, 16)', times: ['14:00', '15:00', '16:00'] },
  { label: 'Evening (17, 18, 19)', times: ['17:00', '18:00', '19:00'] },
];

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

export default function AvailabilityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTime, setNewTime] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [addingSlot, setAddingSlot] = useState(false);
  const [deleteSlot, setDeleteSlot] = useState<Slot | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Bulk add state
  const [showBulk, setShowBulk] = useState(false);
  const [bulkDays, setBulkDays] = useState<number[]>([]);
  const [bulkTimes, setBulkTimes] = useState<string[]>([]);
  const [bulkWeeks, setBulkWeeks] = useState(4);
  const [bulkAdding, setBulkAdding] = useState(false);

  // Calculate 30-day range
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const thirtyDaysLater = new Date(today);
  thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);

  const fetchSlots = useCallback(async () => {
    setLoading(true);
    const from = today.toISOString();
    const to = thirtyDaysLater.toISOString();
    const res = await fetch(`/api/admin/doctors/${id}/slots?from=${from}&to=${to}`);
    if (res.ok) {
      const data = await res.json();
      setSlots(data.slots ?? []);
    }
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  // Group slots by date
  const slotsByDate: Record<string, Slot[]> = {};
  for (const slot of slots) {
    const dateKey = new Date(slot.slot_datetime).toISOString().split('T')[0] ?? '';
    if (!slotsByDate[dateKey]) slotsByDate[dateKey] = [];
    slotsByDate[dateKey]!.push(slot);
  }

  // Generate 30 days
  const days: string[] = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    days.push(d.toISOString().split('T')[0]!);
  }

  async function handleAddSlot() {
    if (!selectedDate || !newTime) {
      showToast('Select a date and time.', 'error');
      return;
    }
    setAddingSlot(true);
    const slotDatetime = `${selectedDate}T${newTime}:00.000Z`;
    const res = await fetch(`/api/admin/doctors/${id}/slots`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slot_datetime: slotDatetime }),
    });
    if (res.ok) {
      showToast('Slot added.', 'success');
      setNewTime('');
      fetchSlots();
    } else {
      const data = await res.json();
      showToast(data.error ?? 'Failed to add slot.', 'error');
    }
    setAddingSlot(false);
  }

  async function handleQuickAdd(times: string[]) {
    if (!selectedDate) {
      showToast('Select a date first.', 'error');
      return;
    }
    setAddingSlot(true);
    let added = 0;
    for (const time of times) {
      const slotDatetime = `${selectedDate}T${time}:00.000Z`;
      const res = await fetch(`/api/admin/doctors/${id}/slots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot_datetime: slotDatetime }),
      });
      if (res.ok) added++;
    }
    showToast(`${added} slots added.`, 'success');
    fetchSlots();
    setAddingSlot(false);
  }

  async function handleDeleteSlot() {
    if (!deleteSlot) return;
    setDeleting(true);
    const res = await fetch(`/api/admin/slots/${deleteSlot.id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('Slot deleted.', 'success');
      fetchSlots();
    } else {
      const data = await res.json();
      showToast(data.error ?? 'Cannot delete this slot.', 'error');
    }
    setDeleting(false);
    setDeleteSlot(null);
  }

  async function handleBulkAdd() {
    if (bulkDays.length === 0 || bulkTimes.length === 0) {
      showToast('Select days and times.', 'error');
      return;
    }
    setBulkAdding(true);
    const res = await fetch(`/api/admin/doctors/${id}/slots/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        days_of_week: bulkDays,
        times: bulkTimes,
        weeks: bulkWeeks,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      showToast(data.message ?? 'Bulk slots added.', 'success');
      fetchSlots();
      setShowBulk(false);
    } else {
      const data = await res.json();
      showToast(data.error ?? 'Failed to add bulk slots.', 'error');
    }
    setBulkAdding(false);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/doctors')} className="text-gray-500 hover:text-gray-700">
            &larr; Back
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Availability Manager</h1>
        </div>
        <button onClick={() => setShowBulk(!showBulk)} className="btn-secondary">
          {showBulk ? 'Hide Bulk Add' : 'Add Weekly Schedule'}
        </button>
      </div>

      {/* Bulk Add Panel */}
      {showBulk && (
        <div className="card mb-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Add Weekly Schedule</h3>
          <div className="space-y-4">
            <div>
              <label className="label">Days of Week</label>
              <div className="flex flex-wrap gap-2">
                {DAYS_OF_WEEK.map((d) => (
                  <button
                    key={d.value}
                    onClick={() => setBulkDays((prev) =>
                      prev.includes(d.value) ? prev.filter((v) => v !== d.value) : [...prev, d.value]
                    )}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
                      bulkDays.includes(d.value) ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-700 border-gray-300'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Time Slots</label>
              <div className="flex flex-wrap gap-2">
                {['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'].map((t) => (
                  <button
                    key={t}
                    onClick={() => setBulkTimes((prev) =>
                      prev.includes(t) ? prev.filter((v) => v !== t) : [...prev, t]
                    )}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
                      bulkTimes.includes(t) ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-700 border-gray-300'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Number of Weeks</label>
              <select value={bulkWeeks} onChange={(e) => setBulkWeeks(Number(e.target.value))} className="input-field w-32">
                <option value={2}>2 weeks</option>
                <option value={4}>4 weeks</option>
                <option value={8}>8 weeks</option>
              </select>
            </div>
            <button onClick={handleBulkAdd} disabled={bulkAdding} className="btn-primary">
              {bulkAdding ? 'Adding...' : 'Apply Schedule'}
            </button>
          </div>
        </div>
      )}

      {/* Add Single Slot */}
      <div className="card mb-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Add Slots</h3>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label">Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              min={days[0]}
              max={days[days.length - 1]}
              className="input-field"
            />
          </div>
          <div>
            <label className="label">Time</label>
            <input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} className="input-field" />
          </div>
          <button onClick={handleAddSlot} disabled={addingSlot} className="btn-primary">
            {addingSlot ? 'Adding...' : 'Add Slot'}
          </button>
          <div className="border-l border-gray-300 pl-3 ml-2">
            <p className="text-xs text-gray-500 mb-1.5">Quick Add:</p>
            <div className="flex gap-2">
              {QUICK_TEMPLATES.map((t) => (
                <button key={t.label} onClick={() => handleQuickAdd(t.times)} disabled={addingSlot} className="btn-secondary text-xs py-1">
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Calendar View */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading slots...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {days.map((day) => {
            const daySlots = slotsByDate[day] ?? [];
            const date = new Date(day + 'T00:00:00');
            const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
            const dayNum = date.getDate();
            const month = date.toLocaleDateString('en-US', { month: 'short' });

            return (
              <div
                key={day}
                className={`border rounded-lg p-3 min-h-[120px] ${
                  selectedDate === day ? 'border-teal-500 bg-teal-50' : 'border-gray-200 bg-white'
                }`}
                onClick={() => setSelectedDate(day)}
              >
                <div className="text-xs font-medium text-gray-500 mb-2">
                  {dayName}, {month} {dayNum}
                </div>
                {daySlots.length === 0 ? (
                  <p className="text-xs text-gray-400">No slots</p>
                ) : (
                  <div className="space-y-1">
                    {daySlots
                      .sort((a, b) => a.slot_datetime.localeCompare(b.slot_datetime))
                      .map((slot) => {
                        const time = new Date(slot.slot_datetime).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: false,
                        });
                        return (
                          <div
                            key={slot.id}
                            className={`flex items-center justify-between px-2 py-1 rounded text-xs ${
                              slot.is_booked ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
                            }`}
                          >
                            <span>{time}</span>
                            <div className="flex items-center gap-1">
                              <span>{slot.is_booked ? 'Booked' : 'Open'}</span>
                              {!slot.is_booked && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); setDeleteSlot(slot); }}
                                  className="text-red-400 hover:text-red-600 ml-1"
                                  title="Delete slot"
                                >
                                  &times;
                                </button>
                              )}
                            </div>
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

      <ConfirmDialog
        open={deleteSlot !== null}
        onClose={() => setDeleteSlot(null)}
        onConfirm={handleDeleteSlot}
        title="Delete Slot"
        message={
          deleteSlot?.is_booked
            ? 'This slot has a booking and cannot be deleted.'
            : 'Are you sure you want to delete this slot?'
        }
        confirmLabel="Delete"
        danger
        loading={deleting}
      />
    </div>
  );
}
