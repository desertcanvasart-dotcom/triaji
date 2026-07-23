'use client';

import Link from 'next/link';
import type { Lang } from '@triaji/shared/i18n';

const F = {
  platform:  { ar: 'المنصة', en: 'Platform' },
  patients:  { ar: 'للمرضى', en: 'For Patients' },
  doctors:   { ar: 'للأطباء', en: 'For Doctors' },
  providers: { ar: 'لمقدمي الخدمة', en: 'For Providers' },
  emergency: {
    ar: '\u26A0\uFE0F دكتور تريو ليس بديلاً عن الطوارئ — في حالات الطوارئ اتصل بـ 123',
    en: '\u26A0\uFE0F DoctorTrio is not a substitute for emergency care — call 123',
  },
  copyright: { ar: '\u00A9 2026 دكتور تريو — جميع الحقوق محفوظة', en: '\u00A9 2026 DoctorTrio — All rights reserved' },
  appName:   { ar: 'دكتور تريو', en: 'DoctorTrio' },
};

export default function SiteFooter({ lang }: { lang: Lang }) {
  return (
    <footer className="py-12 px-4 bg-gray-900 text-gray-400">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          <div>
            <h4 className="text-white font-bold mb-4">{F.platform[lang]}</h4>
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
            <h4 className="text-white font-bold mb-4">{F.providers[lang]}</h4>
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
            <h4 className="text-white font-bold mb-4">{F.patients[lang]}</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href={`/${lang}/chat`} className="hover:text-white transition-colors">{lang === 'ar' ? 'التوجيه الطبي' : 'Triage'}</Link></li>
              <li><Link href={`/${lang}/medical-record`} className="hover:text-white transition-colors">{lang === 'ar' ? 'السجل الطبي' : 'Records'}</Link></li>
              <li><Link href={`/${lang}/health-assistant`} className="hover:text-white transition-colors">{lang === 'ar' ? 'دكتور تريو يسألك' : 'Ask DoctorTrio'}</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold mb-4">{F.doctors[lang]}</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href={`/${lang}/doctor/register`} className="hover:text-white transition-colors">{lang === 'ar' ? 'تسجيل طبيب' : 'Register'}</Link></li>
              <li><Link href={`/${lang}/doctor`} className="hover:text-white transition-colors">{lang === 'ar' ? 'بوابة الأطباء' : 'Doctor Portal'}</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 pt-6 text-center">
          <p className="text-yellow-500 text-sm font-medium mb-3">
            {F.emergency[lang]}
          </p>
          <p className="text-xl font-bold text-teal-500 mb-1">
            {F.appName[lang]}
          </p>
          <a href="tel:19009" className="text-gray-300 hover:text-white text-sm font-medium transition-colors" dir="ltr">
            📞 19009
          </a>
          <p className="text-gray-500 text-xs mt-2">
            {F.copyright[lang]}
          </p>
        </div>
      </div>
    </footer>
  );
}
