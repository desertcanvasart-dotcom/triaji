import Link from 'next/link';
import { cookies } from 'next/headers';
import { s } from '@triaji/shared/i18n';
import type { Lang } from '@triaji/shared/i18n';
import MegaNavbar from '@/components/shared/MegaNavbar';

/* ═══════════════════════════════════════════════════════════════════════════
   BILINGUAL CONTENT
   ═══════════════════════════════════════════════════════════════════════════ */

const HERO = {
  headline: { ar: 'قولِّنا بتشتكى من إيه… وهنوصلك بالدكتور المناسب فوراً', en: 'Tell us your symptoms — we\'ll find the right doctor instantly' },
  sub:      { ar: 'بناءً على الأعراض سيقوم دكتور تريو بتحديد الطبيب + حجز + تحاليل أو أشعة + تأمين — في تجربة واحدة متكاملة', en: 'Based on your symptoms, DoctorTrio identifies the doctor + booking + labs or radiology + insurance — one complete healthcare experience' },
  ctaPatient:  { ar: 'ابدأ التوجيه الطبي', en: 'Start Medical Triage' },
  ctaDoctor:   { ar: 'سجّل كطبيب', en: 'Register as Doctor' },
  ctaProvider: { ar: 'للمستشفيات والعيادات', en: 'For Hospitals & Clinics' },
  heroNote:    { ar: 'ابدأ من غير تسجيل — هتسجّل بعدين لو عايز تكمل', en: 'Start without signing up — register later to continue' },
};

const TRUST_STATS = {
  ar: [
    { icon: '🗺️', value: '27 محافظة', label: 'يغطي جميع محافظات مصر' },
    { icon: '🛡️', value: 'AXA · MetLife · Allianz · GlobeMed · Medmark', label: 'شركات التأمين المتصلة' },
    { icon: '🧪', value: 'البرج · المختبر · ألفا', label: 'سلاسل المعامل المتكاملة' },
    { icon: '🏥', value: '6 أنواع', label: 'مستشفيات · عيادات · معامل · أشعة · صيدليات · تأمين' },
  ],
  en: [
    { icon: '🗺️', value: '27 Governorates', label: 'Covering all of Egypt' },
    { icon: '🛡️', value: 'AXA · MetLife · Allianz · GlobeMed · Medmark', label: 'Connected insurance providers' },
    { icon: '🧪', value: 'Al-Borg · Al-Mokhtabar · Alfa', label: 'Integrated lab chains' },
    { icon: '🏥', value: '6 Provider Types', label: 'Hospitals · Clinics · Labs · Radiology · Pharmacies · Insurance' },
  ],
};

const CHAT_MOCKUP = {
  header: { ar: 'دكتور تريو', en: 'DoctorTrio' },
  subtitle: { ar: 'مساعدك الصحي الذكي', en: 'Your AI health assistant' },
  online: { ar: 'متصل الآن', en: 'Online now' },
  inputPlaceholder: { ar: 'اكتب رسالة...', en: 'Type a message...' },
  messages: {
    ar: [
      { role: 'assistant', text: 'مرحباً! احكيلي إيه اللي بتحس بيه؟', time: '9:41 ص' },
      { role: 'user', text: 'عندي صداع شديد من امبارح وحرارة', time: '9:41 ص' },
      { role: 'assistant', text: 'فاهم. الحرارة كام تقريباً؟ وعندك ألم في الرقبة أو حساسية للضوء؟', time: '9:42 ص' },
      { role: 'user', text: 'الحرارة 38.5 ومش عندي ألم في الرقبة', time: '9:42 ص' },
      { role: 'assistant', text: '✓ تقييمك جاهز — حالة متوسطة، مناسب تشوف دكتور باطنة النهارده', time: '9:42 ص', isResult: true },
    ],
    en: [
      { role: 'assistant', text: 'Hello! Tell me what symptoms you\'re experiencing.', time: '9:41 AM' },
      { role: 'user', text: 'I have a severe headache since yesterday and a fever', time: '9:41 AM' },
      { role: 'assistant', text: 'Understood. What\'s your temperature approximately? Any neck pain or light sensitivity?', time: '9:42 AM' },
      { role: 'user', text: 'Temperature is 38.5°C and no neck pain', time: '9:42 AM' },
      { role: 'assistant', text: '✓ Assessment complete — moderate severity, recommend seeing an internist today', time: '9:42 AM', isResult: true },
    ],
  },
  ctaInChat: { ar: 'احجز مع دكتور باطنة →', en: 'Book an internist →' },
};

const FOOTER = {
  platform:  { ar: 'المنصة', en: 'Platform' },
  patients:  { ar: 'للمرضى', en: 'For Patients' },
  doctors:   { ar: 'للأطباء', en: 'For Doctors' },
  providers: { ar: 'لمقدمي الخدمة', en: 'For Providers' },
  emergency: {
    ar: '⚠️ دكتور تريو ليس بديلاً عن الطوارئ — في حالات الطوارئ اتصل بـ 123',
    en: '⚠️ DoctorTrio is not a substitute for emergency care — call 123',
  },
  copyright: { ar: '© 2026 دكتور تريو — جميع الحقوق محفوظة', en: '© 2026 DoctorTrio — All rights reserved' },
};

/* ═══════════════════════════════════════════════════════════════════════════
   PAGE COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

export default async function HomePage() {
  const cookieStore = await cookies();
  const lang: Lang = cookieStore.get('lang')?.value === 'en' ? 'en' : 'ar';
  const isRtl = lang === 'ar';

  return (
    <main className="min-h-screen bg-[#FAFAF8]" dir={isRtl ? 'rtl' : 'ltr'}>

      {/* ═══ 1. NAVBAR ═══════════════════════════════════════════════════ */}
      <MegaNavbar lang={lang} />

      {/* ═══ 2. HERO ═════════════════════════════════════════════════════ */}
      <section className="px-4 py-12 md:py-20 bg-gradient-to-b from-white to-teal-50/30">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-5 gap-10 items-center">
          {/* Text column (60%) */}
          <div className="md:col-span-3 text-center md:text-start">
            <h1 className="text-3xl md:text-5xl font-bold text-gray-900 mb-4 leading-relaxed md:leading-snug">
              {HERO.headline[lang]}
            </h1>
            <p className="text-lg text-gray-600 mb-8 max-w-xl">
              {HERO.sub[lang]}
            </p>

            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3">
              <Link
                href={`/${lang}/chat`}
                className="bg-teal-600 hover:bg-teal-700 text-white font-bold text-lg px-8 py-4 rounded-xl transition-all shadow-lg hover:shadow-xl w-full sm:w-auto"
              >
                {HERO.ctaPatient[lang]}
              </Link>
            </div>
            <p className="text-gray-400 text-xs mt-2 text-center sm:text-start">
              {HERO.heroNote[lang]}
            </p>
            {/* Secondary audiences — de-emphasized text links (full routing lives in the section below) */}
            <p className="mt-2 text-sm text-center sm:text-start">
              <Link href={`/${lang}/doctor`} className="text-teal-600 font-medium hover:underline">{HERO.ctaDoctor[lang]}</Link>
              <span className="mx-2 text-gray-300">·</span>
              <Link href={`/${lang}/providers`} className="text-teal-600 font-medium hover:underline">{HERO.ctaProvider[lang]}</Link>
            </p>

            {/* Emergency disclaimer — visible at the triage entry point, not just the footer */}
            <div className="mt-4 inline-flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-start max-w-xl mx-auto md:mx-0">
              <span aria-hidden="true" className="leading-5">⚠️</span>
              <p className="text-amber-800 text-xs leading-5">
                {lang === 'ar'
                  ? 'دكتور تريو مش بديل عن الطوارئ. لو الحالة خطيرة اتصل بـ '
                  : 'DoctorTrio is not a substitute for emergency care. In an emergency, call '}
                <a href="tel:123" dir="ltr" className="font-bold text-amber-900 underline underline-offset-2">123</a>
              </p>
            </div>
          </div>

          {/* Chat mockup column (40%) */}
          <div className="md:col-span-2 flex justify-center">
            <div className="w-full max-w-xs md:-rotate-1 rounded-3xl border-2 border-gray-200 shadow-2xl bg-white overflow-hidden">
              {/* Status bar */}
              <div className="bg-gray-50 px-3 py-1.5 flex items-center justify-between">
                <div className="flex gap-1">
                  <span className="w-2 h-2 rounded-full bg-gray-300" />
                  <span className="w-2 h-2 rounded-full bg-gray-300" />
                  <span className="w-2 h-2 rounded-full bg-gray-300" />
                </div>
                <span className="text-[10px] text-gray-400">9:41</span>
              </div>

              {/* Chat header */}
              <div className="bg-teal-700 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-white/60 text-sm">{isRtl ? '→' : '←'}</span>
                  <div className="flex-1">
                    <p className="text-white font-bold text-sm">{CHAT_MOCKUP.header[lang]}</p>
                    <p className="text-white/60 text-[10px]">{CHAT_MOCKUP.subtitle[lang]}</p>
                  </div>
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                    <span className="text-white/50 text-[9px]">{CHAT_MOCKUP.online[lang]}</span>
                  </span>
                </div>
              </div>

              {/* Messages */}
              <div className="p-3 flex flex-col gap-2 max-h-72 overflow-y-auto bg-gray-50">
                {CHAT_MOCKUP.messages[lang].map((msg, i) => {
                  const isUser = msg.role === 'user';
                  const isResult = 'isResult' in msg && msg.isResult;
                  return (
                    <div key={i} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[80%] p-2.5 text-xs leading-relaxed ${
                          isResult
                            ? 'bg-teal-700 text-white rounded-2xl'
                            : isUser
                              ? 'bg-teal-600 text-white rounded-2xl rounded-se-sm'
                              : 'bg-white text-gray-800 rounded-2xl rounded-ss-sm shadow-sm'
                        }`}
                      >
                        <p>{msg.text}</p>
                        {isResult && (
                          <button className="mt-2 text-[10px] border border-white/30 text-white px-3 py-1 rounded-full hover:bg-white/10 transition-colors">
                            {CHAT_MOCKUP.ctaInChat[lang]}
                          </button>
                        )}
                        <p className={`text-[9px] mt-1 ${isResult || isUser ? 'text-white/50' : 'text-gray-400'}`}>
                          {msg.time}
                        </p>
                      </div>
                    </div>
                  );
                })}

                {/* Typing indicator */}
                <div className="flex justify-start">
                  <div className="bg-white rounded-2xl rounded-ss-sm shadow-sm px-4 py-3 flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>

              {/* Input bar */}
              <div className="bg-white border-t border-gray-200 px-3 py-2 flex items-center gap-2">
                <div className="flex-1 bg-gray-100 rounded-full px-3 py-1.5 text-xs text-gray-400">
                  {CHAT_MOCKUP.inputPlaceholder[lang]}
                </div>
                <div className="w-7 h-7 rounded-full bg-teal-600 flex items-center justify-center">
                  <span className="text-white text-xs">{isRtl ? '←' : '→'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ TRUST STRIP ═════════════════════════════════════════════════ */}
      <section className="bg-teal-600 py-5 px-4">
        <div className="max-w-6xl mx-auto flex gap-4 overflow-x-auto pb-1 no-scrollbar">
          {TRUST_STATS[lang].map((stat, i) => (
            <div
              key={i}
              style={{ animationDelay: `${i * 120}ms` }}
              className="group flex-shrink-0 bg-white/10 rounded-xl px-4 py-3 flex items-start gap-3 min-w-[200px] animate-fade-in-up transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-white/20 hover:shadow-lg"
            >
              <span className="text-2xl transition-transform duration-300 group-hover:scale-110">{stat.icon}</span>
              <div>
                <p className="text-white font-semibold text-xs leading-snug">{stat.value}</p>
                <p className="text-white/60 text-[10px] mt-0.5">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ AUDIENCE ROUTER ═════════════════════════════════════════════ */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-2">
            {lang === 'ar' ? 'إنت مين؟' : 'Who are you?'}
          </h2>
          <p className="text-gray-500 text-center mb-10">
            {lang === 'ar' ? 'اختار مسارك وهنوصلك للمكان الصح' : "Choose your path and we'll take you to the right place"}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Patients */}
            <Link href={`/${lang}/patients`} className="group rounded-2xl border border-gray-200 p-6 text-start hover:border-teal-400 hover:shadow-md transition-all">
              <span className="text-3xl">🧑‍⚕️</span>
              <h3 className="text-xl font-bold text-gray-900 mt-3 mb-1">{lang === 'ar' ? 'للمرضى' : 'For Patients'}</h3>
              <p className="text-gray-500 text-sm mb-4">
                {lang === 'ar' ? 'فرز طبي، حجز، سجلك الطبي، تحاليل وأدوية — في مكان واحد' : 'Triage, booking, records, labs and meds — all in one place'}
              </p>
              <span className="text-teal-600 font-semibold text-sm group-hover:underline">{lang === 'ar' ? 'ابدأ ←' : 'Get started →'}</span>
            </Link>

            {/* Doctors */}
            <Link href={`/${lang}/doctor`} className="group rounded-2xl border border-gray-200 p-6 text-start hover:border-indigo-400 hover:shadow-md transition-all">
              <span className="text-3xl">👨‍⚕️</span>
              <h3 className="text-xl font-bold text-gray-900 mt-3 mb-1">{lang === 'ar' ? 'للأطباء' : 'For Doctors'}</h3>
              <p className="text-gray-500 text-sm mb-4">
                {lang === 'ar' ? 'ملخص قبل الكشف، إدارة عيادتك، ومكالمات فيديو مع مرضاك' : 'Pre-visit summaries, clinic management, and video calls with your patients'}
              </p>
              <span className="text-indigo-600 font-semibold text-sm group-hover:underline">{lang === 'ar' ? 'سجّل كطبيب ←' : 'Register as a doctor →'}</span>
            </Link>

            {/* Providers */}
            <Link href={`/${lang}/providers`} className="group rounded-2xl border border-gray-200 p-6 text-start hover:border-teal-400 hover:shadow-md transition-all">
              <span className="text-3xl">🏥</span>
              <h3 className="text-xl font-bold text-gray-900 mt-3 mb-1">{lang === 'ar' ? 'لمقدمي الخدمة' : 'For Providers'}</h3>
              <p className="text-gray-500 text-sm mb-4">
                {lang === 'ar' ? 'مستشفيات، عيادات، معامل، أشعة، صيدليات، وتأمين' : 'Hospitals, clinics, labs, radiology, pharmacies, and insurance'}
              </p>
              <span className="text-teal-600 font-semibold text-sm group-hover:underline">{lang === 'ar' ? 'سجّل مؤسستك ←' : 'Register your facility →'}</span>
            </Link>
          </div>

          {/* ICU bed finder — reframed for doctors & hospitals (the audience that can actually use it) */}
          <div className="mt-6 rounded-2xl bg-[#0F1F30] p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-start">
              <p className="text-white font-bold flex items-center gap-2">
                <span aria-hidden="true">🚨</span>
                {lang === 'ar' ? 'للأطباء والمستشفيات: البحث عن سرير عناية' : 'For doctors & hospitals: ICU bed finder'}
              </p>
              <p className="text-white/60 text-sm mt-1 max-w-xl">
                {lang === 'ar'
                  ? 'أداة للأطباء المسجّلين للبحث عن أقرب سرير عناية متاح لحظياً — والمستشفيات تسجّل أسرّتها في دكتور تريو.'
                  : 'A tool for registered doctors to find the nearest available ICU bed in real time — and for hospitals to register their beds on DoctorTrio.'}
              </p>
            </div>
            <div className="flex gap-3 flex-shrink-0">
              <Link href={`/${lang}/icu`} className="bg-teal-600 hover:bg-teal-700 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-colors">
                {lang === 'ar' ? 'للأطباء: ابحث' : 'Doctors: search'}
              </Link>
              <Link href={`/${lang}/register/provider`} className="border border-white/30 text-white hover:bg-white/10 font-bold px-5 py-2.5 rounded-xl text-sm transition-colors">
                {lang === 'ar' ? 'سجّل مستشفاك' : 'Register hospital'}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ 10. FOOTER ══════════════════════════════════════════════════ */}
      <footer className="py-12 px-4 bg-gray-900 text-gray-400">
        <div className="max-w-6xl mx-auto">
          {/* 4-column grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
            <div>
              <h4 className="text-white font-bold mb-4">{FOOTER.platform[lang]}</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/" className="hover:text-white transition-colors">{lang === 'ar' ? 'الرئيسية' : 'Home'}</Link></li>
                <li><Link href={`/${lang}/about`} className="hover:text-white transition-colors">{lang === 'ar' ? 'من نحن' : 'About Us'}</Link></li>
                <li><Link href={`/${lang}/privacy`} className="hover:text-white transition-colors">{lang === 'ar' ? 'سياسة الخصوصية' : 'Privacy Policy'}</Link></li>
                <li><Link href={`/${lang}/terms`} className="hover:text-white transition-colors">{lang === 'ar' ? 'شروط الاستخدام' : 'Terms of Use'}</Link></li>
                <li><Link href={`/${lang}/contact`} className="hover:text-white transition-colors">{lang === 'ar' ? 'تواصل معنا' : 'Contact Us'}</Link></li>
                <li><Link href={`/${lang}/login`} className="hover:text-white transition-colors">{lang === 'ar' ? 'تسجيل الدخول' : 'Sign In'}</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold mb-4">{FOOTER.providers[lang]}</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href={`/${lang}/providers/hospitals`} className="hover:text-white transition-colors">{lang === 'ar' ? 'المستشفيات' : 'Hospitals'}</Link></li>
                <li><Link href={`/${lang}/providers/clinics`} className="hover:text-white transition-colors">{lang === 'ar' ? 'العيادات' : 'Clinics'}</Link></li>
                <li><Link href={`/${lang}/providers/labs`} className="hover:text-white transition-colors">{lang === 'ar' ? 'المعامل' : 'Labs'}</Link></li>
                <li><Link href={`/${lang}/providers/radiology`} className="hover:text-white transition-colors">{lang === 'ar' ? 'مراكز الأشعة' : 'Radiology Centers'}</Link></li>
                <li><Link href={`/${lang}/providers/pharmacies`} className="hover:text-white transition-colors">{lang === 'ar' ? 'الصيدليات' : 'Pharmacies'}</Link></li>
                <li><Link href={`/${lang}/providers/insurance`} className="hover:text-white transition-colors">{lang === 'ar' ? 'التأمين' : 'Insurance'}</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold mb-4">{FOOTER.patients[lang]}</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href={`/${lang}/chat`} className="hover:text-white transition-colors">{lang === 'ar' ? 'التوجيه الطبي' : 'Triage'}</Link></li>
                <li><Link href={`/${lang}/medical-record`} className="hover:text-white transition-colors">{lang === 'ar' ? 'السجل الطبي' : 'Records'}</Link></li>
                <li><Link href={`/${lang}/health-assistant`} className="hover:text-white transition-colors">{lang === 'ar' ? 'دكتور تريو يسألك' : 'Ask DoctorTrio'}</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold mb-4">{FOOTER.doctors[lang]}</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href={`/${lang}/doctor/register`} className="hover:text-white transition-colors">{lang === 'ar' ? 'تسجيل طبيب' : 'Register'}</Link></li>
                <li><Link href={`/${lang}/doctor`} className="hover:text-white transition-colors">{lang === 'ar' ? 'بوابة الأطباء' : 'Doctor Portal'}</Link></li>
              </ul>
            </div>
          </div>

          {/* Emergency disclaimer */}
          <div className="border-t border-gray-800 pt-6 text-center">
            <p className="text-yellow-500 text-sm font-medium mb-3">
              {FOOTER.emergency[lang]}
            </p>
            <p className="text-xl font-bold text-teal-500 mb-1">
              {s.common.appName[lang]}
            </p>
            <a href="tel:19009" className="text-gray-300 hover:text-white text-sm font-medium transition-colors" dir="ltr">
              📞 19009
            </a>
            <p className="text-gray-500 text-xs mt-2">
              {FOOTER.copyright[lang]}
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
