import Link from 'next/link';
import type { Lang } from '@triaji/shared/i18n';
import MegaNavbar from '@/components/shared/MegaNavbar';
import CopyCodeButton from '@/app/CopyCodeButton';

/* ── Content ──────────────────────────────────────────────────────────────
   Provider-facing marketing + the embeddable-widget pitch, moved off the
   monolithic homepage (Priority 1). Links out to the per-type provider pages
   that already exist under /providers/*. */

const T = {
  hero: {
    badge:    { ar: 'لمقدمي الخدمة', en: 'For Providers' },
    title:    { ar: 'منصة واحدة لكل مؤسستك الصحية', en: 'One platform for your whole healthcare business' },
    subtitle: {
      ar: 'عيادات، معامل، صيدليات، مستشفيات، أشعة، وتأمين — لوحات تحكم متخصصة لكل نوع، متصلة ببعضها في نظام واحد.',
      en: 'Clinics, labs, pharmacies, hospitals, radiology, and insurance — a dedicated dashboard for each, connected in one system.',
    },
    primaryCta:  { ar: 'سجّل مؤسستك الآن', en: 'Register your facility' },
    ctaHref:     '/contact',
    ctaNote:     { ar: 'مجاني للتسجيل — نتواصل معاك خلال 24 ساعة', en: 'Free to register — we contact you within 24 hours' },
  },
  types: {
    title: { ar: 'اختر نوع مؤسستك', en: 'Choose your facility type' },
  },
  widget: {
    title:    { ar: 'ضع دكتور تريو في موقع مستشفاك', en: 'Add DoctorTrio to your hospital website' },
    subtitle: { ar: 'سطر واحد من الكود يضيف دكتور تريو لأي موقع — مرضاك يستخدموا دكتور تريو من غير ما يسيبوا موقعك', en: 'One line of code adds DoctorTrio to any website — your patients use DoctorTrio without leaving your site' },
    codeLabel:{ ar: 'أضف هذا الكود لموقعك:', en: 'Add this to your website:' },
    code:     '<script\n  src="https://doctortrio.online/widget.js"\n  data-tenant="HOSPITAL_ID"\n></script>',
    features: {
      ar: ['يظهر كزر دكتور تريو في ركن موقعك', 'مريضك يفرز أعراضه ويحجز مباشرة', 'كل البيانات ترجع لداشبورد المستشفى', 'يتكيف مع ألوان موقعك', 'يتضمن مركز اتصال يعمل بالذكاء الاصطناعي، ومدعوماً بقاعدة بيانات طبية حديثة'],
      en: ['Appears as a DoctorTrio button on your site', 'Patient triages and books directly', 'All data flows to your hospital dashboard', "Adapts to your website's colours", 'Includes an AI-powered call center, backed by an up-to-date medical database'],
    },
    copyLabel: { ar: 'نسخ الكود', en: 'Copy Code' },
  },
};

/* Provider type cards — order matches the links map below. */
const CARDS = {
  ar: [
    { icon: '🏥', color: 'teal',    title: 'المستشفيات', features: ['ربط مع HIS', 'إدارة الأقسام', 'أسرّة العناية', 'تقارير موحدة'] },
    { icon: '🏪', color: 'indigo',  title: 'العيادات', features: ['قائمة انتظار ذكية', 'مواعيد بوقت محدد', 'فواتير ومحاسبة', 'فروع متعددة'] },
    { icon: '🧪', color: 'emerald', title: 'المعامل', features: ['استقبال طلبات التحاليل', 'رفع النتايج', 'ربط مع البرج والمختبر وألفا', 'فواتير'] },
    { icon: '📷', color: 'sky',     title: 'مراكز الأشعة', features: ['استقبال طلبات الأشعة', 'رفع التقارير', 'ربط بالسجل الطبي', 'فواتير'] },
    { icon: '💊', color: 'purple',  title: 'الصيدليات', features: ['استقبال الروشتات', 'كتالوج الأدوية', 'صرف ومتابعة', 'فواتير'] },
    { icon: '🛡️', color: 'amber',   title: 'التأمين', features: ['تحقق من البوليصات', 'موافقات مسبقة', 'مطالبات', 'تسويات مالية'] },
  ],
  en: [
    { icon: '🏥', color: 'teal',    title: 'Hospitals', features: ['HIS integration', 'Department management', 'ICU beds', 'Consolidated reports'] },
    { icon: '🏪', color: 'indigo',  title: 'Clinics', features: ['Smart walk-in queue', 'Time slot booking', 'Billing & invoicing', 'Multi-branch'] },
    { icon: '🧪', color: 'emerald', title: 'Labs', features: ['Receive lab orders', 'Upload results', 'Al-Borg, Al-Mokhtabar, Alfa', 'Billing'] },
    { icon: '📷', color: 'sky',     title: 'Radiology', features: ['Receive imaging orders', 'Upload reports', 'Linked to the record', 'Billing'] },
    { icon: '💊', color: 'purple',  title: 'Pharmacies', features: ['Receive prescriptions', 'Medication catalog', 'Dispensing & tracking', 'Billing'] },
    { icon: '🛡️', color: 'amber',   title: 'Insurance', features: ['Policy verification', 'Pre-authorization', 'Claims processing', 'Remittance'] },
  ],
};

/* href per card index (both locales share this order) */
const CARD_PATHS = ['hospitals', 'clinics', 'labs', 'radiology', 'pharmacies', 'insurance'];

const ACCENT: Record<string, string> = {
  teal: 'text-teal-600', indigo: 'text-indigo-600', emerald: 'text-emerald-600',
  sky: 'text-sky-600', purple: 'text-purple-600', amber: 'text-amber-600',
};

export default function ProvidersLanding({ lang }: { lang: Lang }) {
  const isRtl = lang === 'ar';
  const cards = CARDS[lang];

  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} className="min-h-screen bg-white font-cairo">
      <MegaNavbar lang={lang} />

      {/* Hero — one primary CTA */}
      <section className="px-4 py-14 md:py-20 bg-gradient-to-b from-white to-slate-50">
        <div className="max-w-3xl mx-auto text-center">
          <span className="inline-block text-xs font-bold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full mb-4">
            {T.hero.badge[lang]}
          </span>
          <h1 className="text-3xl md:text-5xl font-bold text-gray-900 mb-4 leading-snug">{T.hero.title[lang]}</h1>
          <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">{T.hero.subtitle[lang]}</p>
          <Link
            href={`/${lang}${T.hero.ctaHref}`}
            className="inline-block bg-indigo-700 hover:bg-indigo-800 text-white font-bold text-lg px-10 py-4 rounded-xl transition-all shadow-lg hover:shadow-xl"
          >
            {T.hero.primaryCta[lang]}
          </Link>
          <p className="text-gray-400 text-xs mt-3">{T.hero.ctaNote[lang]}</p>
        </div>
      </section>

      {/* Provider type cards → existing per-type pages */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-10">{T.types.title[lang]}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {cards.map((card, i) => (
              <Link
                key={i}
                href={`/${lang}/providers/${CARD_PATHS[i]}`}
                className="group bg-white rounded-2xl border border-gray-200 p-5 text-start shadow-sm hover:border-teal-400 hover:shadow-md transition-all"
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">{card.icon}</span>
                  <h3 className={`font-bold text-lg ${ACCENT[card.color] ?? 'text-gray-900'}`}>{card.title}</h3>
                </div>
                <ul className="space-y-1.5 mb-3">
                  {card.features.map((f, j) => (
                    <li key={j} className="text-gray-500 text-xs flex items-center gap-1.5">
                      <span className="text-teal-500">✓</span>{f}
                    </li>
                  ))}
                </ul>
                <span className="text-teal-600 text-sm font-semibold group-hover:underline">
                  {lang === 'ar' ? 'اعرف أكتر ←' : 'Learn more →'}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Embeddable widget */}
      <section className="py-16 px-4 bg-[#0F1F30]">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          <div className="text-start">
            <h2 className="text-white font-bold text-2xl md:text-3xl mb-3">{T.widget.title[lang]}</h2>
            <p className="text-white/70 mb-6">{T.widget.subtitle[lang]}</p>
            <ul className="space-y-2 mb-6">
              {T.widget.features[lang].map((f, i) => (
                <li key={i} className="text-white/80 text-sm flex items-start gap-2">
                  <span className="text-teal-400 mt-0.5">✓</span>{f}
                </li>
              ))}
            </ul>
            <Link
              href={`/${lang}${T.hero.ctaHref}`}
              className="inline-block bg-teal-600 hover:bg-teal-700 text-white font-bold px-6 py-3 rounded-xl transition-all"
            >
              {T.hero.primaryCta[lang]}
            </Link>
          </div>
          <div>
            <p className="text-white/50 text-xs mb-2">{T.widget.codeLabel[lang]}</p>
            <div className="relative rounded-xl bg-black/40 border border-white/10 p-4 pt-10 overflow-x-auto">
              <CopyCodeButton code={T.widget.code} label={T.widget.copyLabel[lang]} />
              <pre className="text-teal-200 text-xs leading-relaxed" dir="ltr"><code>{T.widget.code}</code></pre>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
