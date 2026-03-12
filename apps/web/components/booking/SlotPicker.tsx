'use client';

import { useState, useEffect, useCallback } from 'react';

interface AvailableSlot {
  id: string;
  slotDatetime: string;
  durationMinutes: number;
  dayAr: string;
  dateAr: string;
  timeAr: string;
}

interface SlotsByDay {
  dayLabel: string;
  slots: AvailableSlot[];
}

interface SlotPickerProps {
  doctorId: string;
  doctorNameAr: string;
  onSelectSlot: (slot: AvailableSlot) => void;
  onClose: () => void;
}

export default function SlotPicker({ doctorId, doctorNameAr, onSelectSlot, onClose }: SlotPickerProps) {
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchSlots = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/doctors/${doctorId}/slots?days=14`);
      const data = (await res.json()) as { slots: AvailableSlot[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'فشل تحميل المواعيد');
      setSlots(data.slots);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطأ غير متوقع');
    } finally {
      setIsLoading(false);
    }
  }, [doctorId]);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  // Group slots by day
  const slotsByDay: SlotsByDay[] = [];
  const dayMap = new Map<string, AvailableSlot[]>();

  for (const slot of slots) {
    const dayKey = slot.dateAr;
    const existing = dayMap.get(dayKey);
    if (existing) {
      existing.push(slot);
    } else {
      dayMap.set(dayKey, [slot]);
    }
  }

  for (const [dayLabel, daySlots] of dayMap) {
    slotsByDay.push({ dayLabel: `${daySlots[0]?.dayAr ?? ''} ${dayLabel}`, slots: daySlots });
  }

  const selectedSlot = slots.find((s) => s.id === selectedSlotId);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center" onClick={onClose}>
      <div
        className="bg-white rounded-t-2xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">
            ✕
          </button>
          <div className="text-center flex-1">
            <h3 className="font-bold text-gray-900">اختر موعد</h3>
            <p className="text-sm text-teal-600">{doctorNameAr}</p>
          </div>
          <div className="w-8" />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading && (
            <div className="text-center py-8">
              <span className="text-gray-400 animate-pulse">جاري تحميل المواعيد...</span>
            </div>
          )}

          {error && (
            <div className="text-center py-8">
              <p className="text-red-500 mb-3">{error}</p>
              <button onClick={fetchSlots} className="text-teal-600 font-semibold underline">
                حاول مرة أخرى
              </button>
            </div>
          )}

          {!isLoading && !error && slotsByDay.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500">لا توجد مواعيد متاحة حالياً لهذا الدكتور</p>
            </div>
          )}

          {!isLoading && !error && slotsByDay.length > 0 && (
            <div className="space-y-4">
              {slotsByDay.map((day) => (
                <div key={day.dayLabel}>
                  <h4 className="text-sm font-bold text-gray-700 mb-2">{day.dayLabel}</h4>
                  <div className="flex flex-wrap gap-2">
                    {day.slots.map((slot) => (
                      <button
                        key={slot.id}
                        onClick={() => setSelectedSlotId(slot.id)}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                          selectedSlotId === slot.id
                            ? 'bg-teal-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {slot.timeAr}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t">
          <button
            onClick={() => selectedSlot && onSelectSlot(selectedSlot)}
            disabled={!selectedSlot}
            className="w-full bg-teal-600 text-white py-3 rounded-xl font-semibold hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            تأكيد الحجز
          </button>
        </div>
      </div>
    </div>
  );
}
