'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Lang } from '@triaji/shared/i18n';
import { buildSlotDatetime, formatSlotClock } from '@/lib/slots';

interface Slot {
  id: string;
  slot_datetime: string;
  duration_minutes: number;
  is_booked: boolean;
}

const T = {
  title:       { ar: 'مواعيدي المتاحة', en: 'My availability' },
  subtitle:    { ar: 'ظبّط المواعيد اللي المرضى يقدروا يحجزوا فيها', en: 'Set the times patients can book with you' },
  addWeekly:   { ar: 'جدول أسبوعي', en: 'Weekly schedule' },
  hideWeekly:  { ar: 'إخفاء الجدول', en: 'Hide schedule' },
  days:        { ar: 'الأيام', en: 'Days' },
  times:       { ar: 'المواعيد', en: 'Times' },
  weeks:       { ar: 'عدد الأسابيع', en: 'Weeks' },
  apply:       { ar: 'تطبيق الجدول', en: 'Apply schedule' },
  applying:    { ar: 'جاري الإضافة...', en: 'Applying...' },
  addSlots:    { ar: 'إضافة موعد', en: 'Add a slot' },
  date:        { ar: 'التاريخ', en: 'Date' },
  time:        { ar: 'الوقت', en: 'Time' },
  add:         { ar: 'إضافة', en: 'Add' },
  quickAdd:    { ar: 'إضافة سريعة:', en: 'Quick add:' },
  noSlots:     { ar: 'مفيش مواعيد', en: 'No slots' },
  booked:      { ar: 'محجوز', en: 'Booked' },
  open:        { ar: 'متاح', en: 'Open' },
  loading:     { ar: 'جاري التحميل...', en: 'Loading...' },
  pickDate:    { ar: 'اختار تاريخ الأول', en: 'Select a date first' },
  pickDateTime:{ ar: 'اختار التاريخ والوقت', en: 'Select a date and time' },
  slotAdded:   { ar: 'تمت إضافة الموعد', en: 'Slot added' },
  slotDeleted: { ar: 'تم حذف الموعد', en: 'Slot removed' },
  failed:      { ar: 'حصل خطأ', en: 'Something went wrong' },
};

const DAYS: Array<{ v: number; ar: string; en: string }> = [
  { v: 0, ar: 'الأحد', en: 'Sun' },
  { v: 1, ar: 'الاثنين', en: 'Mon' },
  { v: 2, ar: 'الثلاثاء', en: 'Tue' },
  { v: 3, ar: 'الأربعاء', en: 'Wed' },
  { v: 4, ar: 'الخميس', en: 'Thu' },
  { v: 5, ar: 'الجمعة', en: 'Fri' },
  { v: 6, ar: 'السبت', en: 'Sat' },
];
const TIME_CHOICES = ['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'];
const QUICK = [
  { label: { ar: 'صباحاً', en: 'Morning' }, times: ['09:00', '10:00', '11:00'] },
  { label: { ar: 'ظهراً', en: 'Afternoon' }, times: ['14:00', '15:00', '16:00'] },
  { label: { ar: 'مساءً', en: 'Evening' }, times: ['17:00', '18:00', '19:00'] },
];

export default function DoctorAvailabilityManager({ lang }: { lang: Lang }) {
  const isRtl = lang === 'ar';
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);

  const [selectedDate, setSelectedDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [adding, setAdding] = useState(false);

  const [showBulk, setShowBulk] = useState(false);
  const [bulkDays, setBulkDays] = useState<number[]>([]);
  const [bulkTimes, setBulkTimes] = useState<string[]>([]);
  const [bulkWeeks, setBulkWeeks] = useState(4);
  const [bulkAdding, setBulkAdding] = useState(false);

  function flash(text: string, ok: boolean) {
    setToast({ text, ok });
    setTimeout(() => setToast(null), 3000);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days: string[] = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    days.push(d.toISOString().split('T')[0]!);
  }

  const fetchSlots = useCallback(async () => {
    setLoading(true);
    try {
      const from = new Date(today).toISOString();
      const to = new Date(today.getTime() + 30 * 86_400_000).toISOString();
      const res = await fetch(`/api/doctor/availability?from=${from}&to=${to}`);
      const data = await res.json().catch(() => null);
      setSlots(res.ok && data ? (data.slots ?? []) : []);
    } catch {
      setSlots([]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  const slotsByDate: Record<string, Slot[]> = {};
  for (const s of slots) {
    const key = new Date(s.slot_datetime).toISOString().split('T')[0] ?? '';
    (slotsByDate[key] ??= []).push(s);
  }

  async function addSlot(date: string, time: string) {
    const iso = buildSlotDatetime(date, time);
    if (!iso) return false;
    const res = await fetch('/api/doctor/availability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slot_datetime: iso }),
    });
    return res.ok;
  }

  async function handleAddSingle() {
    if (!selectedDate || !newTime) {
      flash(T.pickDateTime[lang], false);
      return;
    }
    setAdding(true);
    const ok = await addSlot(selectedDate, newTime);
    flash(ok ? T.slotAdded[lang] : T.failed[lang], ok);
    if (ok) {
      setNewTime('');
      fetchSlots();
    }
    setAdding(false);
  }

  async function handleQuickAdd(times: string[]) {
    if (!selectedDate) {
      flash(T.pickDate[lang], false);
      return;
    }
    setAdding(true);
    let added = 0;
    for (const t of times) if (await addSlot(selectedDate, t)) added++;
    flash(`${added}/${times.length} ✓`, added > 0);
    fetchSlots();
    setAdding(false);
  }

  async function handleBulk() {
    if (bulkDays.length === 0 || bulkTimes.length === 0) {
      flash(lang === 'ar' ? 'اختار الأيام والمواعيد' : 'Pick days and times', false);
      return;
    }
    setBulkAdding(true);
    const res = await fetch('/api/doctor/availability/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ days_of_week: bulkDays, times: bulkTimes, weeks: bulkWeeks }),
    });
    const data = await res.json().catch(() => ({}));
    flash(res.ok ? (data.message ?? T.slotAdded[lang]) : (data.error ?? T.failed[lang]), res.ok);
    if (res.ok) {
      fetchSlots();
      setShowBulk(false);
    }
    setBulkAdding(false);
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/doctor/availability/${id}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    flash(res.ok ? T.slotDeleted[lang] : (data.error ?? T.failed[lang]), res.ok);
    if (res.ok) fetchSlots();
  }

  const chip = (active: boolean) =>
    `px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
      active ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-700 border-gray-300'
    }`;

  return (
    <div className="p-6 md:p-8" dir={isRtl ? 'rtl' : 'ltr'}>
      {toast && (
        <div className={`mb-4 rounded-lg px-4 py-2 text-sm ${toast.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {toast.text}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1A2F4A]">{T.title[lang]}</h1>
          <p className="text-sm text-gray-500 mt-1">{T.subtitle[lang]}</p>
        </div>
        <button onClick={() => setShowBulk((v) => !v)} className="btn-secondary">
          {showBulk ? T.hideWeekly[lang] : T.addWeekly[lang]}
        </button>
      </div>

      {showBulk && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">{T.days[lang]}</label>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((d) => (
                <button
                  key={d.v}
                  onClick={() => setBulkDays((p) => (p.includes(d.v) ? p.filter((x) => x !== d.v) : [...p, d.v]))}
                  className={chip(bulkDays.includes(d.v))}
                >
                  {d[lang]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">{T.times[lang]}</label>
            <div className="flex flex-wrap gap-2">
              {TIME_CHOICES.map((t) => (
                <button
                  key={t}
                  onClick={() => setBulkTimes((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]))}
                  className={chip(bulkTimes.includes(t))}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">{T.weeks[lang]}</label>
            <select value={bulkWeeks} onChange={(e) => setBulkWeeks(Number(e.target.value))} className="input-field w-32">
              <option value={2}>2</option>
              <option value={4}>4</option>
              <option value={8}>8</option>
            </select>
          </div>
          <button onClick={handleBulk} disabled={bulkAdding} className="btn-primary">
            {bulkAdding ? T.applying[lang] : T.apply[lang]}
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">{T.addSlots[lang]}</h3>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">{T.date[lang]}</label>
            <input type="date" value={selectedDate} min={days[0]} max={days[days.length - 1]} onChange={(e) => setSelectedDate(e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">{T.time[lang]}</label>
            <input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} className="input-field" />
          </div>
          <button onClick={handleAddSingle} disabled={adding} className="btn-primary">
            {adding ? '...' : T.add[lang]}
          </button>
          <div className="border-s border-gray-300 ps-3 ms-2">
            <p className="text-xs text-gray-500 mb-1.5">{T.quickAdd[lang]}</p>
            <div className="flex gap-2">
              {QUICK.map((q) => (
                <button key={q.label.en} onClick={() => handleQuickAdd(q.times)} disabled={adding} className="btn-secondary text-xs py-1">
                  {q.label[lang]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">{T.loading[lang]}</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {days.map((day) => {
            const daySlots = (slotsByDate[day] ?? []).sort((a, b) => a.slot_datetime.localeCompare(b.slot_datetime));
            const date = new Date(day + 'T00:00:00');
            const label = date.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB', { weekday: 'short', day: '2-digit', month: 'short' });
            return (
              <div
                key={day}
                className={`border rounded-lg p-3 min-h-[110px] cursor-pointer ${selectedDate === day ? 'border-teal-500 bg-teal-50' : 'border-gray-200 bg-white'}`}
                onClick={() => setSelectedDate(day)}
              >
                <div className="text-xs font-medium text-gray-500 mb-2">{label}</div>
                {daySlots.length === 0 ? (
                  <p className="text-xs text-gray-300">{T.noSlots[lang]}</p>
                ) : (
                  <div className="space-y-1">
                    {daySlots.map((s) => (
                      <div
                        key={s.id}
                        className={`flex items-center justify-between px-2 py-1 rounded text-xs ${s.is_booked ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}
                      >
                        <span>{formatSlotClock(s.slot_datetime, lang === 'ar' ? 'ar-EG' : 'en-US')}</span>
                        <div className="flex items-center gap-1">
                          <span>{s.is_booked ? T.booked[lang] : T.open[lang]}</span>
                          {!s.is_booked && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDelete(s.id); }}
                              className="text-red-400 hover:text-red-600 ms-1"
                              title="×"
                            >
                              &times;
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
