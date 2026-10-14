'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { ExamField } from '@/lib/doctor/exam-fields';

/**
 * "Exam details" card on the consultation page: the doctor's custom fields
 * (migration 078) with the values saved for this booking.
 */

const T = {
  title:    { ar: 'بيانات الكشف', en: 'Exam details' },
  manage:   { ar: 'تعديل الحقول', en: 'Edit fields' },
  none:     {
    ar: 'تقدر تضيف حقولك الخاصة (رقم السن، درجة الألم، الضغط...) وتظهر هنا في كل كشف.',
    en: 'Add your own fields (tooth number, pain score, BP…) and they appear here at every visit.',
  },
  setup:    { ar: 'إضافة حقول', en: 'Add fields' },
  save:     { ar: 'حفظ البيانات', en: 'Save details' },
  saving:   { ar: 'جاري الحفظ...', en: 'Saving...' },
  saved:    { ar: 'تم الحفظ', en: 'Saved' },
  unsaved:  { ar: 'فيه تعديلات لسه متحفظتش', en: 'You have unsaved changes' },
  missing:  { ar: 'حقول إجبارية لسه فاضية: {n}', en: 'Required fields still empty: {n}' },
  yes:      { ar: 'نعم', en: 'Yes' },
  no:       { ar: 'لا', en: 'No' },
  choose:   { ar: 'اختار...', en: 'Choose...' },
  archived: { ar: '(مؤرشف)', en: '(archived)' },
  failed:   { ar: 'حصل خطأ، حاول تاني', en: 'Something went wrong, please try again' },
};

export default function ExamFieldsCard({ bookingId, lang }: { bookingId: string; lang: 'ar' | 'en' }) {
  const t = (k: keyof typeof T) => T[k][lang];
  const [fields, setFields] = useState<ExamField[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const apply = (data: { fields?: ExamField[]; values?: Record<string, string> }) => {
    setFields(data.fields ?? []);
    setValues(data.values ?? {});
    setSaved(data.values ?? {});
  };

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/doctor/consultation/${bookingId}/fields?locale=${lang}`, { cache: 'no-store' });
      if (res.ok) apply(await res.json());
    } finally {
      setLoading(false);
    }
  }, [bookingId, lang]);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      // Send every field so cleared values are removed too.
      const payload: Record<string, string | null> = {};
      for (const f of fields) payload[f.id] = values[f.id] ?? null;
      const res = await fetch(`/api/doctor/consultation/${bookingId}/fields`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: payload, locale: lang }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ text: data.error ?? t('failed'), ok: false });
        return;
      }
      apply(data);
      setMessage({ text: t('saved'), ok: true });
    } catch {
      setMessage({ text: t('failed'), ok: false });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 h-24 animate-pulse" />;
  }

  const dirty = fields.some((f) => (values[f.id] ?? '') !== (saved[f.id] ?? ''));
  const missing = fields.filter((f) => f.is_active && f.is_required && !(values[f.id] ?? '').trim()).length;
  const input =
    'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500';

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-[#1A2F4A]">{t('title')}</h2>
        <Link href={`/${lang}/doctor/exam-fields`} className="text-xs font-medium text-teal-700 hover:underline">
          {fields.length > 0 ? t('manage') : t('setup')}
        </Link>
      </div>

      {fields.length === 0 ? (
        <p className="text-sm text-gray-500">{t('none')}</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {fields.map((f) => {
              const v = values[f.id] ?? '';
              const set = (next: string) => setValues((prev) => ({ ...prev, [f.id]: next }));
              const wide = f.field_type === 'long_text';
              // Yes/No are buttons, which a <label> would hijack — use a plain group.
              const Wrapper = f.field_type === 'boolean' ? 'div' : 'label';
              return (
                <Wrapper
                  key={f.id}
                  role={f.field_type === 'boolean' ? 'group' : undefined}
                  aria-label={f.field_type === 'boolean' ? f.label : undefined}
                  className={`block space-y-1 ${wide ? 'sm:col-span-2' : ''}`}
                >
                  <span className="text-sm font-medium text-gray-700">
                    {f.label}
                    {f.unit && <span className="text-xs text-gray-500 font-normal"> ({f.unit})</span>}
                    {f.is_required && f.is_active && <span className="text-red-600"> *</span>}
                    {!f.is_active && <span className="text-xs text-gray-400 font-normal"> {t('archived')}</span>}
                  </span>
                  {f.field_type === 'long_text' ? (
                    <textarea value={v} onChange={(e) => set(e.target.value)} rows={3} maxLength={4000} className={input} />
                  ) : f.field_type === 'number' ? (
                    <input value={v} onChange={(e) => set(e.target.value)} inputMode="decimal" dir="ltr" className={input} />
                  ) : f.field_type === 'select' ? (
                    <select value={v} onChange={(e) => set(e.target.value)} className={input}>
                      <option value="">{t('choose')}</option>
                      {f.options.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  ) : f.field_type === 'boolean' ? (
                    <div className="flex gap-2">
                      {(['true', 'false'] as const).map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => set(v === opt ? '' : opt)}
                          className={`px-4 py-2 rounded-lg text-sm border transition-colors ${
                            v === opt ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-700 border-gray-300'
                          }`}
                        >
                          {opt === 'true' ? t('yes') : t('no')}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <input value={v} onChange={(e) => set(e.target.value)} maxLength={500} className={input} />
                  )}
                </Wrapper>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs space-y-0.5">
              {missing > 0 && <p className="text-amber-700">{t('missing').replace('{n}', String(missing))}</p>}
              {dirty && <p className="text-gray-500">{t('unsaved')}</p>}
              {message && <p className={message.ok ? 'text-emerald-700' : 'text-red-600'}>{message.ok ? '✓ ' : ''}{message.text}</p>}
            </div>
            <button
              type="button"
              onClick={save}
              disabled={saving || !dirty}
              className="px-5 py-2.5 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white rounded-xl text-sm font-semibold"
            >
              {saving ? t('saving') : t('save')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
