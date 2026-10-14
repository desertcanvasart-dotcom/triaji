'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { Lang } from '@triaji/shared/i18n';
import { formatSlotClock } from '@/lib/slots';

type RowState = 'expected' | 'waiting' | 'called' | 'completed' | 'no_show' | 'cancelled' | 'left';

interface Billing {
  total: number;
  insurance: number;
  patient_pays: number;
  paid: boolean;
}

interface Row {
  key: string;
  queue_id: string | null;
  booking_id: string | null;
  queue_number: number | null;
  appointment_datetime: string | null;
  arrived_at: string | null;
  source: 'booking' | 'walk_in';
  appointment_type: 'in_person' | 'telehealth';
  patient_name: string | null;
  patient_phone: string | null;
  chief_complaint: string | null;
  urgency: 'routine' | 'urgent' | 'emergency' | null;
  state: RowState;
  billing: Billing | null;
}

interface TodayData {
  date: string;
  doctor_name_ar: string;
  has_clinic: boolean;
  consultation_fee_egp: number | null;
  viewer_role?: 'doctor' | 'assistant';
  rows: Row[];
  stats: {
    total: number;
    expected: number;
    waiting: number;
    completed: number;
    no_show: number;
    collected: number;
    outstanding: number;
    insurance: number;
  };
}

type Action = 'check_in' | 'walk_in' | 'call_next' | 'call' | 'complete' | 'no_show';

const REFRESH_MS = 30_000;

const T = {
  title:         { ar: 'يوم العمل', en: 'Today' },
  refresh:       { ar: 'تحديث', en: 'Refresh' },
  callNext:      { ar: 'نداء المريض التالي', en: 'Call next patient' },
  addWalkIn:     { ar: 'إضافة مريض بدون حجز', en: 'Add walk-in' },
  screen:        { ar: 'شاشة الانتظار', en: 'Waiting-room screen' },
  inRoom:        { ar: 'داخل الكشف الآن', en: 'In the room now' },
  noneInRoom:    { ar: 'مفيش مريض داخل الكشف دلوقتي', en: 'No patient in the room right now' },
  openExam:      { ar: 'فتح الكشف', en: 'Open exam' },
  markDone:      { ar: 'تم الكشف', en: 'Mark done' },
  checkIn:       { ar: 'تسجيل حضور', en: 'Check in' },
  call:          { ar: 'نداء', en: 'Call' },
  noShow:        { ar: 'لم يحضر', en: 'No-show' },
  view:          { ar: 'عرض', en: 'View' },
  confirmNoShow: { ar: 'تأكيد: المريض ده محضرش؟', en: 'Mark this patient as a no-show?' },
  statTotal:     { ar: 'إجمالي اليوم', en: 'Total today' },
  statExpected:  { ar: 'لسه مجوش', en: 'Expected' },
  statWaiting:   { ar: 'في الانتظار', en: 'Waiting' },
  statDone:      { ar: 'تم الكشف', en: 'Seen' },
  statNoShow:    { ar: 'لم يحضر', en: 'No-shows' },
  collected:     { ar: 'المحصّل', en: 'Collected' },
  outstanding:   { ar: 'المتبقي', en: 'Outstanding' },
  insurance:     { ar: 'على التأمين', en: 'Insurance' },
  colNo:         { ar: '#', en: '#' },
  colPatient:    { ar: 'المريض', en: 'Patient' },
  colTime:       { ar: 'الموعد', en: 'Time' },
  colType:       { ar: 'النوع', en: 'Type' },
  colAmount:     { ar: 'المبلغ', en: 'Amount' },
  colStatus:     { ar: 'الحالة', en: 'Status' },
  colActions:    { ar: 'إجراء', en: 'Actions' },
  walkInTag:     { ar: 'بدون حجز', en: 'Walk-in' },
  clinic:        { ar: 'عيادة', en: 'Clinic' },
  online:        { ar: 'أونلاين', en: 'Online' },
  paid:          { ar: 'مدفوع', en: 'Paid' },
  unpaid:        { ar: 'غير مدفوع', en: 'Unpaid' },
  insuranceShare:{ ar: 'التأمين', en: 'Insurance' },
  fee:           { ar: 'سعر الكشف', en: 'Fee' },
  egp:           { ar: 'ج.م', en: 'EGP' },
  empty:         { ar: 'مفيش مرضى النهارده لحد دلوقتي', en: 'No patients today yet' },
  emptyHint:     {
    ar: 'المواعيد المحجوزة والمرضى اللي من غير حجز هيظهروا هنا.',
    en: 'Booked appointments and walk-ins will show up here.',
  },
  noClinic:      {
    ar: 'اربط عيادتك من الإعدادات عشان تقدر تسجّل الحضور وتنادي المرضى.',
    en: 'Link your clinic in Settings to check patients in and call them.',
  },
  settings:      { ar: 'الإعدادات', en: 'Settings' },
  name:          { ar: 'اسم المريض', en: 'Patient name' },
  phone:         { ar: 'رقم الموبايل (اختياري)', en: 'Mobile (optional)' },
  complaint:     { ar: 'الشكوى (اختياري)', en: 'Complaint (optional)' },
  add:           { ar: 'إضافة للطابور', en: 'Add to queue' },
  cancel:        { ar: 'إلغاء', en: 'Cancel' },
  loadFailed:    { ar: 'حصل مشكلة في تحميل اليوم', en: 'Could not load today' },
  retry:         { ar: 'حاول تاني', en: 'Try again' },
  failed:        { ar: 'حصل خطأ، حاول تاني', en: 'Something went wrong, please try again' },
  unknown:       { ar: 'مريض', en: 'Patient' },
};

const STATE_LABEL: Record<RowState, { ar: string; en: string; className: string }> = {
  expected:  { ar: 'منتظر وصوله', en: 'Expected', className: 'bg-slate-100 text-slate-700' },
  waiting:   { ar: 'في الانتظار', en: 'Waiting', className: 'bg-amber-100 text-amber-800' },
  called:    { ar: 'داخل الكشف', en: 'In the room', className: 'bg-indigo-100 text-indigo-700' },
  completed: { ar: 'تم الكشف', en: 'Seen', className: 'bg-emerald-100 text-emerald-700' },
  no_show:   { ar: 'لم يحضر', en: 'No-show', className: 'bg-red-50 text-red-700' },
  left:      { ar: 'مشي', en: 'Left', className: 'bg-red-50 text-red-700' },
  cancelled: { ar: 'ملغي', en: 'Cancelled', className: 'bg-gray-100 text-gray-500' },
};

const URGENCY_LABEL: Record<'urgent' | 'emergency', { ar: string; en: string; className: string }> = {
  emergency: { ar: 'طارئ', en: 'Emergency', className: 'bg-red-100 text-red-700' },
  urgent:    { ar: 'عاجل', en: 'Urgent', className: 'bg-amber-100 text-amber-800' },
};

/** Western digits in both locales, so counts, money and times read the same. */
const NUM_LOCALE: Record<Lang, string> = { ar: 'ar-EG-u-nu-latn', en: 'en-GB' };

function money(n: number, lang: Lang): string {
  return n.toLocaleString(NUM_LOCALE[lang], {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function formatDay(date: string, lang: Lang): string {
  return new Date(`${date}T00:00:00.000Z`).toLocaleDateString(NUM_LOCALE[lang], {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export default function TodayBoard({ lang }: { lang: Lang }) {
  const isRtl = lang === 'ar';
  const t = (k: keyof typeof T) => T[k][lang];

  const [data, setData] = useState<TodayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [walkIn, setWalkIn] = useState({ name: '', phone: '', complaint: '' });

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/doctor/today?locale=${lang}`, { cache: 'no-store' });
      if (!res.ok) {
        setLoadError(true);
        return;
      }
      setData((await res.json()) as TodayData);
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [lang]);

  useEffect(() => {
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  async function run(action: Action, payload: Record<string, unknown> = {}, busyKey: string = action) {
    setBusy(busyKey);
    setError('');
    try {
      const res = await fetch('/api/doctor/today', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, locale: lang, ...payload }),
      });
      const result = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !result.success) {
        setError(result.error ?? t('failed'));
        return false;
      }
      await load();
      return true;
    } catch {
      setError(t('failed'));
      return false;
    } finally {
      setBusy(null);
    }
  }

  /** Open the waiting-room TV screen (a signed public link) in a new tab. */
  async function openScreen() {
    // Open synchronously so popup blockers allow it, then point it at the link.
    const win = window.open('', '_blank');
    try {
      const res = await fetch(`/api/doctor/display-link?locale=${lang}`);
      const data = (await res.json()) as { path?: string; error?: string };
      if (!res.ok || !data.path) throw new Error(data.error);
      if (win) win.location.href = data.path;
      else window.location.href = data.path;
    } catch {
      win?.close();
      setError(t('failed'));
    }
  }

  async function submitWalkIn(e: React.FormEvent) {
    e.preventDefault();
    const ok = await run('walk_in', {
      patient_name: walkIn.name,
      patient_phone: walkIn.phone,
      chief_complaint: walkIn.complaint,
    });
    if (ok) {
      setWalkIn({ name: '', phone: '', complaint: '' });
      setWalkInOpen(false);
    }
  }

  function markNoShow(row: Row) {
    if (!window.confirm(t('confirmNoShow'))) return;
    run('no_show', { queue_id: row.queue_id, booking_id: row.booking_id }, row.key);
  }

  if (loading) {
    return (
      <div className="p-6 md:p-8 animate-pulse space-y-6" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="h-8 bg-gray-200 rounded w-1/3" />
        <div className="h-28 bg-gray-100 rounded-xl" />
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-xl" />
          ))}
        </div>
        <div className="h-64 bg-gray-100 rounded-xl" />
      </div>
    );
  }

  if (loadError || !data) {
    return (
      <div className="p-6 md:p-8" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-700">{t('loadFailed')}</p>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              load();
            }}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
          >
            {t('retry')}
          </button>
        </div>
      </div>
    );
  }

  const current = data.rows.find((r) => r.state === 'called') ?? null;
  const hasWaiting = data.stats.waiting > 0;
  const hasClinic = data.has_clinic;
  // Assistants run the front desk; the exam itself is the doctor's.
  const canExam = data.viewer_role !== 'assistant';
  const consultHref = (bookingId: string) => `/${lang}/doctor/consultation/${bookingId}`;

  function renderActions(row: Row) {
    const rowBusy = busy === row.key;
    return (
      <div className="flex flex-wrap gap-1.5">
        {row.state === 'expected' && row.appointment_type === 'in_person' && hasClinic && (
          <ActionButton tone="teal" disabled={busy !== null} onClick={() => run('check_in', { booking_id: row.booking_id }, row.key)}>
            {t('checkIn')}
          </ActionButton>
        )}
        {row.state === 'waiting' && (
          <ActionButton tone="amber" disabled={busy !== null} onClick={() => run('call', { queue_id: row.queue_id }, row.key)}>
            {t('call')}
          </ActionButton>
        )}
        {row.state === 'called' && (
          <ActionButton
            tone="emerald"
            disabled={busy !== null}
            onClick={() => run('complete', { queue_id: row.queue_id, booking_id: row.booking_id }, row.key)}
          >
            ✓ {t('markDone')}
          </ActionButton>
        )}
        {(row.state === 'expected' || row.state === 'waiting') && (
          <ActionButton tone="red" disabled={busy !== null} onClick={() => markNoShow(row)}>
            {t('noShow')}
          </ActionButton>
        )}
        {canExam && row.booking_id && row.state !== 'cancelled' && (
          <Link
            href={consultHref(row.booking_id)}
            className="px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors"
          >
            {row.state === 'called' ||
            row.state === 'waiting' ||
            (row.state === 'expected' && row.appointment_type === 'telehealth')
              ? t('openExam')
              : t('view')}
          </Link>
        )}
        {rowBusy && <span className="text-xs text-gray-400 self-center">…</span>}
      </div>
    );
  }

  function typeBadge(row: Row) {
    return (
      <span
        className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
          row.source === 'walk_in'
            ? 'bg-orange-50 text-orange-700'
            : row.appointment_type === 'telehealth'
              ? 'bg-purple-50 text-purple-700'
              : 'bg-blue-50 text-blue-700'
        }`}
      >
        {row.source === 'walk_in' ? t('walkInTag') : row.appointment_type === 'telehealth' ? t('online') : t('clinic')}
      </span>
    );
  }

  function stateBadge(row: Row) {
    const state = STATE_LABEL[row.state];
    return <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${state.className}`}>{state[lang]}</span>;
  }

  function urgencyBadge(row: Row) {
    if (row.urgency !== 'urgent' && row.urgency !== 'emergency') return null;
    const u = URGENCY_LABEL[row.urgency];
    return <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${u.className}`}>{u[lang]}</span>;
  }

  function timeLabel(row: Row) {
    return row.appointment_datetime ? formatSlotClock(row.appointment_datetime, NUM_LOCALE[lang]) : '—';
  }

  return (
    <div className="px-4 pt-16 pb-6 sm:px-6 md:p-8 space-y-6" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1A2F4A]">{t('title')}</h1>
          <p className="text-gray-500 mt-1">{formatDay(data.date, lang)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={load}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            {t('refresh')}
          </button>
          {data.has_clinic && (
            <>
              <button
                type="button"
                onClick={openScreen}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                📺 {t('screen')}
              </button>
              <button
                type="button"
                onClick={() => setWalkInOpen((v) => !v)}
                className="px-4 py-2 border border-teal-600 text-teal-700 rounded-lg text-sm font-medium hover:bg-teal-50 transition-colors"
              >
                {t('addWalkIn')}
              </button>
              <button
                type="button"
                onClick={() => run('call_next')}
                disabled={!hasWaiting || busy !== null}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold transition-colors"
              >
                {t('callNext')}
                {hasWaiting ? ` (${data.stats.waiting})` : ''}
              </button>
            </>
          )}
        </div>
      </div>

      {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg p-3">{error}</div>}

      {!data.has_clinic && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800 flex flex-wrap items-center justify-between gap-3">
          <span>{t('noClinic')}</span>
          <Link href={`/${lang}/doctor/settings`} className="font-semibold text-blue-700 hover:underline">
            {t('settings')}
          </Link>
        </div>
      )}

      {/* Walk-in form */}
      {walkInOpen && data.has_clinic && (
        <form
          onSubmit={submitWalkIn}
          className="bg-white rounded-xl border border-gray-200 p-4 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end"
        >
          <input
            value={walkIn.name}
            onChange={(e) => setWalkIn({ ...walkIn, name: e.target.value })}
            placeholder={t('name')}
            required
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          <input
            value={walkIn.phone}
            onChange={(e) => setWalkIn({ ...walkIn, phone: e.target.value })}
            placeholder={t('phone')}
            inputMode="tel"
            dir="ltr"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          <input
            value={walkIn.complaint}
            onChange={(e) => setWalkIn({ ...walkIn, complaint: e.target.value })}
            placeholder={t('complaint')}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy !== null}
              className="flex-1 px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {t('add')}
            </button>
            <button
              type="button"
              onClick={() => setWalkInOpen(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              {t('cancel')}
            </button>
          </div>
        </form>
      )}

      {/* Current patient */}
      <div
        className={`rounded-xl border-2 p-5 ${
          current ? 'border-amber-300 bg-amber-50' : 'border-dashed border-gray-200 bg-white'
        }`}
      >
        {current ? (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-amber-700">{t('inRoom')}</p>
              <p className="text-xl font-bold text-[#1A2F4A] mt-1">
                {current.queue_number != null && <span className="text-amber-700">#{current.queue_number} — </span>}
                {current.patient_name ?? t('unknown')}
              </p>
              {current.chief_complaint && (
                <p className="text-sm text-gray-600 mt-1">{current.chief_complaint}</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {canExam && current.booking_id && (
                <Link
                  href={consultHref(current.booking_id)}
                  className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-semibold transition-colors"
                >
                  {t('openExam')}
                </Link>
              )}
              <button
                type="button"
                onClick={() => run('complete', { queue_id: current.queue_id, booking_id: current.booking_id }, current.key)}
                disabled={busy !== null}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors"
              >
                ✓ {t('markDone')}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-center text-gray-500 text-sm">{t('noneInRoom')}</p>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <Stat label={t('statTotal')} value={String(data.stats.total)} accent="text-[#1A2F4A]" />
        <Stat label={t('statExpected')} value={String(data.stats.expected)} accent="text-slate-600" />
        <Stat label={t('statWaiting')} value={String(data.stats.waiting)} accent="text-amber-600" />
        <Stat label={t('statDone')} value={String(data.stats.completed)} accent="text-emerald-600" />
        <Stat label={t('statNoShow')} value={String(data.stats.no_show)} accent="text-red-600" />
        <Stat label={`${t('collected')} (${t('egp')})`} value={money(data.stats.collected, lang)} accent="text-teal-700" />
        <Stat label={`${t('outstanding')} (${t('egp')})`} value={money(data.stats.outstanding, lang)} accent="text-orange-600" />
      </div>

      {/* Day list */}
      {data.rows.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="text-5xl mb-4">📋</div>
          <p className="text-gray-600 text-lg mb-2">{t('empty')}</p>
          <p className="text-sm text-gray-400">{t('emptyHint')}</p>
        </div>
      ) : (
        <>
        {/* Cards on small screens, so actions never scroll out of view */}
        <div className="md:hidden space-y-3">
          {data.rows.map((row) => {
            const finished = ['completed', 'no_show', 'left', 'cancelled'].includes(row.state);
            return (
              <div
                key={row.key}
                className={`rounded-xl border p-4 space-y-3 ${
                  row.state === 'called' ? 'bg-amber-50 border-amber-200' : finished ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900">
                      {row.queue_number != null && <span className="text-gray-500">#{row.queue_number} · </span>}
                      {row.patient_name ?? t('unknown')}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1 text-xs text-gray-500">
                      <span>{timeLabel(row)}</span>
                      {typeBadge(row)}
                      {urgencyBadge(row)}
                    </div>
                    {row.chief_complaint && <div className="text-xs text-gray-500 mt-1 line-clamp-2">{row.chief_complaint}</div>}
                  </div>
                  <div className="shrink-0">{stateBadge(row)}</div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <AmountCell row={row} fee={data.consultation_fee_egp} lang={lang} t={t} />
                  {renderActions(row)}
                </div>
              </div>
            );
          })}
        </div>

        <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-[#1A2F4A]">
                  {(['colNo', 'colPatient', 'colTime', 'colType', 'colAmount', 'colStatus', 'colActions'] as const).map((k) => (
                    <th key={k} className="text-start px-4 py-3 font-semibold whitespace-nowrap">
                      {t(k)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.rows.map((row) => {
                  const finished = ['completed', 'no_show', 'left', 'cancelled'].includes(row.state);
                  return (
                    <tr
                      key={row.key}
                      className={`${row.state === 'called' ? 'bg-amber-50' : finished ? 'bg-gray-50/50 text-gray-500' : ''}`}
                    >
                      <td className="px-4 py-3 font-semibold text-gray-500 whitespace-nowrap">
                        {row.queue_number != null ? `#${row.queue_number}` : '—'}
                      </td>
                      <td className="px-4 py-3 min-w-[180px]">
                        <div className="font-medium text-gray-900">{row.patient_name ?? t('unknown')}</div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                          {row.patient_phone && (
                            <span className="text-xs text-gray-500 font-mono" dir="ltr">
                              {row.patient_phone}
                            </span>
                          )}
                          {urgencyBadge(row)}
                        </div>
                        {row.chief_complaint && (
                          <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">{row.chief_complaint}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                        {timeLabel(row)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{typeBadge(row)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <AmountCell row={row} fee={data.consultation_fee_egp} lang={lang} t={t} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{stateBadge(row)}</td>
                      <td className="px-4 py-3">{renderActions(row)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
      <p className={`text-2xl font-bold ${accent}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  );
}

const TONES: Record<'teal' | 'amber' | 'emerald' | 'red', string> = {
  teal: 'bg-teal-600 hover:bg-teal-700 text-white',
  amber: 'bg-amber-100 hover:bg-amber-200 text-amber-800',
  emerald: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  red: 'bg-white border border-red-200 hover:bg-red-50 text-red-700',
};

function ActionButton({
  tone,
  disabled,
  onClick,
  children,
}: {
  tone: keyof typeof TONES;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${TONES[tone]}`}
    >
      {children}
    </button>
  );
}

function AmountCell({
  row,
  fee,
  lang,
  t,
}: {
  row: Row;
  fee: number | null;
  lang: Lang;
  t: (k: keyof typeof T) => string;
}) {
  if (row.billing) {
    const b = row.billing;
    return (
      <div className="space-y-0.5">
        <div>
          <span className="font-semibold text-gray-900">{money(b.patient_pays, lang)}</span>
          {b.total !== b.patient_pays && (
            <span className="text-gray-400"> / {money(b.total, lang)}</span>
          )}
          <span className="text-xs text-gray-500"> {t('egp')}</span>
        </div>
        {b.insurance > 0 && (
          <div className="text-[11px] text-cyan-700">
            {t('insuranceShare')}: {money(b.insurance, lang)}
          </div>
        )}
        <div className={`text-[11px] font-medium ${b.paid ? 'text-emerald-600' : 'text-orange-600'}`}>
          {b.paid ? `✓ ${t('paid')}` : t('unpaid')}
        </div>
      </div>
    );
  }
  if (fee != null && (row.state === 'expected' || row.state === 'waiting' || row.state === 'called')) {
    return (
      <span className="text-xs text-gray-400">
        {t('fee')}: {money(fee, lang)} {t('egp')}
      </span>
    );
  }
  return <span className="text-gray-400">—</span>;
}
