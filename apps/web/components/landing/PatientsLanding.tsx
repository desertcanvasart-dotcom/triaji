import Link from 'next/link';
import type { Lang } from '@triaji/shared/i18n';
import MegaNavbar from '@/components/shared/MegaNavbar';
import ShowMoreToggle from '@/app/ShowMoreToggle';

/* ── Content ──────────────────────────────────────────────────────────────
   Patient-facing marketing. Moved off the monolithic homepage (Priority 1) so
   the home page can act as a short router. */

const T = {
  hero: {
    badge:    { ar: 'للمرضى', en: 'For Patients' },
    title:    { ar: 'صحتك كلها في مكان واحد', en: 'All your health in one place' },
    subtitle: {
      ar: 'صف أعراضك بالعربي العادي — دكتور تريو يحدد الطبيب المناسب، يحجزلك، يربط تحاليلك وأدويتك وتأمينك، ويتابع معاك.',
      en: 'Describe your symptoms in plain words — DoctorTrio finds the right doctor, books for you, connects your labs, prescriptions and insurance, and follows up.',
    },
    primaryCta: { ar: 'ابدأ التوجيه الطبي', en: 'Start Medical Triage' },
    note:       { ar: 'ابدأ من غير تسجيل — تقدر تسجّل بعدين', en: 'Start without signing up — register later' },
    records:    { ar: 'عندك حساب؟ افتح سجلك الطبي', en: 'Have an account? Open your medical record' },
  },
  emergency: {
    ar: 'دكتور تريو مش بديل عن الطوارئ. لو الحالة خطيرة اتصل بـ ',
    en: 'DoctorTrio is not a substitute for emergency care. In an emergency, call ',
  },
  how: {
    title: { ar: 'كيف يعمل دكتور تريو؟', en: 'How DoctorTrio works' },
    steps: {
      ar: [
        { icon: '🎤', title: 'صف أعراضك', desc: 'بالصوت أو الكتابة — بالعربي العادي' },
        { icon: '🧠', title: 'تقييم ذكي', desc: 'دكتور تريو يحدد الخطورة ويرشّح لك الطبيب المناسب' },
        { icon: '📅', title: 'احجز وتابع', desc: 'حجز الموعد، سجلك الطبي، ومتابعة مستمرة' },
      ],
      en: [
        { icon: '🎤', title: 'Describe your symptoms', desc: 'By voice or text — in your own words' },
        { icon: '🧠', title: 'Smart assessment', desc: 'DoctorTrio gauges severity and matches you to the right doctor' },
        { icon: '📅', title: 'Book & follow up', desc: 'Appointment booking, your medical record, ongoing care' },
      ],
    },
    expandLabel:  { ar: 'شوف الرحلة الكاملة (٨ خطوات)', en: 'See the full 8-step journey' },
    collapseLabel:{ ar: 'إخفاء الرحلة الكاملة', en: 'Hide the full journey' },
    journeyTitle: { ar: 'رحلة المريض في دكتور تريو', en: 'The full patient journey' },
    journey: {
      ar: [
        { icon: '💬', num: '١', label: 'صف أعراضك' },
        { icon: '🧠', num: '٢', label: 'تقييم ذكي' },
        { icon: '📅', num: '٣', label: 'احجز دكتور' },
        { icon: '📋', num: '٤', label: 'الملخص جاهز' },
        { icon: '💊', num: '٥', label: 'احصل على روشتة' },
        { icon: '🧪', num: '٦', label: 'نتايج التحاليل' },
        { icon: '👨‍⚕️', num: '٧', label: 'متابعة الطبيب' },
        { icon: '🤖', num: '٨', label: 'اسأل دكتور تريو' },
      ],
      en: [
        { icon: '💬', num: '1', label: 'Describe symptoms' },
        { icon: '🧠', num: '2', label: 'AI assessment' },
        { icon: '📅', num: '3', label: 'Book a doctor' },
        { icon: '📋', num: '4', label: 'Summary ready' },
        { icon: '💊', num: '5', label: 'Get prescription' },
        { icon: '🧪', num: '6', label: 'Lab results arrive' },
        { icon: '👨‍⚕️', num: '7', label: 'GP follow-up' },
        { icon: '🤖', num: '8', label: 'Ask DoctorTrio' },
      ],
    },
  },
  features: {
    title:    { ar: 'كل اللي محتاجه لصحتك', en: 'Everything you need for your health' },
    subtitle: { ar: 'دكتور تريو هو مدير ملفك الطبي بالكامل', en: 'DoctorTrio is the complete manager of your medical file' },
    showMore: { ar: 'عرض المزيد', en: 'Show more' },
    showLess: { ar: 'عرض أقل', en: 'Show less' },
    items: {
      ar: [
        { icon: '🧠', tag: 'ذكاء اصطناعي', title: 'التوجيه الطبي الذكي', desc: 'صف أعراضك بصوتك أو كتابةً — الذكاء الاصطناعي يحلل حالتك ويوصلك للدكتور المناسب' },
        { icon: '🤖', tag: 'جديد', title: 'دكتور تريو يسألك', desc: 'مساعدك الصحي الشخصي — بيشرحلك تحاليلك وأدويتك وتاريخك الطبي بالعامية' },
        { icon: '📋', tag: '', title: 'سجلك الطبي الكامل', desc: 'تحاليل، أدوية، زيارات، أشعة — كل تاريخك الصحي في مكان واحد مع منحنيات التطور' },
        { icon: '🧪', tag: '', title: 'التحاليل والأشعة', desc: 'احجز في معامل البرج والمختبر وألفا — النتايج بترجع تلقائياً لسجلك' },
        { icon: '💊', tag: '', title: 'الروشتة والصيدلية', desc: 'روشتتك بتتبعت للصيدلية أونلاين — ادفع واستلم أو توصيل لبيتك' },
        { icon: '👨‍⚕️', tag: '', title: 'طبيبك الأساسي', desc: 'GP مخصص ليك يتابع صحتك ويرتب إحالاتك — مع إمكانية مكالمة فيديو' },
        { icon: '🛡️', tag: '', title: 'التأمين والدفع', desc: 'فوري وباي موب وفودافون كاش — ومتصلين بـ AXA وMetLife وميدمارك وغيرهم' },
        { icon: '👶', tag: '', title: 'ملفات الأطفال', desc: 'منحنيات النمو، جدول التطعيمات المصري، مراحل التطور — كل ده لطفلك' },
        { icon: '💻', tag: '', title: 'دكتور تريو', desc: 'موعد أونلاين + زيارة واحدة للعيادة + متابعة أونلاين — بدل 3 زيارات' },
        { icon: '📞', tag: 'AI 24/7', title: 'مركز الاتصال الذكي', desc: 'ذكاء اصطناعي يرد على مكالمتك في أي وقت — بدون أخطاء، بدون انتظار' },
        { icon: '🌍', tag: '', title: 'عربي وإنجليزي', desc: 'كل المنصة بالعربي والإنجليزي — اختار اللغة اللي تريحك' },
      ],
      en: [
        { icon: '🧠', tag: 'AI', title: 'AI Medical Triage', desc: 'Describe your symptoms by voice or text — AI analyses your case and connects you with the right doctor' },
        { icon: '🤖', tag: 'New', title: 'Ask DoctorTrio', desc: 'Your personal health AI — explains your labs, medications, and medical history in plain language' },
        { icon: '📋', tag: '', title: 'Complete Medical Record', desc: 'Labs, medications, visits, imaging — your complete health history in one place with trend charts' },
        { icon: '🧪', tag: '', title: 'Labs & Radiology', desc: 'Book at Al-Borg, Al-Mokhtabar, and Alfa — results automatically return to your record' },
        { icon: '💊', tag: '', title: 'Prescriptions & Pharmacy', desc: 'Your prescription sent to the pharmacy online — pay and collect or have it delivered' },
        { icon: '👨‍⚕️', tag: '', title: 'Your Primary Care Doctor', desc: 'A dedicated GP monitors your health and coordinates your referrals — with video call option' },
        { icon: '🛡️', tag: '', title: 'Insurance & Payment', desc: 'Fawry, Paymob, Vodafone Cash — and connected to AXA, MetLife, Medmark and more' },
        { icon: '👶', tag: '', title: 'Paediatric Profiles', desc: 'Growth charts, Egyptian vaccination schedule, developmental milestones — all for your child' },
        { icon: '💻', tag: '', title: 'Doctor Trio', desc: 'Online consult + one clinic visit + online follow-up — instead of 3 trips' },
        { icon: '📞', tag: 'AI 24/7', title: 'AI Call Center', desc: 'AI answers your call any time — zero errors, zero waiting' },
        { icon: '🌍', tag: '', title: 'Arabic & English', desc: 'The entire platform in Arabic and English — choose your preferred language' },
      ],
    },
  },
  trio: {
    badge:    { ar: 'وفّر وقتك ومصاريفك', en: 'Save time and money' },
    title:    { ar: 'دكتور تريو', en: 'Doctor Trio' },
    subtitle: { ar: 'نفس الرعاية الطبية الكاملة — بزيارة واحدة بس للعيادة', en: 'The same complete medical care — with just one clinic visit' },
    problem:  { ar: 'عادةً بتزور الدكتور 3 مرات لحالة واحدة — مرة يطلب تحاليل، مرة يفحصك، ومرة يعدّل الدواء. دكتور تريو بتوفرلك نفس النتيجة بطريقة أذكى.', en: 'Most patients visit their doctor 3 times for one episode: once to order tests, once for the examination, once for follow-up. Doctor Trio restructures this the smart way.' },
    steps: {
      ar: [
        { icon: '💻', tag: 'أونلاين', title: 'الموعد الأول — أونلاين', desc: 'الدكتور يشوف أعراضك ويطلب التحاليل والأشعة اللازمة — من غير ما تتعب وتروح العيادة' },
        { icon: '🏥', tag: 'في العيادة', title: 'الموعد الثاني — في العيادة', desc: 'زيارة واحدة بس — الدكتور عنده كل نتايجك جاهزة، يفحصك ويوصف العلاج المناسب' },
        { icon: '💻', tag: 'أونلاين', title: 'الموعد الثالث — أونلاين', desc: 'متابعة بعد العلاج — الدكتور يراجع حالتك ويعدّل الدواء لو محتاج، من راحة بيتك' },
      ],
      en: [
        { icon: '💻', tag: 'Online', title: 'First appointment — Online', desc: 'Your doctor reviews your symptoms and orders the necessary tests and scans — without you leaving home' },
        { icon: '🏥', tag: 'In Clinic', title: 'Second appointment — In Clinic', desc: 'One clinic visit only — your doctor has all results ready, examines you, and prescribes treatment' },
        { icon: '💻', tag: 'Online', title: 'Third appointment — Online', desc: 'Follow-up after treatment — your doctor reviews your progress and adjusts medication if needed, from home' },
      ],
    },
    saving: { ar: 'بدل 3 زيارات للعيادة — زيارة واحدة بس، بسعر واحد شامل', en: 'Instead of 3 clinic trips — just one, at one fixed price' },
    cta:    { ar: 'احجز ثلاثيتك الآن', en: 'Book your Doctor Trio' },
  },
  callCenter: {
    badge:    { ar: '🤖 مدعوم بالذكاء الاصطناعي', en: '🤖 AI-Powered' },
    title:    { ar: 'مركز الاتصال الذكي — متاح 24/7', en: 'The Smart Call Center — available 24/7' },
    subtitle: { ar: 'مش محتاج تطبيق أو إنترنت — اتصل وهتلاقي دكتور تريو جاهز لمساعدتك في أي وقت', en: 'No app or internet needed — call and DoctorTrio is ready to help any time' },
    capabilities: {
      ar: [
        { icon: '🕐', title: '24 ساعة / 7 أيام', desc: 'متاح كل يوم، كل ساعة، طول السنة' },
        { icon: '✅', title: 'بدون أخطاء بشرية', desc: 'معلومات طبية دقيقة ومحدّثة دايماً' },
        { icon: '📚', title: 'قاعدة بيانات طبية شاملة', desc: 'مدعوم ببيانات محدّثة بإشراف نخبة من الأطباء المصريين' },
        { icon: '⚡', title: 'رد فوري', desc: 'مفيش انتظار في الخط — إجابة على طول' },
      ],
      en: [
        { icon: '🕐', title: '24 hours / 7 days', desc: 'Available every day, every hour, all year' },
        { icon: '✅', title: 'Zero human error', desc: 'Always accurate, always up-to-date medical information' },
        { icon: '📚', title: 'Comprehensive knowledge', desc: 'Backed by data curated by top Egyptian doctors' },
        { icon: '⚡', title: 'Instant answer', desc: 'No waiting on hold — answered right away' },
      ],
    },
    phone:      '19009',
    phoneLabel: { ar: '📞 اتصل الآن — الرد فوري', en: '📞 Call now — answered instantly' },
  },
  finalCta: {
    title:   { ar: 'جاهز تبدأ؟', en: 'Ready to start?' },
    primary: { ar: 'ابدأ التوجيه الطبي الآن', en: 'Start Medical Triage now' },
    orCall:  { ar: 'أو اتصل بنا', en: 'Or call us' },
  },
};

function FeatureCard({ icon, tag, title, desc }: { icon: string; tag: string; title: string; desc: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 text-start shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl">{icon}</span>
        {tag && <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full">{tag}</span>}
      </div>
      <h3 className="text-gray-900 font-bold text-sm mb-1">{title}</h3>
      <p className="text-gray-500 text-xs leading-relaxed">{desc}</p>
    </div>
  );
}

export default function PatientsLanding({ lang }: { lang: Lang }) {
  const isRtl = lang === 'ar';
  const features = T.features.items[lang];
  const firstFeatures = features.slice(0, 6);
  const moreFeatures = features.slice(6);

  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} className="min-h-screen bg-white font-cairo">
      <MegaNavbar lang={lang} />

      {/* Hero — one primary CTA */}
      <section className="px-4 py-14 md:py-20 bg-gradient-to-b from-white to-teal-50/40">
        <div className="max-w-3xl mx-auto text-center">
          <span className="inline-block text-xs font-bold text-teal-700 bg-teal-50 px-3 py-1 rounded-full mb-4">
            {T.hero.badge[lang]}
          </span>
          <h1 className="text-3xl md:text-5xl font-bold text-gray-900 mb-4 leading-snug">{T.hero.title[lang]}</h1>
          <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">{T.hero.subtitle[lang]}</p>

          <Link
            href={`/${lang}/chat`}
            className="inline-block bg-teal-600 hover:bg-teal-700 text-white font-bold text-lg px-10 py-4 rounded-xl transition-all shadow-lg hover:shadow-xl"
          >
            {T.hero.primaryCta[lang]}
          </Link>
          <p className="text-gray-400 text-xs mt-3">{T.hero.note[lang]}</p>
          <p className="mt-1">
            <Link href={`/${lang}/login`} className="text-teal-600 text-sm font-medium hover:underline">
              {T.hero.records[lang]}
            </Link>
          </p>

          {/* Emergency disclaimer at the triage entry point */}
          <div className="mt-6 inline-flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-start">
            <span aria-hidden="true" className="leading-5">⚠️</span>
            <p className="text-amber-800 text-xs leading-5">
              {T.emergency[lang]}
              <a href="tel:123" dir="ltr" className="font-bold text-amber-900 underline underline-offset-2">123</a>
            </p>
          </div>
        </div>
      </section>

      {/* How it works — progressive disclosure (3 shown, expand to 8) */}
      <section className="py-16 px-4 bg-slate-50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-10">{T.how.title[lang]}</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-2">
            {T.how.steps[lang].map((step, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-6 text-center shadow-sm">
                <div className="w-14 h-14 rounded-full bg-teal-50 flex items-center justify-center text-2xl mx-auto mb-3">
                  {step.icon}
                </div>
                <p className="text-teal-600 text-xs font-bold mb-1">{lang === 'ar' ? `خطوة ${i + 1}` : `Step ${i + 1}`}</p>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>

          <ShowMoreToggle showMoreLabel={T.how.expandLabel[lang]} showLessLabel={T.how.collapseLabel[lang]}>
            <div className="mt-8 rounded-2xl bg-teal-600 p-6 md:p-8">
              <p className="text-white font-bold text-center mb-6">{T.how.journeyTitle[lang]}</p>
              <div className="grid grid-cols-4 md:grid-cols-8 gap-4">
                {T.how.journey[lang].map((s, i) => (
                  <div key={i} className="text-center">
                    <div className="w-12 h-12 rounded-full bg-teal-700 border-2 border-white/30 flex items-center justify-center text-xl mx-auto mb-2">
                      {s.icon}
                    </div>
                    <p className="text-white/60 text-[10px] mb-0.5">{s.num}</p>
                    <p className="text-white text-[11px] font-medium leading-tight">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </ShowMoreToggle>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 text-center mb-2">{T.features.title[lang]}</h2>
          <p className="text-gray-500 text-center mb-10">{T.features.subtitle[lang]}</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {firstFeatures.map((f, i) => <FeatureCard key={i} {...f} />)}
          </div>

          <ShowMoreToggle showMoreLabel={T.features.showMore[lang]} showLessLabel={T.features.showLess[lang]}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
              {moreFeatures.map((f, i) => <FeatureCard key={i} {...f} />)}
            </div>
          </ShowMoreToggle>
        </div>
      </section>

      {/* Doctor Trio — full product section */}
      <section className="py-20 px-4 bg-gradient-to-br from-teal-700 to-[#1A2F4A]">
        <div className="max-w-5xl mx-auto text-center">
          <span className="inline-block text-xs font-bold text-teal-900 bg-teal-300 px-3 py-1 rounded-full mb-3">{T.trio.badge[lang]}</span>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-2">{T.trio.title[lang]}</h2>
          <p className="text-teal-100 mb-4">{T.trio.subtitle[lang]}</p>
          <p className="text-white/70 text-sm max-w-2xl mx-auto mb-10">{T.trio.problem[lang]}</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
            {T.trio.steps[lang].map((step, i) => (
              <div key={i} className="bg-white/10 rounded-2xl border border-white/10 p-6 text-start">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-3xl">{step.icon}</span>
                  <span className="text-[10px] font-bold text-white bg-white/15 px-2 py-0.5 rounded-full">{step.tag}</span>
                </div>
                <h3 className="text-white font-bold text-base mb-1">{step.title}</h3>
                <p className="text-white/70 text-sm leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>

          <p className="text-teal-100 font-semibold mb-5">{T.trio.saving[lang]}</p>
          <Link href={`/${lang}/chat`} className="inline-block bg-white text-teal-800 font-bold px-8 py-3.5 rounded-xl hover:bg-teal-50 transition-colors">
            {T.trio.cta[lang]}
          </Link>
        </div>
      </section>

      {/* Call Center — full section */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <span className="inline-block text-xs font-bold text-teal-700 bg-teal-50 px-3 py-1 rounded-full mb-3">{T.callCenter.badge[lang]}</span>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">{T.callCenter.title[lang]}</h2>
            <p className="text-gray-500 max-w-2xl mx-auto">{T.callCenter.subtitle[lang]}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {T.callCenter.capabilities[lang].map((cap, i) => (
              <div key={i} className="bg-slate-50 rounded-2xl border border-gray-100 p-5 text-start">
                <span className="text-2xl">{cap.icon}</span>
                <h3 className="text-gray-900 font-bold text-sm mt-2 mb-1">{cap.title}</h3>
                <p className="text-gray-500 text-xs leading-relaxed">{cap.desc}</p>
              </div>
            ))}
          </div>

          <div className="text-center">
            <a href={`tel:${T.callCenter.phone}`} className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-bold px-8 py-3.5 rounded-xl transition-colors">
              {T.callCenter.phoneLabel[lang]}
              <span dir="ltr" className="font-mono">{T.callCenter.phone}</span>
            </a>
          </div>
        </div>
      </section>

      {/* Final CTA — single primary */}
      <section className="py-16 px-4 bg-slate-50">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-8">{T.finalCta.title[lang]}</h2>
          <Link
            href={`/${lang}/chat`}
            className="inline-block bg-teal-600 hover:bg-teal-700 text-white font-bold text-lg px-10 py-4 rounded-xl transition-all shadow-lg hover:shadow-xl"
          >
            {T.finalCta.primary[lang]}
          </Link>
          <div className="mt-5 flex items-center justify-center gap-2 text-gray-400 text-sm">
            <span>{T.finalCta.orCall[lang]}</span>
            <a href="tel:19009" className="text-teal-600 font-bold text-lg hover:text-teal-500 transition-colors" dir="ltr">19009</a>
          </div>
        </div>
      </section>
    </main>
  );
}
