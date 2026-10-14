'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Lang } from '@triaji/shared/i18n';

interface Assistant {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
}

const T = {
  title:       { ar: 'المساعدون', en: 'Assistants' },
  subtitle:    {
    ar: 'المساعد بيدخل من صفحة دخول الأطباء بإيميله وكلمة المرور، وبيشوف "يوم العمل" و"التقويم" بس: تسجيل الحضور، المرضى من غير حجز، نداء المرضى وشاشة الانتظار. مش بيشوف الكشف أو الروشتات أو ملفات المرضى.',
    en: 'Assistants sign in on the doctor login page with their own email and password and only see "Today" and "Calendar": check-ins, walk-ins, calling patients and the waiting-room screen. They never see exams, prescriptions or patient records.',
  },
  add:         { ar: 'إضافة مساعد', en: 'Add assistant' },
  name:        { ar: 'الاسم', en: 'Name' },
  email:       { ar: 'البريد الإلكتروني (للدخول)', en: 'Email (to sign in)' },
  password:    { ar: 'كلمة مرور مبدئية (8 حروف على الأقل)', en: 'Initial password (min 8 characters)' },
  phone:       { ar: 'الموبايل (اختياري)', en: 'Mobile (optional)' },
  create:      { ar: 'إنشاء الحساب', en: 'Create account' },
  cancel:      { ar: 'إلغاء', en: 'Cancel' },
  handover:    {
    ar: 'تم إنشاء الحساب. ادّي المساعد الإيميل وكلمة المرور دول — مش هنقدر نعرض كلمة المرور تاني.',
    en: 'Account created. Give your assistant this email and password — the password won’t be shown again.',
  },
  loginAt:     { ar: 'رابط الدخول', en: 'Sign-in link' },
  active:      { ar: 'نشط', en: 'Active' },
  inactive:    { ar: 'موقوف', en: 'Disabled' },
  lastLogin:   { ar: 'آخر دخول', en: 'Last sign-in' },
  never:       { ar: 'لسه مدخلش', en: 'Never' },
  disable:     { ar: 'إيقاف', en: 'Disable' },
  enable:      { ar: 'تفعيل', en: 'Enable' },
  reset:       { ar: 'تغيير كلمة المرور', en: 'Reset password' },
  newPassword: { ar: 'كلمة المرور الجديدة', en: 'New password' },
  save:        { ar: 'حفظ', en: 'Save' },
  remove:      { ar: 'حذف', en: 'Remove' },
  confirmRemove:{ ar: 'تحذف المساعد ده؟ مش هيقدر يدخل تاني.', en: 'Remove this assistant? They will no longer be able to sign in.' },
  confirmDisable:{ ar: 'توقف حساب المساعد ده؟ هيتمنع من الدخول لحد ما تفعّله تاني.', en: 'Disable this assistant? They are locked out until you enable them again.' },
  passwordSaved:{ ar: 'تم تغيير كلمة المرور', en: 'Password changed' },
  empty:       { ar: 'لسه مضفتش مساعدين.', en: 'No assistants yet.' },
  limit:       { ar: 'وصلت للحد الأقصى ({n} مساعدين).', en: 'You’ve reached the limit ({n} assistants).' },
  loadFailed:  { ar: 'تعذر تحميل المساعدين', en: 'Could not load assistants' },
  failed:      { ar: 'حصل خطأ، حاول تاني', en: 'Something went wrong, please try again' },
};

const NUM_LOCALE: Record<Lang, string> = { ar: 'ar-EG-u-nu-latn', en: 'en-GB' };

export default function DoctorAssistantsManager({ lang }: { lang: Lang }) {
  const isRtl = lang === 'ar';
  const t = (k: keyof typeof T) => T[k][lang];

  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [max, setMax] = useState(2);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' });
  const [handover, setHandover] = useState<{ email: string; password: string } | null>(null);
  const [resetFor, setResetFor] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/doctor/assistants?locale=${lang}`, { cache: 'no-store' });
      const data = (await res.json()) as { assistants?: Assistant[]; max?: number; error?: string };
      if (!res.ok) {
        setError(data.error ?? t('loadFailed'));
        return;
      }
      setAssistants(data.assistants ?? []);
      setMax(data.max ?? 2);
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

  async function call(url: string, init: RequestInit, key: string): Promise<Record<string, unknown> | null> {
    setBusy(key);
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
      setBusy(null);
    }
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const data = await call(
      '/api/doctor/assistants',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, locale: lang }),
      },
      'create'
    );
    if (!data) return;
    setHandover({ email: form.email.trim().toLowerCase(), password: form.password });
    setForm({ name: '', email: '', password: '', phone: '' });
    setFormOpen(false);
    await load();
  }

  async function setActive(a: Assistant, isActive: boolean) {
    if (!isActive && !window.confirm(t('confirmDisable'))) return;
    const data = await call(
      `/api/doctor/assistants/${a.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: isActive, locale: lang }),
      },
      a.id
    );
    if (data) await load();
  }

  async function savePassword(a: Assistant) {
    const data = await call(
      `/api/doctor/assistants/${a.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword, locale: lang }),
      },
      a.id
    );
    if (!data) return;
    setResetFor(null);
    setNewPassword('');
    setNotice(t('passwordSaved'));
  }

  async function remove(a: Assistant) {
    if (!window.confirm(`${t('confirmRemove')}\n\n${a.name}`)) return;
    const data = await call(`/api/doctor/assistants/${a.id}?locale=${lang}`, { method: 'DELETE' }, a.id);
    if (data) await load();
  }

  const atLimit = assistants.length >= max;
  const loginUrl = typeof window !== 'undefined' ? `${window.location.origin}/${lang}/doctor/login` : `/${lang}/doctor/login`;
  const input =
    'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500';

  return (
    <div className="px-4 pt-16 pb-6 sm:px-6 md:p-8 space-y-6 max-w-3xl" dir={isRtl ? 'rtl' : 'ltr'}>
      <div>
        <h1 className="text-2xl font-bold text-[#1A2F4A]">{t('title')}</h1>
        <p className="text-gray-500 mt-2 text-sm leading-relaxed">{t('subtitle')}</p>
      </div>

      {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg p-3">{error}</div>}
      {notice && <div className="bg-emerald-50 text-emerald-800 text-sm rounded-lg p-3">✓ {notice}</div>}

      {handover && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm space-y-2">
          <p className="font-semibold text-amber-900">{t('handover')}</p>
          <div className="font-mono text-gray-800 bg-white rounded-lg p-3 space-y-1" dir="ltr">
            <p>{handover.email}</p>
            <p>{handover.password}</p>
            <p className="text-xs text-gray-500 break-all">
              {t('loginAt')}: {loginUrl}
            </p>
          </div>
          <button type="button" onClick={() => setHandover(null)} className="text-xs text-amber-800 hover:underline">
            ✕
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2].map((i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {assistants.length === 0 && <p className="text-sm text-gray-500">{t('empty')}</p>}
          {assistants.map((a) => (
            <div key={a.id} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900">{a.name}</p>
                  <p className="text-sm text-gray-500 font-mono" dir="ltr">
                    {a.email}
                  </p>
                  {a.phone && (
                    <p className="text-xs text-gray-500 font-mono" dir="ltr">
                      {a.phone}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    {t('lastLogin')}:{' '}
                    {a.last_login_at
                      ? new Date(a.last_login_at).toLocaleString(NUM_LOCALE[lang], {
                          day: 'numeric',
                          month: 'short',
                          hour: 'numeric',
                          minute: '2-digit',
                          timeZone: 'Africa/Cairo',
                        })
                      : t('never')}
                  </p>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                    a.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {a.is_active ? t('active') : t('inactive')}
                </span>
              </div>

              {resetFor === a.id ? (
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder={t('newPassword')}
                    minLength={8}
                    dir="ltr"
                    className={input}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => savePassword(a)}
                      disabled={busy !== null || newPassword.length < 8}
                      className="px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-lg text-sm"
                    >
                      {t('save')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setResetFor(null);
                        setNewPassword('');
                      }}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600"
                    >
                      {t('cancel')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setActive(a, !a.is_active)}
                    disabled={busy !== null}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {a.is_active ? t('disable') : t('enable')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setResetFor(a.id)}
                    disabled={busy !== null}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {t('reset')}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(a)}
                    disabled={busy !== null}
                    className="px-3 py-1.5 border border-red-200 rounded-lg text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    {t('remove')}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!loading &&
        (atLimit ? (
          <p className="text-sm text-gray-500">{t('limit').replace('{n}', String(max))}</p>
        ) : formOpen ? (
          <form onSubmit={create} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={t('name')}
              required
              minLength={2}
              className={input}
            />
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder={t('email')}
              required
              dir="ltr"
              className={input}
            />
            <input
              type="text"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder={t('password')}
              required
              minLength={8}
              dir="ltr"
              autoComplete="new-password"
              className={input}
            />
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder={t('phone')}
              inputMode="tel"
              dir="ltr"
              className={input}
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy !== null}
                className="flex-1 px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
              >
                {t('create')}
              </button>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600"
              >
                {t('cancel')}
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => {
              setFormOpen(true);
              setHandover(null);
            }}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium"
          >
            + {t('add')}
          </button>
        ))}
    </div>
  );
}
