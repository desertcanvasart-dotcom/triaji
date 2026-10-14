'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Lang } from '@triaji/shared/i18n';
import type { ExamField, ExamFieldType } from '@/lib/doctor/exam-fields';

const TYPES: { value: ExamFieldType; ar: string; en: string }[] = [
  { value: 'text', ar: 'نص قصير', en: 'Short text' },
  { value: 'long_text', ar: 'نص طويل', en: 'Long text' },
  { value: 'number', ar: 'رقم', en: 'Number' },
  { value: 'select', ar: 'اختيار من قائمة', en: 'Choice list' },
  { value: 'boolean', ar: 'نعم / لا', en: 'Yes / No' },
];

const T = {
  title:      { ar: 'حقول الكشف', en: 'Exam fields' },
  subtitle:   {
    ar: 'أضف الحقول اللي بتسجلها في كل كشف (رقم السن، درجة الألم، الضغط...). هتظهر في كارت "بيانات الكشف" في صفحة كل كشف.',
    en: 'Add the details you record at every visit (tooth number, pain score, BP…). They appear in an "Exam details" card on every exam page.',
  },
  add:        { ar: 'إضافة حقل', en: 'Add field' },
  label:      { ar: 'اسم الحقل', en: 'Field name' },
  type:       { ar: 'النوع', en: 'Type' },
  options:    { ar: 'الاختيارات (كل اختيار في سطر)', en: 'Choices (one per line)' },
  unit:       { ar: 'الوحدة (اختياري)، مثلاً mmHg', en: 'Unit (optional), e.g. mmHg' },
  required:   { ar: 'إجباري', en: 'Required' },
  save:       { ar: 'إضافة', en: 'Add' },
  cancel:     { ar: 'إلغاء', en: 'Cancel' },
  empty:      { ar: 'لسه مضفتش حقول.', en: 'No fields yet.' },
  archived:   { ar: 'مؤرشف', en: 'Archived' },
  archive:    { ar: 'أرشفة', en: 'Archive' },
  restore:    { ar: 'استرجاع', en: 'Restore' },
  remove:     { ar: 'حذف', en: 'Delete' },
  up:         { ar: 'لفوق', en: 'Move up' },
  down:       { ar: 'لتحت', en: 'Move down' },
  confirmDel: {
    ar: 'تحذف الحقل ده؟ لو عليه بيانات من كشوفات قديمة هيتأرشف بدل ما يتمسح عشان البيانات متضيعش.',
    en: 'Delete this field? If past visits have values for it, it will be archived instead so that data is kept.',
  },
  wasArchived:{ ar: 'الحقل عليه بيانات قديمة، فاتأرشف بدل ما يتمسح.', en: 'The field had past values, so it was archived instead of deleted.' },
  loadFailed: { ar: 'تعذر تحميل الحقول', en: 'Could not load fields' },
  failed:     { ar: 'حصل خطأ، حاول تاني', en: 'Something went wrong, please try again' },
};

export default function ExamFieldsManager({ lang }: { lang: Lang }) {
  const isRtl = lang === 'ar';
  const t = (k: keyof typeof T) => T[k][lang];

  const [fields, setFields] = useState<ExamField[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ label: '', field_type: 'text' as ExamFieldType, options: '', unit: '', is_required: false });

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/doctor/exam-fields?locale=${lang}`, { cache: 'no-store' });
      const data = (await res.json()) as { fields?: ExamField[]; error?: string };
      if (!res.ok) {
        setError(data.error ?? t('loadFailed'));
        return;
      }
      setFields(data.fields ?? []);
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

  async function call(url: string, init: RequestInit): Promise<Record<string, unknown> | null> {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await fetch(url, init);
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        setError((data.error as string) ?? t('failed'));
        return null;
      }
      return data;
    } catch {
      setError(t('failed'));
      return null;
    } finally {
      setBusy(false);
    }
  }

  const patch = (id: string, body: Record<string, unknown>) =>
    call(`/api/doctor/exam-fields/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, locale: lang }),
    });

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const data = await call('/api/doctor/exam-fields', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        label: form.label,
        field_type: form.field_type,
        options: form.field_type === 'select' ? form.options.split('\n') : undefined,
        unit: form.field_type === 'number' ? form.unit : undefined,
        is_required: form.is_required,
        locale: lang,
      }),
    });
    if (!data) return;
    setForm({ label: '', field_type: 'text', options: '', unit: '', is_required: false });
    setFormOpen(false);
    await load();
  }

  async function move(index: number, delta: -1 | 1) {
    const active = fields.filter((f) => f.is_active);
    const other = active[index + delta];
    const current = active[index];
    if (!current || !other) return;
    // Swap positions; fall back to list positions when orders collide.
    const a = current.sort_order === other.sort_order ? index : current.sort_order;
    const b = current.sort_order === other.sort_order ? index + delta : other.sort_order;
    if ((await patch(current.id, { sort_order: b })) && (await patch(other.id, { sort_order: a }))) await load();
  }

  async function remove(f: ExamField) {
    if (!window.confirm(t('confirmDel'))) return;
    const data = await call(`/api/doctor/exam-fields/${f.id}?locale=${lang}`, { method: 'DELETE' });
    if (!data) return;
    if (data.archived) setNotice(t('wasArchived'));
    await load();
  }

  const active = fields.filter((f) => f.is_active);
  const archived = fields.filter((f) => !f.is_active);
  const typeLabel = (v: ExamFieldType) => TYPES.find((x) => x.value === v)?.[lang] ?? v;
  const input = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500';

  function fieldRow(f: ExamField, index: number) {
    return (
      <div key={f.id} className={`bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap items-center gap-3 ${f.is_active ? '' : 'opacity-60'}`}>
        <div className="flex-1 min-w-[180px]">
          <p className="font-semibold text-gray-900">
            {f.label}
            {f.unit && <span className="text-xs text-gray-500 font-normal"> ({f.unit})</span>}
            {f.is_required && <span className="text-red-600"> *</span>}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {typeLabel(f.field_type)}
            {f.field_type === 'select' && f.options.length > 0 && ` · ${f.options.join(' / ')}`}
            {!f.is_active && ` · ${t('archived')}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {f.is_active && (
            <>
              <label className="flex items-center gap-1.5 text-xs text-gray-600">
                <input
                  type="checkbox"
                  checked={f.is_required}
                  disabled={busy}
                  onChange={async (e) => {
                    if (await patch(f.id, { is_required: e.target.checked })) await load();
                  }}
                  className="accent-teal-600"
                />
                {t('required')}
              </label>
              <button type="button" disabled={busy || index === 0} onClick={() => move(index, -1)} title={t('up')} className="px-2 py-1 border border-gray-200 rounded text-xs disabled:opacity-30">
                ↑
              </button>
              <button type="button" disabled={busy || index === active.length - 1} onClick={() => move(index, 1)} title={t('down')} className="px-2 py-1 border border-gray-200 rounded text-xs disabled:opacity-30">
                ↓
              </button>
            </>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              if (await patch(f.id, { is_active: !f.is_active })) await load();
            }}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {f.is_active ? t('archive') : t('restore')}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => remove(f)}
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
      </div>

      {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg p-3">{error}</div>}
      {notice && <div className="bg-amber-50 text-amber-800 text-sm rounded-lg p-3">{notice}</div>}

      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {active.length === 0 && <p className="text-sm text-gray-500">{t('empty')}</p>}
          {active.map((f, i) => fieldRow(f, i))}
        </div>
      )}

      {formOpen ? (
        <form onSubmit={create} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder={t('label')} required maxLength={80} className={input} />
          <label className="block text-xs text-gray-600 space-y-1">
            <span>{t('type')}</span>
            <select value={form.field_type} onChange={(e) => setForm({ ...form, field_type: e.target.value as ExamFieldType })} className={input}>
              {TYPES.map((x) => (
                <option key={x.value} value={x.value}>
                  {x[lang]}
                </option>
              ))}
            </select>
          </label>
          {form.field_type === 'select' && (
            <textarea value={form.options} onChange={(e) => setForm({ ...form, options: e.target.value })} placeholder={t('options')} rows={4} required className={input} />
          )}
          {form.field_type === 'number' && (
            <input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder={t('unit')} maxLength={20} className={input} />
          )}
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={form.is_required} onChange={(e) => setForm({ ...form, is_required: e.target.checked })} className="w-4 h-4 accent-teal-600" />
            {t('required')}
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="flex-1 px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium">
              {t('save')}
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

      {archived.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-gray-200">
          <p className="text-xs font-semibold text-gray-500">{t('archived')}</p>
          {archived.map((f, i) => fieldRow(f, i))}
        </div>
      )}
    </div>
  );
}
