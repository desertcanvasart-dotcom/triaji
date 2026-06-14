'use client';

import { useState, useCallback } from 'react';
import { type Lang } from '@triaji/shared/i18n';

// ─── Types ──────────────────────────────────────────────────────────────────

interface GPNote {
  id: string;
  note_ar: string;
  note_en: string | null;
  created_at: string;
  doctor_account_id: string;
}

interface GPNoteFormProps {
  patientId: string;
  notes: GPNote[];
  lang: Lang;
  onNoteAdded?: (note: GPNote) => void;
}

// ─── Strings ────────────────────────────────────────────────────────────────

const strings = {
  title: { ar: 'ملاحظات طبيب العائلة', en: 'GP Notes' },
  noteArLabel: { ar: 'الملاحظة (عربي)', en: 'Note (Arabic)' },
  noteEnLabel: { ar: 'الملاحظة (إنجليزي) - اختياري', en: 'Note (English) - optional' },
  placeholder: { ar: 'اكتب ملاحظتك هنا...', en: 'Write your note here...' },
  placeholderEn: { ar: 'Write your note in English (optional)...', en: 'Write your note in English (optional)...' },
  save: { ar: 'حفظ الملاحظة', en: 'Save Note' },
  saving: { ar: 'جاري الحفظ...', en: 'Saving...' },
  saved: { ar: 'تم الحفظ', en: 'Saved' },
  errorSaving: { ar: 'حصل مشكلة في حفظ الملاحظة', en: 'Failed to save note' },
  noNotes: { ar: 'لا توجد ملاحظات سابقة', en: 'No previous notes' },
  previousNotes: { ar: 'الملاحظات السابقة', en: 'Previous Notes' },
  addNew: { ar: 'إضافة ملاحظة جديدة', en: 'Add New Note' },
};

function s(key: keyof typeof strings, lang: Lang): string {
  return (strings[key] as Record<string, string>)?.[lang] ?? key;
}

function formatDateTime(dateStr: string, lang: Lang): string {
  return new Date(dateStr).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function GPNoteForm({ patientId, notes, lang, onNoteAdded }: GPNoteFormProps) {
  const isRTL = lang === 'ar';
  const [noteAr, setNoteAr] = useState('');
  const [noteEn, setNoteEn] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [showForm, setShowForm] = useState(false);

  const handleSave = useCallback(async () => {
    if (!noteAr.trim()) return;

    setSaving(true);
    setSaveStatus('idle');

    try {
      const res = await fetch(`/api/doctor/patients/${patientId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          note_ar: noteAr.trim(),
          note_en: noteEn.trim() || undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSaveStatus('saved');
        setNoteAr('');
        setNoteEn('');
        setShowForm(false);

        if (onNoteAdded && data.note) {
          onNoteAdded(data.note);
        }

        // Reset status after 3 seconds
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        setSaveStatus('error');
      }
    } catch {
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  }, [noteAr, noteEn, patientId, onNoteAdded]);

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-[#1A2F4A] flex items-center gap-2">
          <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          {s('title', lang)}
        </h3>
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg transition-colors"
          >
            {s('addNew', lang)}
          </button>
        )}
      </div>

      {/* Note form */}
      {showForm && (
        <div className="mb-6 space-y-3 p-4 bg-gray-50 rounded-lg">
          {/* Arabic note */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {s('noteArLabel', lang)}
            </label>
            <textarea
              value={noteAr}
              onChange={e => setNoteAr(e.target.value)}
              placeholder={s('placeholder', lang)}
              dir="rtl"
              rows={4}
              maxLength={5000}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm resize-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-cairo"
            />
          </div>

          {/* English note (optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {s('noteEnLabel', lang)}
            </label>
            <textarea
              value={noteEn}
              onChange={e => setNoteEn(e.target.value)}
              placeholder={s('placeholderEn', lang)}
              dir="ltr"
              rows={3}
              maxLength={5000}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm resize-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          {/* Save status + buttons */}
          <div className="flex items-center justify-between">
            <div>
              {saveStatus === 'saved' && (
                <span className="text-green-600 text-sm font-medium">{s('saved', lang)}</span>
              )}
              {saveStatus === 'error' && (
                <span className="text-red-600 text-sm font-medium">{s('errorSaving', lang)}</span>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setShowForm(false); setNoteAr(''); setNoteEn(''); }}
                className="px-4 py-2 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-50 transition-colors"
              >
                {isRTL ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!noteAr.trim() || saving}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? s('saving', lang) : s('save', lang)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Previous notes list */}
      {notes.length > 0 ? (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-500">{s('previousNotes', lang)}</h4>
          {notes.map(note => (
            <div key={note.id} className="p-3 bg-gray-50 rounded-lg border-r-2 border-r-indigo-300">
              <p className="text-sm text-[#1A2F4A] whitespace-pre-wrap" dir="rtl">
                {note.note_ar}
              </p>
              {note.note_en && (
                <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap" dir="ltr">
                  {note.note_en}
                </p>
              )}
              <p className="text-xs text-gray-400 mt-2">
                {formatDateTime(note.created_at, lang)}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-400 text-center py-4 text-sm">{s('noNotes', lang)}</p>
      )}
    </section>
  );
}
