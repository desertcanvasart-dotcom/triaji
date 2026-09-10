'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { showToast } from '@/components/ui/Toast';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import LoadError from '@/components/ui/LoadError';
import {
  buildSlotDatetime,
  formatSlotClock,
  dayStart,
  nextDayStart,
  intervalsOverlap,
} from '@/lib/slots';

interface Slot {
  id: string;
  slot_datetime: string;
  duration_minutes: number;
  is_booked: boolean;
}

interface TimeOff {
  id: string;
  starts_at: string;
  ends_at: string;
  reason: string | null;
}

interface VisitType {
  id: string;
  name: string;
  duration_minutes: number;
  is_default: boolean;
}

interface ScheduleTemplate {
  id: string;
  name: string;
  days_of_week: number[];
  times: string[];
  duration_minutes: number;
}

interface BookingPolicy {
  min_notice_minutes: number;
  max_advance_days: number;
  default_duration_min: number;
  buffer_minutes: number;
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
  const [loadError, setLoadError] = useState('');
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

  // Visit types
  const [visitTypes, setVisitTypes] = useState<VisitType[]>([]);
  const [showVisitTypes, setShowVisitTypes] = useState(false);
  const [vtName, setVtName] = useState('');
  const [vtDuration, setVtDuration] = useState(30);
  const [vtDefault, setVtDefault] = useState(false);
  const [savingVt, setSavingVt] = useState(false);
  const [slotVisitType, setSlotVisitType] = useState(''); // selected for adds

  // Schedule templates
  const [templates, setTemplates] = useState<ScheduleTemplate[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);

  // Booking policy
  const [policy, setPolicy] = useState<BookingPolicy | null>(null);
  const [showPolicy, setShowPolicy] = useState(false);
  const [savingPolicy, setSavingPolicy] = useState(false);

  // Time-off state
  const [timeOff, setTimeOff] = useState<TimeOff[]>([]);
  const [showBlock, setShowBlock] = useState(false);
  const [blockStart, setBlockStart] = useState('');
  const [blockEnd, setBlockEnd] = useState('');
  const [blockAllDay, setBlockAllDay] = useState(true);
  const [blockFrom, setBlockFrom] = useState('');
  const [blockTo, setBlockTo] = useState('');
  const [blockReason, setBlockReason] = useState('');
  const [blocking, setBlocking] = useState(false);

  // Calculate 30-day range
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const thirtyDaysLater = new Date(today);
  thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);

  const fetchSlots = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const from = today.toISOString();
      const to = thirtyDaysLater.toISOString();
      const res = await fetch(`/api/admin/doctors/${id}/slots?from=${from}&to=${to}`);
      const data = await res.json().catch(() => null);

      if (!res.ok || !data) {
        setLoadError(data?.error ?? 'Could not load availability.');
        setSlots([]);
        return;
      }
      setSlots(data.slots ?? []);
    } catch {
      setLoadError('Could not reach the server.');
      setSlots([]);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchTimeOff = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/doctors/${id}/time-off`);
      const data = await res.json().catch(() => null);
      setTimeOff(res.ok && data ? (data.time_off ?? []) : []);
    } catch {
      setTimeOff([]);
    }
  }, [id]);

  const fetchVisitTypes = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/doctors/${id}/visit-types`);
      const data = await res.json().catch(() => null);
      setVisitTypes(res.ok && data ? (data.visit_types ?? []) : []);
    } catch {
      setVisitTypes([]);
    }
  }, [id]);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/doctors/${id}/schedule-templates`);
      const data = await res.json().catch(() => null);
      setTemplates(res.ok && data ? (data.templates ?? []) : []);
    } catch {
      setTemplates([]);
    }
  }, [id]);

  const fetchPolicy = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/doctors/${id}/booking-policy`);
      const data = await res.json().catch(() => null);
      if (res.ok && data?.policy) setPolicy(data.policy);
    } catch {
      /* keep null → uses server defaults */
    }
  }, [id]);

  useEffect(() => {
    fetchSlots();
    fetchTimeOff();
    fetchVisitTypes();
    fetchTemplates();
    fetchPolicy();
  }, [fetchSlots, fetchTimeOff, fetchVisitTypes, fetchTemplates, fetchPolicy]);

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
    const slotDatetime = buildSlotDatetime(selectedDate, newTime);
    if (!slotDatetime) {
      showToast('Enter a valid date and time.', 'error');
      return;
    }
    setAddingSlot(true);
    const res = await fetch(`/api/admin/doctors/${id}/slots`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slot_datetime: slotDatetime, visit_type_id: slotVisitType || undefined }),
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
    let skipped = 0;
    for (const time of times) {
      const slotDatetime = buildSlotDatetime(selectedDate, time);
      if (!slotDatetime) continue;
      const res = await fetch(`/api/admin/doctors/${id}/slots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot_datetime: slotDatetime, visit_type_id: slotVisitType || undefined }),
      });
      if (res.ok) {
        added++;
      } else if (res.status === 409) {
        skipped++;
      }
    }
    showToast(
      skipped > 0
        ? `${added} slot(s) added, ${skipped} skipped (already exist or overlap).`
        : `${added} slot(s) added.`,
      added > 0 ? 'success' : 'error'
    );
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
        visit_type_id: slotVisitType || undefined,
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

  async function handleAddBlock() {
    if (!blockStart) {
      showToast('Choose a start date.', 'error');
      return;
    }
    const endDate = blockEnd || blockStart;
    if (endDate < blockStart) {
      showToast('End date is before the start date.', 'error');
      return;
    }

    let startsAt: string | null;
    let endsAt: string | null;
    if (blockAllDay) {
      startsAt = dayStart(blockStart);
      endsAt = nextDayStart(endDate);
    } else {
      if (!blockFrom || !blockTo || blockTo <= blockFrom) {
        showToast('Enter a valid time range.', 'error');
        return;
      }
      startsAt = buildSlotDatetime(blockStart, blockFrom);
      endsAt = buildSlotDatetime(endDate, blockTo);
    }
    if (!startsAt || !endsAt) {
      showToast('Invalid date or time.', 'error');
      return;
    }

    setBlocking(true);
    const res = await fetch(`/api/admin/doctors/${id}/time-off`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ starts_at: startsAt, ends_at: endsAt, reason: blockReason.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      const conflicts = data.booked_conflict_count ?? 0;
      showToast(
        conflicts > 0
          ? `Time off saved — heads up: ${conflicts} booked slot(s) fall inside it.`
          : 'Time off saved.',
        conflicts > 0 ? 'error' : 'success'
      );
      setShowBlock(false);
      setBlockStart('');
      setBlockEnd('');
      setBlockReason('');
      setBlockFrom('');
      setBlockTo('');
      fetchTimeOff();
    } else {
      showToast(data.error ?? 'Failed to save time off.', 'error');
    }
    setBlocking(false);
  }

  async function handleRemoveBlock(blockId: string) {
    const res = await fetch(`/api/admin/time-off/${blockId}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('Time off removed.', 'success');
      fetchTimeOff();
    } else {
      const data = await res.json().catch(() => ({}));
      showToast(data.error ?? 'Failed to remove time off.', 'error');
    }
  }

  async function handleAddVisitType() {
    if (!vtName.trim() || vtDuration <= 0) {
      showToast('Enter a name and a positive duration.', 'error');
      return;
    }
    setSavingVt(true);
    const res = await fetch(`/api/admin/doctors/${id}/visit-types`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: vtName.trim(), duration_minutes: vtDuration, is_default: vtDefault }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      showToast('Visit type added.', 'success');
      setVtName('');
      setVtDuration(30);
      setVtDefault(false);
      fetchVisitTypes();
    } else {
      showToast(data.error ?? 'Failed to add visit type.', 'error');
    }
    setSavingVt(false);
  }

  async function handleRemoveVisitType(vtId: string) {
    const res = await fetch(`/api/admin/visit-types/${vtId}`, { method: 'DELETE' });
    if (res.ok) {
      if (slotVisitType === vtId) setSlotVisitType('');
      showToast('Visit type removed.', 'success');
      fetchVisitTypes();
    } else {
      const data = await res.json().catch(() => ({}));
      showToast(data.error ?? 'Failed to remove visit type.', 'error');
    }
  }

  async function handleSaveTemplate() {
    if (!templateName.trim()) {
      showToast('Name the template.', 'error');
      return;
    }
    if (bulkDays.length === 0 || bulkTimes.length === 0) {
      showToast('Pick days and times to save.', 'error');
      return;
    }
    setSavingTemplate(true);
    const selectedVt = visitTypes.find((v) => v.id === slotVisitType);
    const res = await fetch(`/api/admin/doctors/${id}/schedule-templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: templateName.trim(),
        days_of_week: bulkDays,
        times: bulkTimes,
        duration_minutes: selectedVt?.duration_minutes ?? 30,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      showToast('Template saved.', 'success');
      setTemplateName('');
      fetchTemplates();
    } else {
      showToast(data.error ?? 'Failed to save template.', 'error');
    }
    setSavingTemplate(false);
  }

  function handleApplyTemplate(t: ScheduleTemplate) {
    setBulkDays(t.days_of_week ?? []);
    setBulkTimes(t.times ?? []);
    showToast(`Loaded "${t.name}" — review and Apply.`, 'success');
  }

  async function handleRemoveTemplate(templateId: string) {
    const res = await fetch(`/api/admin/schedule-templates/${templateId}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('Template removed.', 'success');
      fetchTemplates();
    } else {
      const data = await res.json().catch(() => ({}));
      showToast(data.error ?? 'Failed to remove template.', 'error');
    }
  }

  async function handleSavePolicy() {
    if (!policy) return;
    setSavingPolicy(true);
    const res = await fetch(`/api/admin/doctors/${id}/booking-policy`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(policy),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      if (data.policy) setPolicy(data.policy);
      showToast('Booking policy saved.', 'success');
    } else {
      showToast(data.error ?? 'Failed to save policy.', 'error');
    }
    setSavingPolicy(false);
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
        <div className="flex flex-wrap gap-3">
          <button onClick={() => setShowVisitTypes(!showVisitTypes)} className="btn-secondary">
            {showVisitTypes ? 'Hide Visit Types' : '🩺 Visit Types'}
          </button>
          <button onClick={() => setShowPolicy(!showPolicy)} className="btn-secondary">
            {showPolicy ? 'Hide Policy' : '⚙️ Booking Policy'}
          </button>
          <button onClick={() => setShowBlock(!showBlock)} className="btn-secondary">
            {showBlock ? 'Hide Time Off' : '🚫 Block Time Off'}
          </button>
          <button onClick={() => setShowBulk(!showBulk)} className="btn-secondary">
            {showBulk ? 'Hide Bulk Add' : 'Add Weekly Schedule'}
          </button>
        </div>
      </div>

      {/* Visit Types panel */}
      {showVisitTypes && (
        <div className="card mb-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Visit Types</h3>
          {visitTypes.length > 0 ? (
            <div className="flex flex-wrap gap-2 mb-4">
              {visitTypes.map((v) => (
                <span key={v.id} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-sm">
                  <span className="font-medium text-gray-800">{v.name}</span>
                  <span className="text-gray-500">{v.duration_minutes}m</span>
                  {v.is_default && <span className="text-xs text-teal-700 bg-teal-100 px-1.5 rounded">default</span>}
                  <button
                    onClick={() => handleRemoveVisitType(v.id)}
                    className="text-gray-400 hover:text-red-600"
                    title="Remove visit type"
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400 mb-4">No visit types yet. Slots use the policy default duration.</p>
          )}
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="label">Name</label>
              <input
                type="text"
                value={vtName}
                onChange={(e) => setVtName(e.target.value)}
                placeholder="New consultation"
                className="input-field w-48"
              />
            </div>
            <div>
              <label className="label">Duration (min)</label>
              <input
                type="number"
                min={1}
                value={vtDuration}
                onChange={(e) => setVtDuration(Number(e.target.value))}
                className="input-field w-28"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700 pb-2">
              <input
                type="checkbox"
                checked={vtDefault}
                onChange={(e) => setVtDefault(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
              />
              Default
            </label>
            <button onClick={handleAddVisitType} disabled={savingVt} className="btn-primary">
              {savingVt ? 'Adding...' : 'Add Visit Type'}
            </button>
          </div>
        </div>
      )}

      {/* Booking Policy panel */}
      {showPolicy && policy && (
        <div className="card mb-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Booking Policy</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="label">Min notice (min)</label>
              <input
                type="number"
                min={0}
                value={policy.min_notice_minutes}
                onChange={(e) => setPolicy({ ...policy, min_notice_minutes: Number(e.target.value) })}
                className="input-field w-full"
              />
            </div>
            <div>
              <label className="label">Booking horizon (days)</label>
              <input
                type="number"
                min={1}
                value={policy.max_advance_days}
                onChange={(e) => setPolicy({ ...policy, max_advance_days: Number(e.target.value) })}
                className="input-field w-full"
              />
            </div>
            <div>
              <label className="label">Default duration (min)</label>
              <input
                type="number"
                min={1}
                value={policy.default_duration_min}
                onChange={(e) => setPolicy({ ...policy, default_duration_min: Number(e.target.value) })}
                className="input-field w-full"
              />
            </div>
            <div>
              <label className="label">Buffer between slots (min)</label>
              <input
                type="number"
                min={0}
                value={policy.buffer_minutes}
                onChange={(e) => setPolicy({ ...policy, buffer_minutes: Number(e.target.value) })}
                className="input-field w-full"
              />
            </div>
          </div>
          <button onClick={handleSavePolicy} disabled={savingPolicy} className="btn-primary mt-4">
            {savingPolicy ? 'Saving...' : 'Save Policy'}
          </button>
        </div>
      )}

      {/* Time-off Panel */}
      {showBlock && (
        <div className="card mb-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Block Time Off</h3>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="label">From date</label>
              <input
                type="date"
                value={blockStart}
                min={days[0]}
                onChange={(e) => setBlockStart(e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label className="label">To date</label>
              <input
                type="date"
                value={blockEnd}
                min={blockStart || days[0]}
                onChange={(e) => setBlockEnd(e.target.value)}
                className="input-field"
                placeholder="same day"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700 pb-2">
              <input
                type="checkbox"
                checked={blockAllDay}
                onChange={(e) => setBlockAllDay(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
              />
              All day
            </label>
            {!blockAllDay && (
              <>
                <div>
                  <label className="label">From time</label>
                  <input type="time" value={blockFrom} onChange={(e) => setBlockFrom(e.target.value)} className="input-field" />
                </div>
                <div>
                  <label className="label">To time</label>
                  <input type="time" value={blockTo} onChange={(e) => setBlockTo(e.target.value)} className="input-field" />
                </div>
              </>
            )}
            <div>
              <label className="label">Reason (optional)</label>
              <input
                type="text"
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="Holiday, vacation…"
                className="input-field w-48"
              />
            </div>
            <button onClick={handleAddBlock} disabled={blocking} className="btn-primary">
              {blocking ? 'Saving...' : 'Block'}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Blocking prevents new slots in that window and marks the days off. Existing booked
            appointments are kept and flagged, not deleted.
          </p>
        </div>
      )}

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
            {/* Saved templates */}
            <div className="border-t border-gray-100 pt-3">
              <label className="label">Saved templates</label>
              {templates.length > 0 ? (
                <div className="flex flex-wrap gap-2 mb-2">
                  {templates.map((t) => (
                    <span key={t.id} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-teal-200 bg-teal-50 text-sm">
                      <button onClick={() => handleApplyTemplate(t)} className="font-medium text-teal-800 hover:underline" title="Load into the form">
                        {t.name}
                      </button>
                      <button onClick={() => handleRemoveTemplate(t.id)} className="text-teal-400 hover:text-red-600" title="Delete template">
                        &times;
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 mb-2">No templates yet.</p>
              )}
              <div className="flex items-end gap-2">
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="Template name (e.g. Clinic hours)"
                  className="input-field w-56"
                />
                <button onClick={handleSaveTemplate} disabled={savingTemplate} className="btn-secondary">
                  {savingTemplate ? 'Saving...' : 'Save current as template'}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button onClick={handleBulkAdd} disabled={bulkAdding} className="btn-primary">
                {bulkAdding ? 'Adding...' : 'Apply Schedule'}
              </button>
              {visitTypes.length > 0 && (
                <span className="text-xs text-gray-500">
                  {slotVisitType
                    ? `Duration from “${visitTypes.find((v) => v.id === slotVisitType)?.name ?? ''}”.`
                    : 'Uses default duration. Pick a visit type in Add Slots to change it.'}
                </span>
              )}
            </div>
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
          {visitTypes.length > 0 && (
            <div>
              <label className="label">Visit type</label>
              <select
                value={slotVisitType}
                onChange={(e) => setSlotVisitType(e.target.value)}
                className="input-field"
              >
                <option value="">Default duration</option>
                {visitTypes.map((v) => (
                  <option key={v.id} value={v.id}>{v.name} ({v.duration_minutes}m)</option>
                ))}
              </select>
            </div>
          )}
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
      ) : loadError ? (
        <LoadError message={loadError} onRetry={fetchSlots} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {days.map((day) => {
            const daySlots = slotsByDate[day] ?? [];
            const date = new Date(day + 'T00:00:00');
            const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
            const dayNum = date.getDate();
            const month = date.toLocaleDateString('en-US', { month: 'short' });

            // Time off overlapping this clinic day
            const dStart = new Date(dayStart(day)!).getTime();
            const dEnd = dStart + 86_400_000;
            const dayBlocks = timeOff.filter((t) =>
              intervalsOverlap(dStart, dEnd, new Date(t.starts_at).getTime(), new Date(t.ends_at).getTime())
            );
            const fullDayBlock = dayBlocks.find(
              (t) => new Date(t.starts_at).getTime() <= dStart && new Date(t.ends_at).getTime() >= dEnd
            );
            const sortedSlots = [...daySlots].sort((a, b) => a.slot_datetime.localeCompare(b.slot_datetime));

            return (
              <div
                key={day}
                className={`border rounded-lg p-3 min-h-[120px] ${
                  fullDayBlock
                    ? 'border-amber-300 bg-amber-50'
                    : selectedDate === day
                    ? 'border-teal-500 bg-teal-50'
                    : 'border-gray-200 bg-white'
                }`}
                onClick={() => { if (!fullDayBlock) setSelectedDate(day); }}
              >
                <div className="text-xs font-medium text-gray-500 mb-2">
                  {dayName}, {month} {dayNum}
                </div>

                {fullDayBlock ? (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between px-2 py-1 rounded text-xs bg-amber-100 text-amber-800">
                      <span>Day off{fullDayBlock.reason ? ` — ${fullDayBlock.reason}` : ''}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRemoveBlock(fullDayBlock.id); }}
                        className="text-amber-500 hover:text-amber-700 ml-1"
                        title="Remove time off"
                      >
                        &times;
                      </button>
                    </div>
                    {sortedSlots.filter((s) => s.is_booked).map((slot) => (
                      <div key={slot.id} className="flex items-center justify-between px-2 py-1 rounded text-xs bg-red-50 text-red-700">
                        <span>{formatSlotClock(slot.slot_datetime)}</span>
                        <span title="Booked appointment inside a day off">Booked ⚠</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {dayBlocks.map((t) => (
                      <div key={t.id} className="flex items-center justify-between px-2 py-1 rounded text-xs bg-amber-50 text-amber-700">
                        <span>Off {formatSlotClock(t.starts_at)}–{formatSlotClock(t.ends_at)}{t.reason ? ` · ${t.reason}` : ''}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleRemoveBlock(t.id); }}
                          className="text-amber-400 hover:text-amber-600 ml-1"
                          title="Remove time off"
                        >
                          &times;
                        </button>
                      </div>
                    ))}
                    {sortedSlots.length === 0 && dayBlocks.length === 0 ? (
                      <p className="text-xs text-gray-300">Not configured</p>
                    ) : (
                      sortedSlots.map((slot) => {
                        const start = formatSlotClock(slot.slot_datetime);
                        const endMs = new Date(slot.slot_datetime).getTime() + slot.duration_minutes * 60000;
                        const end = formatSlotClock(new Date(endMs).toISOString());
                        return (
                          <div
                            key={slot.id}
                            className={`flex items-center justify-between px-2 py-1 rounded text-xs ${
                              slot.is_booked ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
                            }`}
                          >
                            <span title={`${start}–${end}`}>{start}–{end}</span>
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
                      })
                    )}
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
