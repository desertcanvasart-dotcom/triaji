'use client';

import { useCallback, useEffect, useState } from 'react';
import type { PrescriptionTemplate, TemplateMedication } from '@/lib/doctor/prescription-templates';

/** What the form hands over when the doctor saves the current prescription. */
export interface TemplateDraft {
  diagnosis_ar: string;
  diagnosis_en: string;
  medications: TemplateMedication[];
  pharmacist_notes: string;
  follow_up_value: number;
  follow_up_unit: 'day' | 'week' | 'month';
}

interface Props {
  lang: 'ar' | 'en';
  /** Snapshot of the form, read only when the doctor clicks save. */
  getDraft: () => TemplateDraft;
  canSave: boolean;
  onApply: (template: PrescriptionTemplate) => boolean;
}

const SHOW_INLINE = 8;

const T = {
  title:       { ar: 'قوالب الروشتة', en: 'Prescription templates' },
  empty:       {
    ar: 'لسه معندكش قوالب — اكتب روشتة واحفظها كقالب عشان تستخدمها بضغطة واحدة.',
    en: 'No templates yet — write a prescription and save it as a template to reuse it in one click.',
  },
  saveCurrent: { ar: 'حفظ الروشتة دي كقالب', en: 'Save this as a template' },
  namePh:      { ar: 'اسم القالب (مثال: خلع ضرس عادي)', en: 'Template name (e.g. Simple extraction)' },
  save:        { ar: 'حفظ', en: 'Save' },
  cancel:      { ar: 'إلغاء', en: 'Cancel' },
  saved:       { ar: 'تم حفظ القالب', en: 'Template saved' },
  search:      { ar: 'دوّر في القوالب...', en: 'Search templates...' },
  showAll:     { ar: 'كل القوالب', en: 'All templates' },
  showLess:    { ar: 'أقل', en: 'Show less' },
  meds:        { ar: 'دواء', en: 'meds' },
  delete:      { ar: 'مسح القالب', en: 'Delete template' },
  confirmDel:  { ar: 'متأكد إنك عايز تمسح القالب ده؟', en: 'Delete this template?' },
  loadFailed:  { ar: 'تعذر تحميل القوالب', en: 'Could not load templates' },
  failed:      { ar: 'حصل خطأ، حاول تاني', en: 'Something went wrong, please try again' },
  needMed:     { ar: 'اكتب دواء واحد على الأقل الأول', en: 'Add at least one medication first' },
};

export default function PrescriptionTemplates({ lang, getDraft, canSave, onApply }: Props) {
  const t = (k: keyof typeof T) => T[k][lang];

  const [templates, setTemplates] = useState<PrescriptionTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/doctor/prescription-templates?locale=${lang}`, { cache: 'no-store' });
      const data = (await res.json()) as { templates?: PrescriptionTemplate[]; error?: string };
      if (!res.ok) {
        setError(data.error ?? t('loadFailed'));
        return;
      }
      setTemplates(data.templates ?? []);
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

  function apply(template: PrescriptionTemplate) {
    setError('');
    setNotice('');
    if (!onApply(template)) return;
    // Ranking only — the prescription is already filled in, so never block on this.
    setTemplates((prev) =>
      prev.map((x) => (x.id === template.id ? { ...x, use_count: x.use_count + 1 } : x))
    );
    fetch(`/api/doctor/prescription-templates/${template.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ used: true, locale: lang }),
    }).catch(() => {});
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setNotice('');
    setSaving(true);
    try {
      const res = await fetch('/api/doctor/prescription-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...getDraft(), name, locale: lang }),
      });
      const data = (await res.json()) as { template?: PrescriptionTemplate; error?: string };
      if (!res.ok || !data.template) {
        setError(data.error ?? t('failed'));
        return;
      }
      setTemplates((prev) => [...prev, data.template as PrescriptionTemplate]);
      setNaming(false);
      setName('');
      setNotice(t('saved'));
    } catch {
      setError(t('failed'));
    } finally {
      setSaving(false);
    }
  }

  async function remove(template: PrescriptionTemplate) {
    if (!window.confirm(`${t('confirmDel')}\n\n${template.name}`)) return;
    setError('');
    setNotice('');
    try {
      const res = await fetch(`/api/doctor/prescription-templates/${template.id}?locale=${lang}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? t('failed'));
        return;
      }
      setTemplates((prev) => prev.filter((x) => x.id !== template.id));
    } catch {
      setError(t('failed'));
    }
  }

  const q = query.trim().toLowerCase();
  const filtered = q
    ? templates.filter(
        (x) =>
          x.name.toLowerCase().includes(q) ||
          (x.diagnosis_ar ?? '').toLowerCase().includes(q) ||
          (x.diagnosis_en ?? '').toLowerCase().includes(q)
      )
    : templates;
  const visible = expanded || q ? filtered : filtered.slice(0, SHOW_INLINE);

  return (
    <div className="rounded-lg border border-teal-100 bg-teal-50/40 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-[Cairo] font-semibold text-gray-800 text-sm">📋 {t('title')}</h3>
        {!naming && (
          <button
            type="button"
            onClick={() => {
              if (!canSave) {
                setError(t('needMed'));
                return;
              }
              setError('');
              setNaming(true);
            }}
            className="text-xs font-[Cairo] font-semibold text-teal-700 hover:text-teal-800"
          >
            + {t('saveCurrent')}
          </button>
        )}
      </div>

      {naming && (
        <form onSubmit={save} className="flex flex-col sm:flex-row gap-2">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            required
            placeholder={t('namePh')}
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-[Cairo] focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-[Cairo] font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
            >
              {t('save')}
            </button>
            <button
              type="button"
              onClick={() => {
                setNaming(false);
                setName('');
              }}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-[Cairo] text-gray-600 hover:bg-gray-50"
            >
              {t('cancel')}
            </button>
          </div>
        </form>
      )}

      {error && <p className="text-xs text-red-600 font-[Cairo]">{error}</p>}
      {notice && <p className="text-xs text-emerald-700 font-[Cairo]">✓ {notice}</p>}

      {loading ? (
        <div className="flex gap-2 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 w-28 rounded-full bg-teal-100" />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <p className="text-xs text-gray-500 font-[Cairo]">{t('empty')}</p>
      ) : (
        <>
          {templates.length > SHOW_INLINE && (
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('search')}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-[Cairo] focus:border-teal-500 focus:outline-none"
            />
          )}
          <div className="flex flex-wrap gap-2">
            {visible.map((template) => (
              <span
                key={template.id}
                className="inline-flex items-center rounded-full border border-teal-200 bg-white text-sm font-[Cairo] overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => apply(template)}
                  title={template.diagnosis_ar ?? template.diagnosis_en ?? undefined}
                  className="px-3 py-1.5 text-teal-800 hover:bg-teal-50"
                >
                  {template.name}
                  <span className="text-[11px] text-gray-400">
                    {' '}
                    · {template.medications.length} {t('meds')}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => remove(template)}
                  aria-label={t('delete')}
                  title={t('delete')}
                  className="px-2 py-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 border-s border-teal-100"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          {!q && filtered.length > SHOW_INLINE && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-xs font-[Cairo] text-teal-700 hover:underline"
            >
              {expanded ? t('showLess') : `${t('showAll')} (${filtered.length})`}
            </button>
          )}
        </>
      )}
    </div>
  );
}
