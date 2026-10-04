import type { Metadata } from 'next';

export const SITE_ORIGIN = 'https://doctortrio.online';
export const LOCALES = ['ar', 'en'] as const;
export type SiteLocale = (typeof LOCALES)[number];

// Only these public information pages belong in Search and marketing analytics.
export const PUBLIC_PAGES: Record<string, Record<SiteLocale, { title: string; description: string }>> = {
  "": { en: { title: "DoctorTrio — Medical Triage & Booking in Egypt", description: "Explore Arabic and English medical triage, doctor booking, and healthcare provider services with DoctorTrio." }, ar: { title: "دكتور تريو — توجيه طبي وحجز أطباء في مصر", description: "اكتشف خدمات التوجيه الطبي وحجز الأطباء ومقدمي الرعاية الصحية بالعربية والإنجليزية مع دكتور تريو." } },
  "patients": { en: { title: "Healthcare Services for Patients | DoctorTrio", description: "Learn how DoctorTrio helps patients navigate medical triage, appointments, and healthcare services in Egypt." }, ar: { title: "خدمات الرعاية الصحية للمرضى | دكتور تريو", description: "تعرّف على خدمات دكتور تريو لمساعدة المرضى في التوجيه الطبي وحجز المواعيد والوصول إلى الرعاية الصحية في مصر." } },
  "doctor": { en: { title: "Doctor Portal & Practice Tools | DoctorTrio", description: "Discover DoctorTrio tools for doctors, including appointment management and patient care workflows." }, ar: { title: "بوابة الأطباء وأدوات إدارة العيادة | دكتور تريو", description: "اكتشف أدوات دكتور تريو للأطباء لإدارة المواعيد وتنظيم العمل ومتابعة رعاية المرضى." } },
  "providers": { en: { title: "Healthcare Provider Solutions | DoctorTrio", description: "Explore DoctorTrio solutions for hospitals, clinics, laboratories, radiology centers, pharmacies, and insurers." }, ar: { title: "حلول مقدمي الرعاية الصحية | دكتور تريو", description: "اكتشف حلول دكتور تريو للمستشفيات والعيادات والمعامل ومراكز الأشعة والصيدليات وشركات التأمين." } },
  "providers/hospitals": { en: { title: "Hospital Management Solutions | DoctorTrio", description: "Explore DoctorTrio hospital tools for coordinating appointments, care teams, and patient services." }, ar: { title: "حلول إدارة المستشفيات | دكتور تريو", description: "تعرّف على أدوات دكتور تريو للمستشفيات لتنسيق المواعيد وفرق الرعاية وخدمات المرضى." } },
  "providers/clinics": { en: { title: "Clinic Management Solutions | DoctorTrio", description: "Discover DoctorTrio clinic tools for appointments, reception, billing, and practice management." }, ar: { title: "حلول إدارة العيادات | دكتور تريو", description: "اكتشف أدوات دكتور تريو للعيادات لإدارة المواعيد والاستقبال والفواتير وتنظيم العمل." } },
  "providers/labs": { en: { title: "Laboratory Management Solutions | DoctorTrio", description: "Explore DoctorTrio solutions for laboratories, test bookings, and coordinating laboratory services." }, ar: { title: "حلول إدارة المعامل | دكتور تريو", description: "تعرّف على حلول دكتور تريو للمعامل وحجز التحاليل وتنظيم الخدمات المعملية." } },
  "providers/radiology": { en: { title: "Radiology Center Solutions | DoctorTrio", description: "Discover DoctorTrio tools for radiology centers and coordinating imaging appointments and services." }, ar: { title: "حلول مراكز الأشعة | دكتور تريو", description: "اكتشف أدوات دكتور تريو لمراكز الأشعة وتنظيم مواعيد وخدمات التصوير الطبي." } },
  "providers/pharmacies": { en: { title: "Pharmacy Management Solutions | DoctorTrio", description: "Explore DoctorTrio pharmacy solutions for prescription workflows and coordinating patient services." }, ar: { title: "حلول إدارة الصيدليات | دكتور تريو", description: "تعرّف على حلول دكتور تريو للصيدليات لتنظيم الوصفات الطبية وتنسيق خدمات المرضى." } },
  "providers/insurance": { en: { title: "Health Insurance Solutions | DoctorTrio", description: "Learn about DoctorTrio tools for coordinating insurance coverage and healthcare provider workflows." }, ar: { title: "حلول التأمين الصحي | دكتور تريو", description: "تعرّف على أدوات دكتور تريو لتنسيق التغطية التأمينية وإجراءات مقدمي الرعاية الصحية." } },
  "about": { en: { title: "About DoctorTrio", description: "Learn about DoctorTrio and its approach to connecting patients with healthcare services in Egypt." }, ar: { title: "عن دكتور تريو", description: "تعرّف على دكتور تريو ودوره في مساعدة المرضى للوصول إلى خدمات الرعاية الصحية في مصر." } },
  "contact": { en: { title: "Contact DoctorTrio", description: "Contact DoctorTrio for platform support, provider enquiries, and partnership information." }, ar: { title: "تواصل مع دكتور تريو", description: "تواصل مع دكتور تريو لدعم المنصة واستفسارات مقدمي الخدمات ومعلومات الشراكات." } },
  "privacy": { en: { title: "Privacy Policy | DoctorTrio", description: "Read the DoctorTrio privacy policy and learn how information is handled on the platform." }, ar: { title: "سياسة الخصوصية | دكتور تريو", description: "اقرأ سياسة خصوصية دكتور تريو وتعرّف على كيفية التعامل مع المعلومات على المنصة." } },
  "terms": { en: { title: "Terms of Use | DoctorTrio", description: "Read the terms governing use of DoctorTrio and its healthcare platform services." }, ar: { title: "شروط الاستخدام | دكتور تريو", description: "اقرأ الشروط المنظمة لاستخدام دكتور تريو وخدمات منصة الرعاية الصحية." } },
};

export function publicPage(pathname: string) {
  const match = /^\/(ar|en)(?:\/(.*))?$/.exec(pathname);
  if (!match) return null;
  const locale = match[1] as SiteLocale;
  const slug = match[2] ?? '';
  if (!Object.prototype.hasOwnProperty.call(PUBLIC_PAGES, slug)) return null;
  return { locale, slug, ...PUBLIC_PAGES[slug]![locale] };
}

export function publicPath(locale: SiteLocale, slug: string) {
  return `/${locale}${slug ? `/${slug}` : ''}`;
}

export function marketingMetadata(locale: SiteLocale, slug: string): Metadata {
  const content = PUBLIC_PAGES[slug]![locale];
  const canonical = SITE_ORIGIN + publicPath(locale, slug);
  return {
    ...content,
    robots: { index: true, follow: true },
    alternates: {
      canonical,
      languages: {
        ar: SITE_ORIGIN + publicPath('ar', slug),
        en: SITE_ORIGIN + publicPath('en', slug),
        'x-default': SITE_ORIGIN + publicPath('ar', slug),
      },
    },
    openGraph: { ...content, url: canonical, siteName: 'DoctorTrio', type: 'website', locale: locale === 'ar' ? 'ar_EG' : 'en_US' },
    twitter: { card: 'summary', ...content },
  };
}
