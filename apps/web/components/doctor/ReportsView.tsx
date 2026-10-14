'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Lang } from '@triaji/shared/i18n';
import type { DoctorReport } from '@/lib/doctor/reports';

const T = {
  title:        { ar: 'التقارير', en: 'Reports' },
  subtitle:     { ar: 'الكشوفات والغياب والدخل للفترة اللي تختارها.', en: 'Visits, no-shows and income for the period you pick.' },
  thisMonth:    { ar: 'الشهر ده', en: 'This month' },
  lastMonth:    { ar: 'الشهر اللي فات', en: 'Last month' },
  last7:        { ar: 'آخر 7 أيام', en: 'Last 7 days' },
  last30:       { ar: 'آخر 30 يوم', en: 'Last 30 days' },
  thisYear:     { ar: 'السنة دي', en: 'This year' },
  from:         { ar: 'من', en: 'From' },
  to:           { ar: 'إلى', en: 'To' },
  visits:       { ar: 'الكشوفات', en: 'Visits' },
  completed:    { ar: 'تم الكشف', en: 'Seen' },
  noShowRate:   { ar: 'نسبة الغياب', en: 'No-show rate' },
  noShows:      { ar: 'غياب', en: 'no-shows' },
  noShowCol:    { ar: 'غياب', en: 'No-shows' },
  patients:     { ar: 'مرضى مختلفين', en: 'Unique patients' },
  walkIns:      { ar: 'بدون حجز', en: 'walk-ins' },
  online:       { ar: 'أونلاين', en: 'online' },
  cancelled:    { ar: 'ملغي', en: 'cancelled' },
  billed:       { ar: 'إجمالي الفواتير', en: 'Billed' },
  collected:    { ar: 'المحصّل', en: 'Collected' },
  outstanding:  { ar: 'لسه متدفعش', en: 'Outstanding' },
  insurance:    { ar: 'على التأمين', en: 'Insurance' },
  discounts:    { ar: 'خصومات', en: 'Discounts' },
  avg:          { ar: 'متوسط الفاتورة', en: 'Average invoice' },
  invoices:     { ar: 'فاتورة', en: 'invoices' },
  chartIncome:  { ar: 'الدخل', en: 'Income' },
  chartVisits:  { ar: 'الكشوفات', en: 'Visits' },
  byType:       { ar: 'الدخل حسب نوع الكشف', en: 'Income by visit type' },
  byMethod:     { ar: 'المحصّل حسب طريقة الدفع', en: 'Collected by payment method' },
  byPeriod:     { ar: 'التفاصيل', en: 'Breakdown' },
  noType:       { ar: 'بدون نوع', en: 'No type' },
  period:       { ar: 'الفترة', en: 'Period' },
  amount:       { ar: 'المبلغ', en: 'Amount' },
  count:        { ar: 'العدد', en: 'Count' },
  csv:          { ar: 'تنزيل Excel (CSV)', en: 'Download CSV' },
  print:        { ar: 'طباعة', en: 'Print' },
  empty:        { ar: 'مفيش بيانات في الفترة دي.', en: 'No data for this period.' },
  egp:          { ar: 'ج.م', en: 'EGP' },
  failed:       { ar: 'تعذر تحميل التقرير', en: 'Could not load the report' },
  retry:        { ar: 'إعادة المحاولة', en: 'Retry' },
};

const METHOD: Record<string, { ar: string; en: string }> = {
  cash: { ar: 'نقدي', en: 'Cash' },
  card: { ar: 'كارت', en: 'Card' },
  insurance: { ar: 'تأمين', en: 'Insurance' },
  partial_insurance: { ar: 'تأمين جزئي', en: 'Partial insurance' },
  bank_transfer: { ar: 'تحويل', en: 'Transfer' },
};

type Preset = 'thisMonth' | 'lastMonth' | 'last7' | 'last30' | 'thisYear';
const PRESETS: Preset[] = ['thisMonth', 'lastMonth', 'last7', 'last30', 'thisYear'];

function cairoToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date()
  );
}

function shift(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

function presetRange(p: Preset): { from: string; to: string } {
  const today = cairoToday();
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  switch (p) {
    case 'thisMonth':
      return { from: `${today.slice(0, 7)}-01`, to: today };
    case 'lastMonth': {
      const first = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 10);
      const last = new Date(Date.UTC(y, m - 1, 0)).toISOString().slice(0, 10);
      return { from: first, to: last };
    }
    case 'last7':
      return { from: shift(today, -6), to: today };
    case 'last30':
      return { from: shift(today, -29), to: today };
    case 'thisYear':
      return { from: `${y}-01-01`, to: today };
  }
}

export default function ReportsView({ lang }: { lang: Lang }) {
  const isRtl = lang === 'ar';
  const t = (k: keyof typeof T) => T[k][lang];
  const numLocale = lang === 'ar' ? 'ar-EG' : 'en-US';
  const fmt = (n: number) => n.toLocaleString(numLocale, { maximumFractionDigits: 2 });
  const money = (n: number) => `${fmt(n)} ${t('egp')}`;

  const [preset, setPreset] = useState<Preset | null>('thisMonth');
  const [range, setRange] = useState(() => presetRange('thisMonth'));
  const [report, setReport] = useState<DoctorReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [chart, setChart] = useState<'income' | 'visits'>('income');

  const load = useCallback(async () => {
    if (!range.from || !range.to || range.from > range.to) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/doctor/reports?from=${range.from}&to=${range.to}&locale=${lang}`, { cache: 'no-store' });
      const data = (await res.json().catch(() => ({}))) as DoctorReport & { error?: string };
      if (!res.ok) {
        setError(data.error ?? T.failed[lang]);
        return;
      }
      setReport(data);
    } catch {
      setError(T.failed[lang]);
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to, lang]);

  useEffect(() => {
    load();
  }, [load]);

  function periodLabel(p: string) {
    if (p.length === 7) {
      return new Date(`${p}-01T00:00:00Z`).toLocaleDateString(numLocale, { month: 'short', year: 'numeric', timeZone: 'UTC' });
    }
    return new Date(`${p}T00:00:00Z`).toLocaleDateString(numLocale, { day: 'numeric', month: 'short', timeZone: 'UTC' });
  }

  function downloadCsv() {
    if (!report) return;
    const head = [t('period'), t('visits'), t('completed'), t('noShowCol'), t('billed'), t('collected'), t('insurance')];
    const lines = report.series.map((b) => [b.period, b.visits, b.completed, b.no_show, b.billed, b.collected, b.insurance].join(','));
    // BOM so Excel opens Arabic headers correctly.
    const blob = new Blob(['﻿' + [head.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `doctortrio-report-${report.from}_${report.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const v = report?.visits;
  const m = report?.money;
  const isEmpty = report && v!.total === 0 && v!.cancelled === 0 && m!.invoices === 0;
  const chartValue = (b: DoctorReport['series'][number]) => (chart === 'income' ? b.billed : b.visits);
  const chartMax = report ? Math.max(1, ...report.series.map(chartValue)) : 1;

  const card = 'bg-white rounded-xl border border-gray-200 p-4';
  const pill = (active: boolean) =>
    `px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
      active ? 'bg-teal-600 border-teal-600 text-white' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
    }`;

  return (
    <div className="px-4 pt-16 pb-6 sm:px-6 md:p-8 space-y-6 print:p-0" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1A2F4A]">{t('title')}</h1>
          <p className="text-gray-500 mt-1 text-sm">{t('subtitle')}</p>
        </div>
        <div className="flex gap-2 print:hidden">
          <button type="button" onClick={downloadCsv} disabled={!report} className={pill(false)}>
            ⬇ {t('csv')}
          </button>
          <button type="button" onClick={() => window.print()} disabled={!report} className={pill(false)}>
            🖨 {t('print')}
          </button>
        </div>
      </div>

      {/* Period */}
      <div className="flex flex-wrap items-end gap-2 print:hidden">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => {
              setPreset(p);
              setRange(presetRange(p));
            }}
            className={pill(preset === p)}
          >
            {t(p)}
          </button>
        ))}
        <label className="flex items-center gap-1.5 text-xs text-gray-600 ms-2">
          {t('from')}
          <input
            type="date"
            value={range.from}
            max={range.to}
            onChange={(e) => {
              setPreset(null);
              setRange({ ...range, from: e.target.value });
            }}
            className="border border-gray-300 rounded-lg px-2 py-1 text-sm"
          />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-gray-600">
          {t('to')}
          <input
            type="date"
            value={range.to}
            min={range.from}
            onChange={(e) => {
              setPreset(null);
              setRange({ ...range, to: e.target.value });
            }}
            className="border border-gray-300 rounded-lg px-2 py-1 text-sm"
          />
        </label>
      </div>
      <p className="hidden print:block text-sm text-gray-600">
        {periodLabel(range.from)} – {periodLabel(range.to)}
      </p>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm rounded-lg p-3 flex items-center justify-between gap-3">
          <span>{error}</span>
          <button type="button" onClick={load} className="underline">
            {t('retry')}
          </button>
        </div>
      )}

      {loading && !report ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-pulse">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-xl" />
          ))}
        </div>
      ) : report && v && m ? (
        <div className={`space-y-6 transition-opacity ${loading ? 'opacity-50' : ''}`}>
          {/* Visits */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className={card}>
              <p className="text-xs text-gray-500">{t('visits')}</p>
              <p className="text-2xl font-bold text-[#1A2F4A] mt-1">{fmt(v.total)}</p>
              <p className="text-[11px] text-gray-400 mt-1">
                {fmt(v.walk_ins)} {t('walkIns')} · {fmt(v.telehealth)} {t('online')}
              </p>
            </div>
            <div className={card}>
              <p className="text-xs text-gray-500">{t('completed')}</p>
              <p className="text-2xl font-bold text-emerald-700 mt-1">{fmt(v.completed)}</p>
              {v.cancelled > 0 && (
                <p className="text-[11px] text-gray-400 mt-1">
                  {fmt(v.cancelled)} {t('cancelled')}
                </p>
              )}
            </div>
            <div className={card}>
              <p className="text-xs text-gray-500">{t('noShowRate')}</p>
              <p className={`text-2xl font-bold mt-1 ${v.no_show_rate != null && v.no_show_rate >= 0.2 ? 'text-red-600' : 'text-[#1A2F4A]'}`}>
                {v.no_show_rate == null ? '—' : `${fmt(Math.round(v.no_show_rate * 100))}%`}
              </p>
              <p className="text-[11px] text-gray-400 mt-1">
                {fmt(v.no_show)} {t('noShows')}
              </p>
            </div>
            <div className={card}>
              <p className="text-xs text-gray-500">{t('patients')}</p>
              <p className="text-2xl font-bold text-[#1A2F4A] mt-1">{fmt(v.unique_patients)}</p>
            </div>
          </div>

          {/* Money */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className={card}>
              <p className="text-xs text-gray-500">{t('billed')}</p>
              <p className="text-lg font-bold text-[#1A2F4A] mt-1">{money(m.billed)}</p>
              <p className="text-[11px] text-gray-400 mt-1">
                {fmt(m.invoices)} {t('invoices')}
              </p>
            </div>
            <div className={card}>
              <p className="text-xs text-gray-500">{t('collected')}</p>
              <p className="text-lg font-bold text-emerald-700 mt-1">{money(m.collected)}</p>
            </div>
            <div className={card}>
              <p className="text-xs text-gray-500">{t('outstanding')}</p>
              <p className={`text-lg font-bold mt-1 ${m.outstanding > 0 ? 'text-orange-600' : 'text-[#1A2F4A]'}`}>{money(m.outstanding)}</p>
            </div>
            <div className={card}>
              <p className="text-xs text-gray-500">{t('insurance')}</p>
              <p className="text-lg font-bold text-cyan-700 mt-1">{money(m.insurance)}</p>
            </div>
            <div className={card}>
              <p className="text-xs text-gray-500">{t('discounts')}</p>
              <p className="text-lg font-bold text-[#1A2F4A] mt-1">{money(m.discounts)}</p>
            </div>
            <div className={card}>
              <p className="text-xs text-gray-500">{t('avg')}</p>
              <p className="text-lg font-bold text-[#1A2F4A] mt-1">{m.avg_per_visit == null ? '—' : money(m.avg_per_visit)}</p>
            </div>
          </div>

          {isEmpty ? (
            <p className="text-sm text-gray-500">{t('empty')}</p>
          ) : (
            <>
              {/* Chart */}
              <div className={card}>
                <div className="flex gap-2 mb-4 print:hidden">
                  <button type="button" onClick={() => setChart('income')} className={pill(chart === 'income')}>
                    {t('chartIncome')}
                  </button>
                  <button type="button" onClick={() => setChart('visits')} className={pill(chart === 'visits')}>
                    {t('chartVisits')}
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <div className="flex items-end gap-1 h-48 min-w-full" style={{ minWidth: `${report.series.length * 18}px` }}>
                    {report.series.map((b) => {
                      const value = chartValue(b);
                      const label = chart === 'income' ? money(value) : fmt(value);
                      return (
                        <div key={b.period} className="flex-1 h-full flex flex-col justify-end items-center group relative min-w-[14px]">
                          <div
                            className={`w-full rounded-t ${chart === 'income' ? 'bg-teal-500' : 'bg-indigo-400'} group-hover:opacity-80`}
                            style={{ height: `${(value / chartMax) * 100}%`, minHeight: value > 0 ? 2 : 0 }}
                            title={`${periodLabel(b.period)}: ${label}`}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex gap-1 mt-1 text-[10px] text-gray-400" style={{ minWidth: `${report.series.length * 18}px` }}>
                    {report.series.map((b, i) => {
                      const every = Math.ceil(report.series.length / 10);
                      return (
                        <span key={b.period} className="flex-1 min-w-[14px] text-center whitespace-nowrap overflow-visible">
                          {i % every === 0 ? periodLabel(b.period) : ''}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* By visit type */}
                <div className={card}>
                  <h2 className="font-semibold text-[#1A2F4A] mb-3">{t('byType')}</h2>
                  {report.by_visit_type.length === 0 ? (
                    <p className="text-sm text-gray-400">—</p>
                  ) : (
                    <div className="space-y-2">
                      {report.by_visit_type.map((r) => {
                        const share = m.billed > 0 ? r.billed / m.billed : 0;
                        return (
                          <div key={r.id ?? 'none'}>
                            <div className="flex justify-between text-sm">
                              <span className={r.name ? 'text-gray-800' : 'text-gray-400'}>
                                {r.name ?? t('noType')} <span className="text-xs text-gray-400">({fmt(r.invoices)})</span>
                              </span>
                              <span className="font-medium text-gray-900">{money(r.billed)}</span>
                            </div>
                            <div className="h-1.5 bg-gray-100 rounded mt-1">
                              <div className="h-full bg-teal-500 rounded" style={{ width: `${share * 100}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* By payment method */}
                <div className={card}>
                  <h2 className="font-semibold text-[#1A2F4A] mb-3">{t('byMethod')}</h2>
                  {report.by_payment_method.length === 0 ? (
                    <p className="text-sm text-gray-400">—</p>
                  ) : (
                    <table className="w-full text-sm">
                      <tbody>
                        {report.by_payment_method.map((r) => (
                          <tr key={r.method} className="border-b border-gray-100 last:border-0">
                            <td className="py-2 text-gray-800">{METHOD[r.method]?.[lang] ?? r.method}</td>
                            <td className="py-2 text-gray-400 text-xs">{fmt(r.count)}</td>
                            <td className="py-2 text-end font-medium text-gray-900">{money(r.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Breakdown table */}
              <div className={`${card} overflow-x-auto`}>
                <h2 className="font-semibold text-[#1A2F4A] mb-3">{t('byPeriod')}</h2>
                <table className="w-full text-sm min-w-[560px]">
                  <thead>
                    <tr className="text-xs text-gray-500 border-b border-gray-200">
                      <th className="py-2 text-start font-medium">{t('period')}</th>
                      <th className="py-2 text-start font-medium">{t('visits')}</th>
                      <th className="py-2 text-start font-medium">{t('completed')}</th>
                      <th className="py-2 text-start font-medium">{t('noShowCol')}</th>
                      <th className="py-2 text-end font-medium">{t('billed')}</th>
                      <th className="py-2 text-end font-medium">{t('collected')}</th>
                      <th className="py-2 text-end font-medium">{t('insurance')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.series
                      .filter((b) => b.visits > 0 || b.billed > 0)
                      .map((b) => (
                        <tr key={b.period} className="border-b border-gray-100 last:border-0">
                          <td className="py-2 text-gray-800">{periodLabel(b.period)}</td>
                          <td className="py-2">{fmt(b.visits)}</td>
                          <td className="py-2 text-emerald-700">{fmt(b.completed)}</td>
                          <td className="py-2 text-red-600">{b.no_show ? fmt(b.no_show) : '—'}</td>
                          <td className="py-2 text-end">{fmt(b.billed)}</td>
                          <td className="py-2 text-end text-emerald-700">{fmt(b.collected)}</td>
                          <td className="py-2 text-end text-cyan-700">{b.insurance ? fmt(b.insurance) : '—'}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
