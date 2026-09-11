'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Lang } from '@triaji/shared/i18n';

const FACILITY_TYPES = [
  { value: 'hospital',  ar: 'مستشفى',        en: 'Hospital' },
  { value: 'clinic',    ar: 'عيادة',          en: 'Clinic' },
  { value: 'lab',       ar: 'معمل تحاليل',    en: 'Laboratory' },
  { value: 'radiology', ar: 'مركز أشعة',      en: 'Radiology center' },
  { value: 'pharmacy',  ar: 'صيدلية',         en: 'Pharmacy' },
  { value: 'insurance', ar: 'شركة تأمين',     en: 'Insurance company' },
] as const;

const T = {
  title:       { ar: 'سجّل مؤسستك في دكتور تريو', en: 'Register your facility on DoctorTrio' },
  subtitle:    { ar: 'املأ البيانات وهنراجع طلبك ونفعّل حسابك خلال 24 ساعة', en: "Fill in the details — we'll review and activate your account within 24 hours" },
  facilityName:{ ar: 'اسم المؤسسة', en: 'Facility name' },
  facilityType:{ ar: 'نوع المؤسسة', en: 'Facility type' },
  choose:      { ar: 'اختر النوع...', en: 'Choose type...' },
  contactName: { ar: 'اسم المسؤول', en: 'Contact person' },
  email:       { ar: 'البريد الإلكتروني', en: 'Email' },
  phone:       { ar: 'رقم الموبايل', en: 'Mobile number' },
  password:    { ar: 'كلمة المرور', en: 'Password' },
  passwordHint:{ ar: '8 أحرف على الأقل', en: 'At least 8 characters' },
  submit:      { ar: 'إرسال طلب التسجيل', en: 'Submit registration' },
  submitting:  { ar: 'جاري الإرسال...', en: 'Submitting...' },
  haveAccount: { ar: 'عندك حساب بالفعل؟', en: 'Already have an account?' },
  login:       { ar: 'دخول', en: 'Log in' },
  genericError:{ ar: 'حصل خطأ، حاول تاني', en: 'Something went wrong, please try again' },
  successTitle:{ ar: 'استلمنا طلبك ✅', en: 'Request received ✅' },
  successBody: { ar: 'فريقنا هيراجع طلب تسجيل مؤسستك ويفعّل حسابك خلال 24 ساعة. هيوصلك إيميل تأكيد، وبعد التفعيل تقدر تسجّل دخولك بنفس البيانات.', en: "Our team will review your facility registration and activate your account within 24 hours. You'll get a confirmation email, and once activated you can sign in with the same details." },
  backHome:    { ar: 'الرجوع للرئيسية', en: 'Back to home' },
};

export default function ProviderRegister({ lang }: { lang: Lang }) {
  const isRtl = lang === 'ar';
  const [facilityName, setFacilityName] = useState('');
  const [facilityType, setFacilityType] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/provider/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          facility_name: facilityName.trim(),
          facility_type: facilityType,
          contact_name: contactName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          password,
          locale: lang,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setError(data.error ?? T.genericError[lang]);
        return;
      }
      setDone(true);
    } catch {
      setError(T.genericError[lang]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} className="min-h-screen bg-gray-50 font-cairo">
      <nav className="bg-white border-b border-gray-100 px-4 py-3">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <Link href={`/${lang}`} className="text-xl font-bold text-teal-600">دكتور تريو</Link>
          <Link href={`/${lang}/login`} className="text-sm font-semibold text-[#1A2F4A] hover:text-teal-600">
            {T.login[lang]}
          </Link>
        </div>
      </nav>

      <div className="max-w-md mx-auto px-4 pt-12 pb-20">
        <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8">
          {done ? (
            <div className="text-center py-6">
              <h1 className="text-2xl font-bold text-[#1A2F4A] mb-3">{T.successTitle[lang]}</h1>
              <p className="text-gray-500 text-sm leading-relaxed mb-8">{T.successBody[lang]}</p>
              <Link href={`/${lang}`} className="inline-block bg-teal-600 hover:bg-teal-700 text-white font-semibold px-6 py-3 rounded-xl transition-colors">
                {T.backHome[lang]}
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-[#1A2F4A] mb-2">{T.title[lang]}</h1>
              <p className="text-gray-500 text-sm mb-8">{T.subtitle[lang]}</p>

              {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg p-3 mb-6">{error}</div>}

              <form onSubmit={handleSubmit} className="space-y-5">
                <Field label={T.facilityName[lang]}>
                  <input type="text" value={facilityName} onChange={(e) => setFacilityName(e.target.value)} className={inputCls} required />
                </Field>

                <Field label={T.facilityType[lang]}>
                  <select value={facilityType} onChange={(e) => setFacilityType(e.target.value)} className={inputCls} required>
                    <option value="">{T.choose[lang]}</option>
                    {FACILITY_TYPES.map((f) => (
                      <option key={f.value} value={f.value}>{f[lang]}</option>
                    ))}
                  </select>
                </Field>

                <Field label={T.contactName[lang]}>
                  <input type="text" value={contactName} onChange={(e) => setContactName(e.target.value)} className={inputCls} required />
                </Field>

                <Field label={T.email[lang]}>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" placeholder="facility@example.com" className={inputCls} required />
                </Field>

                <Field label={T.phone[lang]}>
                  <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" placeholder="01XXXXXXXXX" className={inputCls} required />
                </Field>

                <Field label={T.password[lang]} hint={T.passwordHint[lang]}>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} required minLength={8} />
                </Field>

                <button type="submit" disabled={loading} className="w-full bg-teal-600 text-white font-semibold py-3 rounded-xl hover:bg-teal-700 transition-colors disabled:opacity-50">
                  {loading ? T.submitting[lang] : T.submit[lang]}
                </button>
              </form>

              <p className="text-center text-sm text-gray-500 mt-6">
                {T.haveAccount[lang]}{' '}
                <Link href={`/${lang}/login`} className="text-teal-600 font-semibold hover:text-teal-700">{T.login[lang]}</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

const inputCls =
  'w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none transition-colors focus:border-teal-500 bg-white';

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="block text-sm font-semibold text-gray-700">{label}</label>
        {hint && <span className="text-xs text-gray-400">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
