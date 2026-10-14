'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { Lang } from '@triaji/shared/i18n';

type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show' | 'payment_pending';

interface CalendarBooking {
  id: string;
  time: string;
  status: BookingStatus;
  patient_name: string | null;
  appointment_type: 'in_person' | 'telehealth';
}

interface CalendarDay {
  date: string;
  open_slots: number;
  booked_slots: number;
  first_slot: string | null;
  last_slot: string | null;
  bookings: CalendarBooking[];
  time_off: { id: string; full_day: boolean; from: string; to: string; reason: string | null }[];
}

const T = {
  title:        { ar: 'التقويم', en: 'Calendar' },
  subtitle:     {
    ar: 'مواعيدك وأيام شغلك وإجازاتك في شهر واحد. اضغط على أي يوم عشان تشوف تفاصيله.',
    en: 'Your appointments, working days and time off for the month. Tap a day for details.',
  },
  prev:         { ar: 'الشهر اللي فات', en: 'Previous' },
  next:         { ar: 'الشهر الجاي', en: 'Next' },
  today:        { ar: 'النهارده', en: 'Today' },
  appts:        { ar: 'موعد', en: 'appts' },
  open:         { ar: 'متاح', en: 'open' },
  dayOff:       { ar: 'إجازة', en: 'Day off' },
  partOff:      { ar: 'إجازة جزئية', en: 'Part off' },
  legendWork:   { ar: 'يوم شغل', en: 'Working day' },
  legendOff:    { ar: 'إجازة', en: 'Day off' },
  legendClash:  { ar: 'حجوزات في يوم إجازة', en: 'Bookings on a day off' },
  legendNone:   { ar: 'مفيش مواعيد', en: 'No slots' },
  hours:        { ar: 'ساعات الشغل', en: 'Hours' },
  noSlots:      { ar: 'مفيش مواعيد متاحة في اليوم ده', en: 'No slots on this day' },
  bookings:     { ar: 'الحجوزات', en: 'Bookings' },
  noBookings:   { ar: 'مفيش حجوزات', en: 'No bookings' },
  makeOff:      { ar: 'خلّي اليوم ده إجازة', en: 'Make this a day off' },
  reasonPh:     { ar: 'السبب (اختياري)', en: 'Reason (optional)' },
  confirmOff:   { ar: 'تأكيد الإجازة', en: 'Confirm day off' },
  cancel:       { ar: 'إلغاء', en: 'Cancel' },
  removeOff:    { ar: 'شيل الإجازة', en: 'Remove time off' },
  confirmRemove:{ ar: 'تشيل الإجازة دي؟ المواعيد المتاحة هترجع تظهر للمرضى.', en: 'Remove this time off? Your open slots will show to patients again.' },
  offNote:      {
    ar: 'المواعيد المتاحة في اليوم ده هتختفي من عند المرضى، وهترجع لو شلت الإجازة. الحجوزات الموجودة مش هتتلغى.',
    en: 'Open slots that day are hidden from patients and come back if you remove it. Existing bookings are not cancelled.',
  },
  clashWarn:    {
    ar: 'عندك حجوزات في يوم الإجازة ده — كلّم المرضى دول عشان تغيّر مواعيدهم.',
    en: 'You have bookings on this day off — contact these patients to reschedule.',
  },
  affected:     {
    ar: 'تمت إضافة الإجازة. خلي بالك: فيه {n} حجز في اليوم ده محتاج تتواصل معاهم.',
    en: 'Day off added. Note: {n} booking(s) that day need you to contact the patients.',
  },
  added:        { ar: 'تمت إضافة الإجازة', en: 'Day off added' },
  removed:      { ar: 'تم شيل الإجازة', en: 'Time off removed' },
  manage:       { ar: 'إدارة المواعيد المتاحة', en: 'Manage open slots' },
  open_exam:    { ar: 'فتح', en: 'Open' },
  loadFailed:   { ar: 'حصل مشكلة في تحميل التقويم', en: 'Could not load the calendar' },
  retry:        { ar: 'حاول تاني', en: 'Try again' },
  failed:       { ar: 'حصل خطأ، حاول تاني', en: 'Something went wrong, please try again' },
  unknown:      { ar: 'مريض', en: 'Patient' },
  online:       { ar: 'أونلاين', en: 'Online' },
};

const STATUS: Record<BookingStatus, { ar: string; en: string; className: string }> = {
  pending:         { ar: 'في الانتظار', en: 'Pending', className: 'bg-amber-100 text-amber-800' },
  payment_pending: { ar: 'في انتظار الدفع', en: 'Awaiting payment', className: 'bg-amber-100 text-amber-800' },
  confirmed:       { ar: 'مؤكد', en: 'Confirmed', className: 'bg-teal-100 text-teal-800' },
  completed:       { ar: 'تم الكشف', en: 'Seen', className: 'bg-emerald-100 text-emerald-700' },
  no_show:         { ar: 'لم يحضر', en: 'No-show', className: 'bg-red-50 text-red-700' },
  cancelled:       { ar: 'ملغي', en: 'Cancelled', className: 'bg-gray-100 text-gray-500' },
};

/** Egyptian week: Saturday first. */
const WEEKDAYS: { ar: string; en: string }[] = [
  { ar: 'السبت', en: 'Sat' },
  { ar: 'الأحد', en: 'Sun' },
  { ar: 'الاثنين', en: 'Mon' },
  { ar: 'الثلاثاء', en: 'Tue' },
  { ar: 'الأربعاء', en: 'Wed' },
  { ar: 'الخميس', en: 'Thu' },
  { ar: 'الجمعة', en: 'Fri' },
];

const NUM_LOCALE: Record<Lang, string> = { ar: 'ar-EG-u-nu-latn', en: 'en-GB' };

function cairoToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

function formatClock(hhmm: string, lang: Lang): string {
  const [h, m] = hhmm.split(':').map(Number) as [number, number];
  return new Date(Date.UTC(2000, 0, 1, h, m)).toLocaleTimeString(NUM_LOCALE[lang], {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  });
}

const activeBookings = (d: CalendarDay) => d.bookings.filter((b) => b.status !== 'cancelled');

export default function DoctorCalendar({ lang }: { lang: Lang }) {
  const isRtl = lang === 'ar';
  const t = (k: keyof typeof T) => T[k][lang];
  const today = cairoToday();

  const [month, setMonth] = useState(today.slice(0, 7));
  const [days, setDays] = useState<CalendarDay[]>([]);
  const [viewerRole, setViewerRole] = useState<'doctor' | 'assistant'>('doctor');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selected, setSelected] = useState<string | null>(today);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [offFormOpen, setOffFormOpen] = useState(false);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/doctor/calendar?month=${month}&locale=${lang}`, { cache: 'no-store' });
      if (!res.ok) {
        setLoadError(true);
        return;
      }
      const data = (await res.json()) as { days: CalendarDay[]; viewer_role?: 'doctor' | 'assistant' };
      setDays(data.days);
      setViewerRole(data.viewer_role ?? 'doctor');
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [month, lang]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setOffFormOpen(false);
    setReason('');
  }, [selected]);

  async function addDayOff(date: string) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch('/api/doctor/time-off', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, reason, locale: lang }),
      });
      const data = (await res.json()) as { error?: string; affected_bookings?: number };
      if (!res.ok) {
        setMessage({ text: data.error ?? t('failed'), ok: false });
        return;
      }
      const n = data.affected_bookings ?? 0;
      setMessage({ text: n > 0 ? t('affected').replace('{n}', String(n)) : t('added'), ok: n === 0 });
      setOffFormOpen(false);
      setReason('');
      await load();
    } catch {
      setMessage({ text: t('failed'), ok: false });
    } finally {
      setBusy(false);
    }
  }

  async function removeTimeOff(id: string) {
    if (!window.confirm(t('confirmRemove'))) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/doctor/time-off/${id}?locale=${lang}`, { method: 'DELETE' });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setMessage({ text: data.error ?? t('failed'), ok: false });
        return;
      }
      setMessage({ text: t('removed'), ok: true });
      await load();
    } catch {
      setMessage({ text: t('failed'), ok: false });
    } finally {
      setBusy(false);
    }
  }

  // Leading blanks so the 1st lands under its weekday (Saturday-first grid).
  const [y, m] = month.split('-').map(Number) as [number, number];
  const firstWeekday = new Date(Date.UTC(y, m - 1, 1)).getUTCDay(); // 0 = Sun
  const leading = (firstWeekday + 1) % 7;
  const monthLabel = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(NUM_LOCALE[lang], {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  const selectedDay = days.find((d) => d.date === selected) ?? null;

  return (
    <div className="px-4 pt-16 pb-6 sm:px-6 md:p-8 space-y-5" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1A2F4A]">{t('title')}</h1>
          <p className="text-gray-500 mt-1 text-sm">{t('subtitle')}</p>
        </div>
        {viewerRole === 'doctor' && (
        <Link
          href={`/${lang}/doctor/availability`}
          className="px-4 py-2 border border-teal-600 text-teal-700 rounded-lg text-sm font-medium hover:bg-teal-50 transition-colors"
        >
          {t('manage')}
        </Link>
        )}
      </div>

      {/* Month switcher */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setMonth((v) => shiftMonth(v, -1))}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
        >
          {isRtl ? '→' : '←'} {t('prev')}
        </button>
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-[#1A2F4A]">{monthLabel}</h2>
          {month !== today.slice(0, 7) && (
            <button
              type="button"
              onClick={() => {
                setMonth(today.slice(0, 7));
                setSelected(today);
              }}
              className="text-xs text-teal-700 hover:underline"
            >
              {t('today')}
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => setMonth((v) => shiftMonth(v, 1))}
          className="px-3 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700"
        >
          {t('next')} {isRtl ? '←' : '→'}
        </button>
      </div>

      {message && (
        <div
          className={`text-sm rounded-lg p-3 ${message.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}
        >
          {message.text}
        </div>
      )}

      {loadError ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-700">{t('loadFailed')}</p>
          <button
            type="button"
            onClick={load}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
          >
            {t('retry')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Month grid */}
          <div className={`lg:col-span-2 bg-white rounded-xl border border-gray-200 p-3 sm:p-4 ${loading ? 'opacity-60' : ''}`}>
            <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2">
              {WEEKDAYS.map((w) => (
                <div key={w.en} className="text-center text-[11px] sm:text-xs font-semibold text-gray-500">
                  {w[lang]}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {Array.from({ length: leading }).map((_, i) => (
                <div key={`blank-${i}`} />
              ))}
              {days.map((day) => {
                const n = activeBookings(day).length;
                const fullOff = day.time_off.some((o) => o.full_day);
                const partOff = !fullOff && day.time_off.length > 0;
                const clash = day.time_off.length > 0 && n > 0;
                const working = day.open_slots + day.booked_slots > 0;
                const past = day.date < today;
                const isToday = day.date === today;
                const isSelected = day.date === selected;

                const tone = clash
                  ? 'bg-red-50 border-red-300'
                  : fullOff
                    ? 'bg-gray-100 border-gray-200'
                    : working || n > 0
                      ? 'bg-teal-50/60 border-teal-200'
                      : 'bg-white border-gray-100';

                return (
                  <button
                    key={day.date}
                    type="button"
                    onClick={() => setSelected(day.date)}
                    className={`relative min-h-[64px] sm:min-h-[84px] rounded-lg border p-1.5 sm:p-2 text-start transition-shadow hover:shadow-sm ${tone} ${
                      isSelected ? 'ring-2 ring-indigo-500' : ''
                    } ${past ? 'opacity-60' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs sm:text-sm font-semibold ${
                          isToday ? 'bg-indigo-600 text-white rounded-full w-6 h-6 flex items-center justify-center' : 'text-gray-700'
                        }`}
                      >
                        {Number(day.date.slice(8))}
                      </span>
                    </div>
                    {fullOff ? (
                      <p className="mt-1 text-[10px] sm:text-xs font-medium text-gray-500">{t('dayOff')}</p>
                    ) : partOff ? (
                      <p className="mt-1 text-[10px] sm:text-xs font-medium text-gray-500">{t('partOff')}</p>
                    ) : null}
                    {n > 0 && (
                      <p className={`mt-0.5 leading-none ${clash ? 'text-red-700' : 'text-indigo-700'}`}>
                        <span className="text-base sm:text-xl font-bold">{n}</span>
                        <span className="hidden sm:inline text-[11px]"> {t('appts')}</span>
                      </p>
                    )}
                    {!fullOff && day.open_slots > 0 && (
                      <p className="hidden sm:block mt-0.5 text-[11px] text-teal-700">
                        {day.open_slots} {t('open')}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-4 text-[11px] text-gray-500">
              <Legend className="bg-teal-50 border-teal-200" label={t('legendWork')} />
              <Legend className="bg-gray-100 border-gray-200" label={t('legendOff')} />
              <Legend className="bg-red-50 border-red-300" label={t('legendClash')} />
              <Legend className="bg-white border-gray-200" label={t('legendNone')} />
            </div>
          </div>

          {/* Day detail */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4 self-start">
            {selectedDay ? (
              <DayDetail
                day={selectedDay}
                lang={lang}
                t={t}
                today={today}
                readOnly={viewerRole === 'assistant'}
                busy={busy}
                offFormOpen={offFormOpen}
                setOffFormOpen={setOffFormOpen}
                reason={reason}
                setReason={setReason}
                onAddDayOff={addDayOff}
                onRemoveTimeOff={removeTimeOff}
              />
            ) : (
              <p className="text-sm text-gray-400 text-center py-6">—</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block w-3 h-3 rounded border ${className}`} />
      {label}
    </span>
  );
}

function DayDetail({
  day,
  lang,
  t,
  today,
  readOnly,
  busy,
  offFormOpen,
  setOffFormOpen,
  reason,
  setReason,
  onAddDayOff,
  onRemoveTimeOff,
}: {
  day: CalendarDay;
  lang: Lang;
  t: (k: keyof typeof T) => string;
  today: string;
  readOnly: boolean;
  busy: boolean;
  offFormOpen: boolean;
  setOffFormOpen: (v: boolean) => void;
  reason: string;
  setReason: (v: string) => void;
  onAddDayOff: (date: string) => void;
  onRemoveTimeOff: (id: string) => void;
}) {
  const label = new Date(`${day.date}T00:00:00.000Z`).toLocaleDateString(NUM_LOCALE[lang], {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
  const active = activeBookings(day);
  const hasOff = day.time_off.length > 0;
  const editable = !readOnly && day.date >= today;

  return (
    <>
      <h3 className="font-bold text-[#1A2F4A]">{label}</h3>

      {hasOff && (
        <div className="space-y-2">
          {day.time_off.map((o) => (
            <div key={o.id} className="flex items-start justify-between gap-2 rounded-lg bg-gray-100 p-3 text-sm">
              <div>
                <p className="font-medium text-gray-700">
                  {o.full_day ? t('dayOff') : `${t('partOff')}: ${formatClock(o.from, lang)} – ${o.to === '24:00' ? '24:00' : formatClock(o.to, lang)}`}
                </p>
                {o.reason && <p className="text-xs text-gray-500 mt-0.5">{o.reason}</p>}
              </div>
              {editable && (
                <button
                  type="button"
                  onClick={() => onRemoveTimeOff(o.id)}
                  disabled={busy}
                  className="shrink-0 text-xs font-medium text-red-700 hover:underline disabled:opacity-50"
                >
                  {t('removeOff')}
                </button>
              )}
            </div>
          ))}
          {active.length > 0 && (
            <p className="text-xs text-red-700 bg-red-50 rounded-lg p-2">⚠️ {t('clashWarn')}</p>
          )}
        </div>
      )}

      <div className="text-sm">
        <p className="text-xs font-semibold text-gray-500 mb-1">{t('hours')}</p>
        {day.first_slot && day.last_slot ? (
          <p className="text-gray-800">
            {formatClock(day.first_slot, lang)} – {formatClock(day.last_slot, lang)}
            <span className="text-xs text-gray-500">
              {' '}
              · {day.open_slots} {t('open')}
            </span>
          </p>
        ) : (
          <p className="text-gray-400">{t('noSlots')}</p>
        )}
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-500 mb-2">
          {t('bookings')} ({active.length})
        </p>
        {day.bookings.length === 0 ? (
          <p className="text-sm text-gray-400">{t('noBookings')}</p>
        ) : (
          <ul className="space-y-2">
            {day.bookings.map((b) => {
              const st = STATUS[b.status] ?? STATUS.pending;
              return (
                <li key={b.id} className="flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <span className="font-mono text-gray-500 me-2">{formatClock(b.time, lang)}</span>
                    <span className={`text-gray-800 ${b.status === 'cancelled' ? 'line-through text-gray-400' : ''}`}>
                      {b.patient_name ?? t('unknown')}
                    </span>
                    {b.appointment_type === 'telehealth' && (
                      <span className="ms-1 text-[11px] text-purple-700">· {t('online')}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${st.className}`}>{st[lang]}</span>
                    {!readOnly && b.status !== 'cancelled' && (
                      <Link
                        href={`/${lang}/doctor/consultation/${b.id}`}
                        className="text-xs text-indigo-700 hover:underline"
                      >
                        {t('open_exam')}
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {editable && !day.time_off.some((o) => o.full_day) && (
        <div className="border-t border-gray-100 pt-4">
          {offFormOpen ? (
            <div className="space-y-2">
              <p className="text-xs text-gray-500">{t('offNote')}</p>
              {active.length > 0 && <p className="text-xs text-red-700">⚠️ {t('clashWarn')}</p>}
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={200}
                placeholder={t('reasonPh')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onAddDayOff(day.date)}
                  disabled={busy}
                  className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-900 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
                >
                  {t('confirmOff')}
                </button>
                <button
                  type="button"
                  onClick={() => setOffFormOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                >
                  {t('cancel')}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setOffFormOpen(true)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
            >
              {t('makeOff')}
            </button>
          )}
        </div>
      )}
    </>
  );
}
