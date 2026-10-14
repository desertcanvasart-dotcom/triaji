'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Lang } from '@triaji/shared/i18n';
import type { VisitTypeRow } from '@/lib/doctor/visit-types';

const T = {
  title:      { ar: 'أنواع الكشف والأسعار', en: 'Visit types & prices' },
  subtitle:   {
    ar: 'كل نوع ليه سعره (كشف، استشارة، إعادة...). السعر بيتكتب لوحده في الفاتورة من شاشة اليوم، والنوع الأساسي بيتختار تلقائياً للمرضى بدون حجز.',
    en: 'Give each kind of visit its own price (consultation, follow-up, …). The price fills the invoice on the Today screen, and the default type is pre-selected for walk-ins.',
  },
  noPriceHint:{ ar: 'من غير سعر = سعر الكشف العادي', en: 'No price = your standard fee' },
  standardFee:{ ar: 'سعر الكشف العادي', en: 'Standard fee' },
  add:        { ar: 'إضافة نوع', en: 'Add visit type' },
  name:       { ar: 'الاسم (مثلاً: استشارة)', en: 'Name (e.g. Follow-up)' },
  price:      { ar: 'السعر (ج.م)', en: 'Price (EGP)' },
  duration:   { ar: 'المدة (دقيقة)', en: 'Duration (min)' },
  isDefault:  { ar: 'أساسي', en: 'Default' },
  makeDefault:{ ar: 'اجعله الأساسي', en: 'Make default' },
  save:       { ar: 'حفظ', en: 'Save' },
  cancel:     { ar: 'إلغاء', en: 'Cancel' },
  edit:       { ar: 'تعديل', en: 'Edit' },
  remove:     { ar: 'حذف', en: 'Delete' },
  minutes:    { ar: 'دقيقة', en: 'min' },
  egp:        { ar: 'ج.م', en: 'EGP' },
  empty:      {
    ar: 'لسه مضفتش أنواع. كل الكشوفات بتتحسب بسعر الكشف العادي.',
    en: 'No visit types yet. Every visit is billed at your standard fee.',
  },
  confirmDel: {
    ar: 'تحذف النوع ده؟ الفواتير والمواعيد القديمة مش هتتأثر.',
    en: 'Delete this visit type? Past invoices and appointments are not affected.',
  },
  loadFailed: { ar: 'تعذر تحميل الأنواع', en: 'Could not load visit types' },
  failed:     { ar: 'حصل خطأ، حاول تاني', en: 'Something went wrong, please try again' },
};

interface Draft {
  name: string;
  price: string;
  duration: string;
}

const EMPTY: Draft = { name: '', price: '', duration: '30' };

export default function VisitTypesManager({ lang }: { lang: Lang }) {
  const isRtl = lang === 'ar';
  const t = (k: keyof typeof T) => T[k][lang];
  const num = (n: number) => n.toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US', { maximumFractionDigits: 2 });

  const [types, setTypes] = useState<VisitTypeRow[]>([]);
  const [fee, setFee] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<Draft>(EMPTY);
  const [editing, setEditing] = useState<{ id: string; draft: Draft } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/doctor/visit-types?locale=${lang}`, { cache: 'no-store' });
      const data = (await res.json()) as { visit_types?: VisitTypeRow[]; default_fee_egp?: number | null; error?: string };
      if (!res.ok) {
        setError(data.error ?? t('loadFailed'));
        return;
      }
      setTypes(data.visit_types ?? []);
      setFee(data.default_fee_egp ?? null);
    } catch {
      setError(t('loadFailed'));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  useEffect(() => {
    load();
  }, [load]);

  async function call(url: string, init: RequestInit): Promise<boolean> {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(url, init);
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? t('failed'));
        return false;
      }
      return true;
    } catch {
      setError(t('failed'));
      return false;
    } finally {
      setBusy(false);
    }
  }

  const json = (method: string, body: Record<string, unknown>): RequestInit => ({
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, locale: lang }),
  });

  const payload = (d: Draft) => ({
    name: d.name,
    price_egp: d.price.trim() === '' ? null : d.price,
    duration_minutes: Number(d.duration),
  });

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!(await call('/api/doctor/visit-types', json('POST', payload(form))))) return;
    setForm(EMPTY);
    setFormOpen(false);
    await load();
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    if (!(await call(`/api/doctor/visit-types/${editing.id}`, json('PATCH', payload(editing.draft))))) return;
    setEditing(null);
    await load();
  }

  async function remove(v: VisitTypeRow) {
    if (!window.confirm(t('confirmDel'))) return;
    if (await call(`/api/doctor/visit-types/${v.id}?locale=${lang}`, { method: 'DELETE' })) await load();
  }

  const input = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500';

  function draftFields(d: Draft, set: (d: Draft) => void) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_8rem_8rem] gap-3">
        <label className="text-xs text-gray-600 space-y-1">
          <span>{t('name')}</span>
          <input value={d.name} onChange={(e) => set({ ...d, name: e.target.value })} required maxLength={60} className={input} />
        </label>
        <label className="text-xs text-gray-600 space-y-1">
          <span>{t('price')}</span>
          <input
            value={d.price}
            onChange={(e) => set({ ...d, price: e.target.value })}
            inputMode="decimal"
            dir="ltr"
            placeholder={fee != null ? String(fee) : ''}
            className={input}
          />
        </label>
        <label className="text-xs text-gray-600 space-y-1">
          <span>{t('duration')}</span>
          <input
            value={d.duration}
            onChange={(e) => set({ ...d, duration: e.target.value })}
            inputMode="numeric"
            dir="ltr"
            required
            className={input}
          />
        </label>
      </div>
    );
  }

  function typeRow(v: VisitTypeRow) {
    if (editing?.id === v.id) {
      return (
        <form key={v.id} onSubmit={saveEdit} className="bg-white rounded-xl border border-teal-300 p-4 space-y-3">
          {draftFields(editing.draft, (draft) => setEditing({ id: v.id, draft }))}
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium">
              {t('save')}
            </button>
            <button type="button" onClick={() => setEditing(null)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600">
              {t('cancel')}
            </button>
          </div>
        </form>
      );
    }
    return (
      <div key={v.id} className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[160px]">
          <p className="font-semibold text-gray-900">
            {v.name}
            {v.is_default && (
              <span className="ms-2 px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 text-[11px] font-medium align-middle">
                {t('isDefault')}
              </span>
            )}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {num(v.duration_minutes)} {t('minutes')}
          </p>
        </div>
        <div className="text-end min-w-[90px]">
          {v.price_egp != null ? (
            <span className="font-semibold text-gray-900">
              {num(v.price_egp)} <span className="text-xs text-gray-500 font-normal">{t('egp')}</span>
            </span>
          ) : (
            <span className="text-xs text-gray-400">
              {fee != null ? `${num(fee)} ${t('egp')}` : '—'}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!v.is_default && (
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                if (await call(`/api/doctor/visit-types/${v.id}`, json('PATCH', { is_default: true }))) await load();
              }}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {t('makeDefault')}
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              setEditing({
                id: v.id,
                draft: { name: v.name, price: v.price_egp != null ? String(v.price_egp) : '', duration: String(v.duration_minutes) },
              })
            }
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {t('edit')}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => remove(v)}
            className="px-3 py-1.5 border border-red-200 rounded-lg text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            {t('remove')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pt-16 pb-6 sm:px-6 md:p-8 space-y-6 max-w-3xl" dir={isRtl ? 'rtl' : 'ltr'}>
      <div>
        <h1 className="text-2xl font-bold text-[#1A2F4A]">{t('title')}</h1>
        <p className="text-gray-500 mt-2 text-sm leading-relaxed">{t('subtitle')}</p>
        {!loading && (
          <p className="text-xs text-gray-500 mt-2">
            {t('standardFee')}: {fee != null ? `${num(fee)} ${t('egp')}` : '—'} · {t('noPriceHint')}
          </p>
        )}
      </div>

      {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg p-3">{error}</div>}

      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {types.length === 0 && <p className="text-sm text-gray-500">{t('empty')}</p>}
          {types.map(typeRow)}
        </div>
      )}

      {formOpen ? (
        <form onSubmit={create} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          {draftFields(form, setForm)}
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="flex-1 px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium">
              {t('add')}
            </button>
            <button type="button" onClick={() => setFormOpen(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600">
              {t('cancel')}
            </button>
          </div>
        </form>
      ) : (
        !loading && (
          <button type="button" onClick={() => setFormOpen(true)} className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium">
            + {t('add')}
          </button>
        )
      )}
    </div>
  );
}
