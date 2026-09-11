'use client';

import { useState, useEffect, useCallback } from 'react';
import Modal from '@/components/ui/Modal';
import { showToast } from '@/components/ui/Toast';

interface DoctorOption {
  id: string;
  name_ar: string;
  name_en: string | null;
}

interface SlotOption {
  id: string;
  slot_datetime: string;
  duration_minutes: number;
  is_booked: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

/** Format a floating clinic-local slot (naive Z) — display in UTC so the stored
 *  wall-clock shows exactly, matching the slot manager convention. */
function formatSlot(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    timeZone: 'UTC',
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export default function NewBookingModal({ open, onClose, onCreated }: Props) {
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [doctorId, setDoctorId] = useState('');
  const [slots, setSlots] = useState<SlotOption[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotId, setSlotId] = useState('');
  const [patientName, setPatientName] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Load the tenant's doctors when the modal opens.
  useEffect(() => {
    if (!open) return;
    fetch('/api/admin/doctors?limit=500')
      .then((r) => r.json())
      .then((d) => setDoctors(d.doctors ?? []))
      .catch(() => setDoctors([]));
  }, [open]);

  // Reset when closed.
  useEffect(() => {
    if (!open) {
      setDoctorId('');
      setSlots([]);
      setSlotId('');
      setPatientName('');
      setPatientPhone('');
      setNotes('');
    }
  }, [open]);

  const loadSlots = useCallback(async (id: string) => {
    setSlotsLoading(true);
    setSlots([]);
    setSlotId('');
    try {
      const from = new Date().toISOString();
      const to = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
      const res = await fetch(`/api/admin/doctors/${id}/slots?from=${from}&to=${to}`);
      const data = await res.json().catch(() => null);
      const open = (data?.slots ?? []).filter(
        (s: SlotOption) => !s.is_booked && new Date(s.slot_datetime).getTime() > Date.now()
      );
      setSlots(open);
    } catch {
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  }, []);

  function onDoctorChange(id: string) {
    setDoctorId(id);
    if (id) loadSlots(id);
    else setSlots([]);
  }

  async function handleSubmit() {
    if (!doctorId || !slotId || !patientName.trim() || !patientPhone.trim()) {
      showToast('Pick a doctor, a slot, and enter the patient name and phone.', 'error');
      return;
    }
    setSaving(true);
    const res = await fetch('/api/admin/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        doctor_id: doctorId,
        slot_id: slotId,
        patient_name: patientName.trim(),
        patient_phone: patientPhone.trim(),
        notes: notes.trim() || undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      showToast('Booking created.', 'success');
      onCreated();
      onClose();
    } else {
      showToast(data.error ?? 'Failed to create booking.', 'error');
    }
    setSaving(false);
  }

  return (
    <Modal open={open} onClose={onClose} title="New booking" maxWidth="max-w-lg">
      <div className="space-y-4">
        <div>
          <label className="label">Doctor</label>
          <select value={doctorId} onChange={(e) => onDoctorChange(e.target.value)} className="input-field w-full">
            <option value="">Select a doctor...</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>{d.name_en || d.name_ar}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Open slot</label>
          <select
            value={slotId}
            onChange={(e) => setSlotId(e.target.value)}
            className="input-field w-full"
            disabled={!doctorId || slotsLoading}
          >
            <option value="">
              {!doctorId ? 'Select a doctor first' : slotsLoading ? 'Loading slots...' : slots.length === 0 ? 'No open slots' : 'Select a slot...'}
            </option>
            {slots.map((s) => (
              <option key={s.id} value={s.id}>{formatSlot(s.slot_datetime)} ({s.duration_minutes}m)</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Patient name</label>
            <input type="text" value={patientName} onChange={(e) => setPatientName(e.target.value)} className="input-field w-full" />
          </div>
          <div>
            <label className="label">Patient phone</label>
            <input type="tel" dir="ltr" value={patientPhone} onChange={(e) => setPatientPhone(e.target.value)} placeholder="01XXXXXXXXX" className="input-field w-full" />
          </div>
        </div>

        <div>
          <label className="label">Notes (optional)</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="input-field w-full" />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="btn-secondary" disabled={saving}>Cancel</button>
          <button onClick={handleSubmit} className="btn-primary" disabled={saving}>
            {saving ? 'Creating...' : 'Create booking'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
