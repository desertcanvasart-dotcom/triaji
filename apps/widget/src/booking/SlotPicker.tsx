import React, { useState, useEffect } from 'react';
import type { AvailableSlot, MatchedDoctor } from '../config';
import { fetchSlots } from '../api';

interface SlotPickerProps {
  apiUrl: string;
  doctor: MatchedDoctor;
  onSelectSlot: (slot: AvailableSlot) => void;
  onBack: () => void;
  primaryColor: string;
}

interface GroupedSlots {
  [dayKey: string]: {
    dayAr: string;
    dateAr: string;
    slots: AvailableSlot[];
  };
}

export function SlotPicker({ apiUrl, doctor, onSelectSlot, onBack, primaryColor }: SlotPickerProps) {
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    fetchSlots(apiUrl, doctor.id)
      .then((data) => setSlots(data))
      .catch(() => setSlots([]))
      .finally(() => setLoading(false));
  }, [apiUrl, doctor.id]);

  // Group slots by day
  const grouped: GroupedSlots = {};
  for (const slot of slots) {
    const key = slot.slotDatetime.split('T')[0] ?? slot.slotDatetime;
    if (!grouped[key]) {
      grouped[key] = { dayAr: slot.dayAr, dateAr: slot.dateAr, slots: [] };
    }
    grouped[key].slots.push(slot);
  }

  function handleSelect(slot: AvailableSlot) {
    setSelectedId(slot.id);
    onSelectSlot(slot);
  }

  if (loading) {
    return (
      <div className="triaji-loading">
        <div className="triaji-spinner" />
      </div>
    );
  }

  return (
    <div className="triaji-slots-section">
      <button className="triaji-slot-back" onClick={onBack}>
        → العودة للأطباء
      </button>
      <div className="triaji-slots-header">
        مواعيد {doctor.nameAr}
      </div>
      {slots.length === 0 ? (
        <div className="triaji-no-slots">
          لا توجد مواعيد متاحة حالياً
        </div>
      ) : (
        Object.entries(grouped).map(([key, group]) => (
          <div key={key} className="triaji-slot-day-group">
            <div className="triaji-slot-day-label">
              {group.dayAr} — {group.dateAr}
            </div>
            <div className="triaji-slot-grid">
              {group.slots.map((slot) => (
                <button
                  key={slot.id}
                  className={`triaji-slot-chip ${selectedId === slot.id ? 'selected' : ''}`}
                  style={
                    selectedId === slot.id
                      ? { backgroundColor: primaryColor, color: '#fff' }
                      : undefined
                  }
                  onClick={() => handleSelect(slot)}
                >
                  {slot.timeAr}
                </button>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
