import Link from 'next/link';
import type { Lang } from '@triaji/shared/i18n';

/* Doctor feature callouts, relocated from the old monolithic homepage (Priority 1)
   onto the dedicated /doctor page so nothing is lost in the restructure. */

const T = {
  title:    { ar: 'أدوات ذكية تخلي شغلك أسهل وأدق', en: 'Smart tools that make your work easier and more precise' },
  subtitle: { ar: 'كل اللي محتاجه كطبيب في مكان واحد', en: 'Everything you need as a doctor, in one place' },
  cta:      { ar: 'سجّل كطبيب مجاناً', en: 'Register as a doctor — free' },
  features: {
    ar: [
      { icon: '🚨', title: 'البحث الفوري عن سرير عناية', desc: 'ابحث عن أقرب مستشفى بسرير عناية متاح في ثوانٍ — بدل مكالمات مضيعة للوقت', highlight: true },
      { icon: '📋', title: 'ملخص قبل الكشف', desc: 'ملخص طبي شامل لكل مريض بين يديك — بناءً على شكوى المريض وتاريخه المرضي' },
      { icon: '⚠️', title: 'فحص تفاعلات الأدوية', desc: 'تحذير فوري لو في تعارض بين الأدوية — مع إمكانية التجاوز المُوثّق' },
      { icon: '🧪', title: 'طلب تحاليل ذكي', desc: 'أرسل طلبات التحاليل مباشرة للبرج والمختبر وألفا' },
      { icon: '👥', title: 'لوحة المرضى + فيديو', desc: 'تابع مرضاك كطبيب أساسي + مكالمات فيديو سريعة' },
      { icon: '👶', title: 'حاسبة جرعات الأطفال', desc: 'جرعة حسب الوزن + التركيزات المصرية المتاحة' },
      { icon: '💻', title: 'دكتور تريو', desc: 'استقبل المرضى بكفاءة — الموعد الأول والتالت أونلاين، التاني بس في العيادة' },
      { icon: '🏥', title: 'إدارة عيادتك', desc: 'قائمة انتظار لحظية، حجوزات أونلاين، فواتير، وتقارير مالية — من لوحة تحكم واحدة' },
    ],
    en: [
      { icon: '🚨', title: 'Instant ICU bed search', desc: 'Find the nearest hospital with an available ICU bed in seconds — no more time-wasting phone calls', highlight: true },
      { icon: '📋', title: 'Pre-consultation summary', desc: 'Complete AI-generated patient summary before every consultation' },
      { icon: '⚠️', title: 'Drug interaction checking', desc: 'Real-time alerts for medication conflicts — with documented override' },
      { icon: '🧪', title: 'Smart lab ordering', desc: 'Send orders directly to Al-Borg, Al-Mokhtabar, and Alfa' },
      { icon: '👥', title: 'Patient panel + video', desc: 'Follow your patients as their GP + quick video calls' },
      { icon: '👶', title: 'Paediatric dose calculator', desc: 'Weight-based dosing + available Egyptian formulations' },
      { icon: '💻', title: 'Doctor Trio', desc: 'See patients efficiently — first and third appointments online, only the second in clinic' },
      { icon: '🏥', title: 'Manage your clinic', desc: 'Real-time queue, online bookings, invoices, and financial reports — from one control panel' },
    ],
  },
};

export default function DoctorFeatureGrid({ lang }: { lang: Lang }) {
  return (
    <section className="py-20 px-4 bg-white" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">{T.title[lang]}</h2>
          <p className="text-gray-500">{T.subtitle[lang]}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {T.features[lang].map((f, i) => (
            <div
              key={i}
              className={`rounded-2xl border p-5 text-start ${
                f.highlight ? 'border-teal-300 bg-teal-50' : 'border-gray-100 bg-white shadow-sm'
              }`}
            >
              <span className="text-2xl">{f.icon}</span>
              <h3 className="text-gray-900 font-bold text-sm mt-2 mb-1">{f.title}</h3>
              <p className="text-gray-500 text-xs leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>

        <div className="text-center mt-10">
          <Link
            href={`/${lang}/doctor/register`}
            className="inline-block bg-teal-500 hover:bg-teal-600 text-white font-bold px-8 py-3.5 rounded-xl transition-colors"
          >
            {T.cta[lang]}
          </Link>
        </div>
      </div>
    </section>
  );
}
