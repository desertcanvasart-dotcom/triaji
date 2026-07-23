import Link from 'next/link';
import { cookies } from 'next/headers';
import { s } from '@triaji/shared/i18n';
import type { Lang } from '@triaji/shared/i18n';
import FadeInSection from '../components/ui/FadeInSection';
import ShowMoreToggle from './ShowMoreToggle';
import CopyCodeButton from './CopyCodeButton';
import LanguageDropdown from '@/components/shared/LanguageDropdown';
import MegaNavbar from '@/components/shared/MegaNavbar';

/* ═══════════════════════════════════════════════════════════════════════════
   BILINGUAL CONTENT
   ═══════════════════════════════════════════════════════════════════════════ */

const NAV = {
  patients: { ar: 'للمرضى', en: 'For Patients' },
  doctors:  { ar: 'للأطباء', en: 'For Doctors' },
  providers:{ ar: 'للمستشفيات', en: 'For Providers' },
  signIn:   { ar: 'دخول', en: 'Sign In' },
  getStarted: { ar: 'ابدأ الآن', en: 'Get Started' },
};

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

const HOW_IT_WORKS = {
  title: { ar: 'كيف يعمل دكتور تريو؟', en: 'How It Works' },
  steps: {
    ar: [
      { num: '1', icon: '🎤', title: 'يتعرف على أعراضك بدقة', desc: 'بالصوت أو الكتابة — بالعربي العادي' },
      { num: '2', icon: '🧠', title: 'ويقيمها بشكل صحيح', desc: 'دكتور تريو يحدد الخطورة ويرشحلك الدكتور المناسب' },
      { num: '3', icon: '📅', title: 'يقوم بالحجز ومن ثم يتابع', desc: 'حجز الموعد، سجلك الطبي، ومتابعة مستمرة' },
    ],
    en: [
      { num: '1', icon: '🎤', title: 'Describe your symptoms', desc: 'By voice or text — in your own words' },
      { num: '2', icon: '🧠', title: 'We assess and guide', desc: 'AI determines severity and matches you with the right doctor' },
      { num: '3', icon: '📅', title: 'Book and follow up', desc: 'Book your appointment, track records, ongoing care' },
    ],
  },
};

const PILLARS = {
  title: { ar: 'منصة متكاملة لكل احتياجاتك الصحية', en: 'A Complete Platform for All Your Health Needs' },
  items: {
    ar: [
      { icon: '🧠', title: 'التوجيه الطبي الذكي', desc: 'احكي أعراضك بالصوت أو الكتابة — الذكاء الاصطناعي يقيّم حالتك ويوجّهك للتخصص المناسب' },
      { icon: '📋', title: 'سجلك الطبي الكامل', desc: 'تحاليل، أدوية، أمراض مزمنة، متابعة المؤشرات الحيوية — كله في مكان واحد' },
      { icon: '🧪', title: 'التحاليل والصيدلية', desc: 'ربط مع البرج والمختبر وألفا — النتايج توصلك أوتوماتيك والروشتة تتبع للصيدلية' },
      { icon: '👨‍⚕️', title: 'شبكة الأطباء', desc: 'طبيب أساسي يتابع حالتك، مكالمات فيديو، وتحويلات بين التخصصات' },
      { icon: '📞', title: 'مركز الاتصال الذكي', desc: 'ذكاء اصطناعي يرد 24/7 بدون أخطاء — مدعوم بقاعدة بيانات طبية شاملة', callCenter: true },
      { icon: '💬', title: 'دكتور تريو يسألك', desc: 'مساعد صحي ذكي يشرحلك نتايج تحاليلك وأدويتك بالعربي — مبني على بياناتك الشخصية' },
      { icon: '🚨', title: 'أسرّة العناية المركزة', desc: 'أول نظام في مصر لعرض أسرّة العناية المتاحة في الوقت الفعلي', featured: true },
    ],
    en: [
      { icon: '🧠', title: 'AI Medical Triage', desc: 'Describe symptoms by voice or text — AI assesses severity and matches you with the right specialty' },
      { icon: '📋', title: 'Complete Medical Records', desc: 'Lab results, medications, chronic conditions, vital trends — all in one place' },
      { icon: '🧪', title: 'Labs & Pharmacy', desc: 'Connected to Al-Borg, Al-Mokhtabar, and Alfa — results arrive automatically, prescriptions routed to pharmacy' },
      { icon: '👨‍⚕️', title: 'Doctor Network', desc: 'A primary care doctor who follows your case, video calls, and specialist referrals' },
      { icon: '📞', title: 'AI Call Center', desc: 'AI answers 24/7 with zero errors — powered by a comprehensive medical knowledge base', callCenter: true },
      { icon: '💬', title: 'Ask DoctorTrio', desc: 'A personal health AI that explains your lab results and medications in plain language — grounded in your own data' },
      { icon: '🚨', title: 'ICU Bed Availability', desc: 'Egypt\'s first real-time ICU bed availability system', featured: true },
    ],
  },
};

const DOCTOR_TRIO = {
  badge:    { ar: 'وفّر وقتك ومصاريفك', en: 'Save time and money' },
  title:    { ar: 'دكتور تريو', en: 'Doctor Trio' },
  subtitle: { ar: 'نفس الرعاية الطبية الكاملة — بزيارة واحدة بس للعيادة', en: 'The same complete medical care — with just one clinic visit' },
  problem:  { ar: 'عادةً بتزور الدكتور 3 مرات لحالة واحدة — مرة يطلب تحاليل، مرة يفحصك، ومرة يعدّل الدواء. دكتور تريو بتوفرلك نفس النتيجة بطريقة أذكى.', en: 'Most patients visit their doctor 3 times for one episode: once to order tests, once for the examination, once for follow-up. Doctor Trio restructures this the smart way.' },
  steps: {
    ar: [
      { number: '١', icon: '💻', tag: 'أونلاين', tagColor: 'teal', title: 'الموعد الأول — أونلاين', desc: 'الدكتور يشوف أعراضك ويطلب التحاليل والأشعة اللازمة — من غير ما تتعب وتروح العيادة' },
      { number: '٢', icon: '🏥', tag: 'في العيادة', tagColor: 'navy', title: 'الموعد الثاني — في العيادة', desc: 'زيارة واحدة بس — الدكتور عنده كل نتايجك جاهزة، يفحصك ويوصف العلاج المناسب' },
      { number: '٣', icon: '💻', tag: 'أونلاين', tagColor: 'teal', title: 'الموعد الثالث — أونلاين', desc: 'متابعة بعد العلاج — الدكتور يراجع حالتك ويعدّل الدواء لو محتاج، من راحة بيتك' },
    ],
    en: [
      { number: '1', icon: '💻', tag: 'Online', tagColor: 'teal', title: 'First appointment — Online', desc: 'Your doctor reviews your symptoms and orders the necessary tests and scans — without you leaving home' },
      { number: '2', icon: '🏥', tag: 'In Clinic', tagColor: 'navy', title: 'Second appointment — In Clinic', desc: 'One clinic visit only — your doctor has all results ready, examines you, and prescribes treatment' },
      { number: '3', icon: '💻', tag: 'Online', tagColor: 'teal', title: 'Third appointment — Online', desc: 'Follow-up after treatment — your doctor reviews your progress and adjusts medication if needed, from your home' },
    ],
  },
  saving:  { ar: 'بدل 3 زيارات للعيادة — زيارة واحدة بس', en: 'Instead of 3 clinic trips — just one' },
  price:   { ar: 'كل ده بسعر واحد شامل', en: 'All included at one fixed price' },
  cta:     { ar: 'احجز ثلاثيتك الآن', en: 'Book your Doctor Trio' },
};

const CALL_CENTER = {
  badge:      { ar: '🤖 مدعوم بالذكاء الاصطناعي', en: '🤖 AI-Powered' },
  title:      { ar: 'مركز الاتصال بتاعنا —هو نقطة التقاء كافة خدماتك الطبية', en: 'Our Call Center — The Hub for All Your Medical Services' },
  subtitle:   { ar: 'مش محتاج تطبيق أو إنترنت — اتصل وهتلاقي دكتور تريو جاهز لمساعدتك في أي وقت', en: 'No app or internet needed — call and DoctorTrio is ready to help at any time' },
  capabilities: {
    ar: [
      { icon: '🧠', title: 'تجربة رقمية بالكامل', desc: 'تجربة رقمية طبية متخصصة على أعلى مستوى' },
      { icon: '🕐', title: '24 ساعة / 7 أيام', desc: 'مفيش إجازات أو أوقات راحة — متاح كل يوم، كل ساعة، طول السنة' },
      { icon: '✅', title: 'بدون أخطاء بشرية', desc: 'معلومات طبية دقيقة ومحدّثة دايماً — مفيش نسيان أو خطأ' },
      { icon: '📚', title: 'قاعدة بيانات طبية شاملة', desc: 'دكتور تريو مدعوم بقاعدة بيانات طبية محدثة بشكل دوري بإشراف نخبة من أفضل الأطباء المصريين' },
    ],
    en: [
      { icon: '🧠', title: 'Fully digital experience', desc: 'A specialised digital medical experience at the highest level' },
      { icon: '🕐', title: '24 hours / 7 days', desc: 'No holidays or breaks — available every day, every hour, all year' },
      { icon: '✅', title: 'Zero human error', desc: 'Always accurate and up-to-date medical information — no mistakes' },
      { icon: '📚', title: 'Comprehensive knowledge', desc: 'Powered by all of DoctorTrio\'s medical data — symptoms, medications, doctors, labs' },
    ],
  },
  comparison: {
    label: { ar: 'بدل مراكز الاتصال التقليدية:', en: 'Unlike traditional call centers:' },
    items: {
      ar: [
        { old: 'انتظار في الخط', nu: 'رد فوري' },
        { old: 'أخطاء بشرية', nu: 'دقة 100%' },
        { old: 'ساعات عمل محدودة', nu: '24/7 بدون توقف' },
        { old: 'معلومات قد تكون قديمة', nu: 'معلومات محدّثة دايماً' },
      ],
      en: [
        { old: 'Waiting on hold', nu: 'Instant answer' },
        { old: 'Human errors', nu: '100% accuracy' },
        { old: 'Limited working hours', nu: '24/7 non-stop' },
        { old: 'Possibly outdated info', nu: 'Always up-to-date' },
      ],
    },
  },
  phone:      '19009',
  phoneLabel: { ar: '📞 اتصل الآن — الرد فوري', en: '📞 Call now — answered instantly' },
  note:       { ar: 'متاح 24 ساعة · 7 أيام · طول السنة', en: 'Available 24 hours · 7 days · All year' },
  statusLine: { ar: 'النظام يعمل الآن', en: 'System online now' },
};

const WIDGET_SHOWCASE = {
  title:    { ar: 'ضع دكتور تريو في موقع مستشفاك', en: 'Add DoctorTrio to Your Hospital Website' },
  subtitle: { ar: 'سطر واحد من الكود يضيف دكتور تريو لأي موقع — مرضاك يستخدموا دكتور تريو من غير ما يسيبوا موقعك', en: 'One line of code adds DoctorTrio to any website — your patients use DoctorTrio without leaving your site' },
  codeLabel:{ ar: 'أضف هذا الكود لموقعك:', en: 'Add this to your website:' },
  code:     '<script\n  src="https://doctortrio.online/widget.js"\n  data-tenant="HOSPITAL_ID"\n></script>',
  features: {
    ar: ['يظهر كزر دكتور تريو في ركن موقعك', 'مريضك يفرز أعراضه ويحجز مباشرة', 'كل البيانات ترجع لداشبورد المستشفى', 'يتكيف مع ألوان موقعك', 'يتضمن مركز اتصال يعمل بالذكاء الاصطناعي، ومدعوماً بقاعدة بيانات طبية حديثة'],
    en: ['Appears as a DoctorTrio button on your site', 'Patient triages and books directly', 'All data flows to your hospital dashboard', 'Adapts to your website\'s colours', 'Includes an AI-powered call center, backed by an up-to-date medical database'],
  },
  cta:     { ar: 'احصل على الكود', en: 'Get the Code' },
  ctaNote: { ar: 'مجاني للمستشفيات والعيادات المسجلة', en: 'Free for registered hospitals and clinics' },
  copyLabel: { ar: 'نسخ الكود', en: 'Copy Code' },
};

const FOR_PATIENTS = {
  title:    { ar: 'للمرضى', en: 'For Patients' },
  tagline:  { ar: 'دكتور تريو هو مدير لملفك الطبي بالكامل', en: 'DoctorTrio is the complete manager of your medical file' },
  subtitle: { ar: 'كل اللي محتاجه لصحتك — في تطبيق واحد', en: 'Everything you need for your health — in one app' },
  showMore: { ar: 'عرض المزيد', en: 'Show more' },
  showLess: { ar: 'عرض أقل', en: 'Show less' },
  features: {
    ar: [
      { icon: '🧠', tag: 'ذكاء اصطناعي', title: 'التوجيه الطبي الذكي', desc: 'صف أعراضك بصوتك أو كتابةً — الذكاء الاصطناعي يحلل حالتك ويوصلك للدكتور المناسب' },
      { icon: '🤖', tag: 'جديد', title: 'دكتور تريو يسألك', desc: 'مساعدك الصحي الشخصي — بيشرحلك تحاليلك وأدويتك وتاريخك الطبي بالعامية' },
      { icon: '📋', tag: '', title: 'سجلك الطبي الكامل', desc: 'تحاليل، أدوية، زيارات، أشعة — كل تاريخك الصحي في مكان واحد مع منحنيات التطور' },
      { icon: '🧪', tag: '', title: 'التحاليل والأشعة', desc: 'احجز في معامل البرج والمختبر وألفا — النتايج بترجع تلقائياً لسجلك' },
      { icon: '💊', tag: '', title: 'الروشتة والصيدلية', desc: 'روشتتك بتتبعت للصيدلية أونلاين — ادفع واستلم أو توصيل لبيتك' },
      { icon: '👨‍⚕️', tag: '', title: 'طبيبك الأساسي', desc: 'GP مخصص ليك يتابع صحتك ويرتب إحالاتك — مع إمكانية مكالمة فيديو' },
      { icon: '🛡️', tag: '', title: 'التأمين والدفع', desc: 'فوري وباي موب وفودافون كاش — ومتصلين بـ AXA وMetLife وميدمارك وغيرهم' },
      { icon: '🚨', tag: 'الأول في مصر', title: 'البحث عن سرير عناية', desc: 'اعرف أي مستشفى قريب منك عنده سرير عناية متاح — في الوقت الفعلي' },
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
      { icon: '🚨', tag: 'First in Egypt', title: 'ICU Bed Finder', desc: 'See which nearby hospitals have available ICU beds — in real time' },
      { icon: '👶', tag: '', title: 'Paediatric Profiles', desc: 'Growth charts, Egyptian vaccination schedule, developmental milestones — all for your child' },
      { icon: '💻', tag: '', title: 'Doctor Trio', desc: 'Online consult + one clinic visit + online follow-up — instead of 3 trips' },
      { icon: '📞', tag: 'AI 24/7', title: 'AI Call Center', desc: 'AI answers your call any time — zero errors, zero waiting' },
      { icon: '🌍', tag: '', title: 'Arabic & English', desc: 'The entire platform in Arabic and English — choose your preferred language' },
    ],
  },
};

const FOR_DOCTORS = {
  title:    { ar: 'للأطباء', en: 'For Doctors' },
  subtitle: { ar: 'أدوات ذكية تخلي شغلك أسهل وأدق', en: 'Smart tools that make your work easier and more precise' },
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
      { icon: '🏥', title: 'إدارة عيادتك', desc: 'قائمة انتظار لحظية، حجوزات أونلاين، فواتير، وتقارير مالية — كل ده من لوحة تحكم واحدة', clinic: true },
    ],
    en: [
      { icon: '🚨', title: 'Instant ICU bed search', desc: 'Find the nearest hospital with an available ICU bed in seconds — no more time-wasting phone calls', highlight: true },
      { icon: '📋', title: 'Pre-consultation summary', desc: 'Complete AI-generated patient summary before every consultation' },
      { icon: '⚠️', title: 'Drug interaction checking', desc: 'Real-time alerts for medication conflicts — with documented override' },
      { icon: '🧪', title: 'Smart lab ordering', desc: 'Send orders directly to Al-Borg, Al-Mokhtabar, and Alfa' },
      { icon: '👥', title: 'Patient panel + video', desc: 'Follow your patients as their GP + quick video calls' },
      { icon: '👶', title: 'Paediatric dose calculator', desc: 'Weight-based dosing + available Egyptian formulations' },
      { icon: '💻', title: 'Doctor Trio', desc: 'See patients efficiently — first and third appointments online, only the second in clinic' },
      { icon: '🏥', title: 'Manage Your Clinic', desc: 'Real-time queue, online bookings, invoices, and financial reports — all from one control panel', clinic: true },
    ],
  },
};

const FOR_PROVIDERS = {
  title:    { ar: 'لمقدمي الخدمة', en: 'For Providers' },
  subtitle: { ar: 'لوحات تحكم متخصصة لكل نوع مقدم خدمة', en: 'Specialized dashboards for every provider type' },
  cards: {
    ar: [
      { color: 'indigo', title: 'العيادات', features: ['قائمة انتظار ذكية', 'مواعيد بوقت محدد', 'فواتير ومحاسبة', 'فروع متعددة'] },
      { color: 'emerald', title: 'المعامل', features: ['استقبال طلبات التحاليل', 'رفع النتايج', 'ربط مع البرج والمختبر وألفا', 'فواتير'] },
      { color: 'purple', title: 'الصيدليات', features: ['استقبال الروشتات', 'كتالوج الأدوية', 'صرف ومتابعة', 'فواتير'] },
      { color: 'amber', title: 'التأمين', features: ['تحقق من البوليصات', 'موافقات مسبقة', 'مطالبات', 'تسويات مالية'] },
      { color: 'violet', title: 'سلاسل وفروع', features: ['إدارة مركزية', 'أطباء مشتركين', 'مرضى مشتركين', 'تقارير موحدة'] },
    ],
    en: [
      { color: 'indigo', title: 'Clinics', features: ['Smart walk-in queue', 'Time slot booking', 'Billing & invoicing', 'Multi-branch'] },
      { color: 'emerald', title: 'Labs', features: ['Receive lab orders', 'Upload results', 'Al-Borg, Al-Mokhtabar, Alfa', 'Billing'] },
      { color: 'purple', title: 'Pharmacies', features: ['Receive prescriptions', 'Medication catalog', 'Dispensing & tracking', 'Billing'] },
      { color: 'amber', title: 'Insurance', features: ['Policy verification', 'Pre-authorization', 'Claims processing', 'Remittance'] },
      { color: 'violet', title: 'Chains & Branches', features: ['Centralised management', 'Shared doctors', 'Shared patients', 'Consolidated analytics'] },
    ],
  },
};

const JOURNEY = {
  title:    { ar: 'رحلة المريض في دكتور تريو', en: 'The Patient Journey on DoctorTrio' },
  subtitle: { ar: 'من أول عرض لآخر متابعة — كل ده في دكتور تريو', en: 'From first symptom to final follow-up — all in DoctorTrio' },
  steps: {
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
};

const TRUST = {
  title: { ar: 'أرقام دكتور تريو', en: 'DoctorTrio in Numbers' },
  stats: {
    ar: [
      { value: '27', label: 'محافظة مصرية', icon: '🗺️' },
      { value: '5', label: 'شركة تأمين', icon: '🏛️' },
      { value: '3', label: 'شبكة معامل كبرى', icon: '🧪' },
      { value: '14', label: 'تطعيم في الجدول المصري', icon: '💉' },
    ],
    en: [
      { value: '27', label: 'Egyptian Governorates', icon: '🗺️' },
      { value: '5', label: 'Insurance Partners', icon: '🏛️' },
      { value: '3', label: 'Major Lab Chains', icon: '🧪' },
      { value: '14', label: 'Vaccines Tracked', icon: '💉' },
    ],
  },
  security: { ar: 'بياناتك مشفرة ومحمية — معايير أمان عالمية', en: 'Your data is encrypted and protected — global security standards' },
};

const ICU_SECTION = {
  ar: {
    badge:       '🚨 الأول من نوعه في مصر',
    title:       'في الطوارئ — اعرف مين عنده سرير عناية فوراً',
    subtitle:    'دكتور تريو بيعرض أسرّة العناية المركزة المتاحة في مستشفيات دكتور تريو في الوقت الفعلي — لأول مرة في مصر',
    problem:     'في كل يوم، أسر مصرية بتضيع وقت ثمين وهي بتتصل بمستشفى ورا مستشفى تسأل "عندكم سرير عناية؟" — دكتور تريو حل هذه المشكلة.',
    features: [
      { icon: '📍', title: 'أقرب مستشفى بسرير متاح', description: 'النتايج مرتبة حسب المسافة منك — أقرب أولاً' },
      { icon: '⚡', title: 'بيانات فعلية لحظة بلحظة', description: 'المستشفيات بتحدّث عدد الأسرة المتاحة أولاً بأول' },
      { icon: '🏥', title: '8 أنواع وحدات عناية', description: 'عناية عامة · قلبية · أطفال · جراحية · حروق · أعصاب · وأكتر' },
      { icon: '🔒', title: 'للأطباء فقط', description: 'متاح حصرياً للأطباء والعيادات المسجّلة في دكتور تريو' },
    ],
    liveDisplay: {
      label:     'أسرّة متاحة الآن',
      live:      'مباشر',
      hospitals: [
        { name: 'مستشفى القاهرة الجديدة', distance: '3.2 كم', beds: 2, unit: 'عناية عامة',  status: 'available' as const },
        { name: 'مستشفى الشروق',          distance: '5.7 كم', beds: 1, unit: 'عناية قلبية', status: 'available' as const },
        { name: 'مستشفى النيل',           distance: '6.1 كم', beds: 0, unit: 'عناية عامة',  status: 'full' as const },
      ],
      disclaimer: 'بيانات تجريبية للعرض فقط',
      bedLabel:   'سرير متاح',
      fullLabel:  'ممتلئ',
      lastUpdate: 'آخر تحديث: منذ 4 دقائق',
    },
    cta:              'للأطباء: ابحث عن سرير عناية',
    ctaNote:          'يتطلب حساب طبيب مسجّل في دكتور تريو',
    forHospitals:     'أنت مستشفى؟',
    forHospitalsLink: 'سجّل أسرّة عنايتك في دكتور تريو →',
  },
  en: {
    badge:       '🚨 First of its kind in Egypt',
    title:       'In an emergency — find an available ICU bed instantly',
    subtitle:    'DoctorTrio displays real-time ICU bed availability across DoctorTrio-registered hospitals — for the first time in Egypt',
    problem:     'Every day, Egyptian families waste precious time calling hospital after hospital asking "do you have an ICU bed?" — DoctorTrio solves this.',
    features: [
      { icon: '📍', title: 'Nearest hospital with available beds', description: 'Results sorted by distance from your location — closest first' },
      { icon: '⚡', title: 'Real-time live data', description: 'Hospitals update their available bed counts in real time' },
      { icon: '🏥', title: '8 ICU unit types', description: 'General · Cardiac · Paediatric · Surgical · Burns · Neuro · and more' },
      { icon: '🔒', title: 'Doctors only', description: 'Available exclusively to verified doctors and registered clinics' },
    ],
    liveDisplay: {
      label:     'Available beds right now',
      live:      'Live',
      hospitals: [
        { name: 'Cairo New Hospital',  distance: '3.2 km', beds: 2, unit: 'General ICU',  status: 'available' as const },
        { name: 'Al-Shorouk Hospital', distance: '5.7 km', beds: 1, unit: 'Cardiac ICU',  status: 'available' as const },
        { name: 'Al-Nile Hospital',    distance: '6.1 km', beds: 0, unit: 'General ICU',  status: 'full' as const },
      ],
      disclaimer: 'Sample data for demonstration only',
      bedLabel:   'bed available',
      fullLabel:  'Full',
      lastUpdate: 'Last update: 4 minutes ago',
    },
    cta:              'Doctors: Search for an ICU bed',
    ctaNote:          'Requires a verified DoctorTrio doctor account',
    forHospitals:     'Are you a hospital?',
    forHospitalsLink: 'Register your ICU beds on DoctorTrio →',
  },
};

const CTA = {
  title:    { ar: 'جاهز تبدأ؟', en: 'Ready to Start?' },
  patient:  { ar: 'ابدأ التوجيه الطبي الآن', en: 'Start Medical Triage Now' },
  doctor:   { ar: 'سجّل كطبيب مجاناً', en: 'Register as a Doctor — Free' },
  provider: { ar: 'تواصل معنا', en: 'Contact Us' },
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

const COLOR_MAP: Record<string, string> = {
  indigo:  'border-t-indigo-700',
  emerald: 'border-t-emerald-700',
  purple:  'border-t-purple-700',
  amber:   'border-t-amber-700',
  violet:  'border-t-violet-700',
};

/* ═══════════════════════════════════════════════════════════════════════════
   PAGE COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

export default async function HomePage() {
  const cookieStore = await cookies();
  const lang: Lang = cookieStore.get('lang')?.value === 'en' ? 'en' : 'ar';
  const isRtl = lang === 'ar';
  const otherLang = lang === 'ar' ? 'en' : 'ar';

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
              <Link
                href={`/${lang}/doctor`}
                className="bg-indigo-700 hover:bg-indigo-800 text-white font-bold px-6 py-4 rounded-xl transition-all w-full sm:w-auto"
              >
                {HERO.ctaDoctor[lang]}
              </Link>
              <Link
                href="#providers"
                className="border-2 border-gray-300 text-gray-700 hover:border-teal-600 hover:text-teal-600 font-bold px-6 py-3.5 rounded-xl transition-all w-full sm:w-auto"
              >
                {HERO.ctaProvider[lang]}
              </Link>
            </div>
            <p className="text-gray-400 text-xs mt-2 text-center sm:text-start">
              {HERO.heroNote[lang]}
            </p>
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
            <div key={i} className="flex-shrink-0 bg-white/10 rounded-xl px-4 py-3 flex items-start gap-3 min-w-[200px]">
              <span className="text-2xl">{stat.icon}</span>
              <div>
                <p className="text-white font-semibold text-xs leading-snug">{stat.value}</p>
                <p className="text-white/60 text-[10px] mt-0.5">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ 2.5. HOW IT WORKS — 3 STEPS ════════════════════════════════ */}
      <section className="py-16 px-4 bg-slate-50">
        <div className="max-w-5xl mx-auto">
          <FadeInSection>
            <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
              {HOW_IT_WORKS.title[lang]}
            </h2>
          </FadeInSection>

          <div className="flex flex-col md:flex-row items-start justify-center gap-0">
            {HOW_IT_WORKS.steps[lang].map((step, i) => (
              <FadeInSection key={i} delay={i * 100}>
                <div className="flex flex-col md:flex-row items-center">
                  <div className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow duration-200 border border-gray-100 text-center w-full md:w-64">
                    <div className="w-10 h-10 rounded-full bg-teal-600 text-white font-bold text-lg flex items-center justify-center mx-auto mb-3">
                      {step.num}
                    </div>
                    <div className="text-3xl mb-3">{step.icon}</div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">{step.title}</h3>
                    <p className="text-gray-600 text-sm">{step.desc}</p>

                    {/* Mini chat preview under step 1 only */}
                    {i === 0 && (
                      <div className="mt-4 bg-gray-50 rounded-xl p-3">
                        <div className={`flex ${isRtl ? 'justify-end' : 'justify-start'} mb-1`}>
                          <span className="bg-teal-600 text-white text-[10px] rounded-xl px-3 py-1 inline-block">
                            {lang === 'ar' ? 'عندي صداع وحرارة' : 'I have a headache and fever'}
                          </span>
                        </div>
                        <div className={`flex ${isRtl ? 'justify-start' : 'justify-end'} mb-1`}>
                          <span className="bg-gray-200 text-gray-700 text-[10px] rounded-xl px-3 py-1 inline-block">
                            {lang === 'ar' ? 'دكتور تريو بيحلل...' : 'AI is analysing...'}
                          </span>
                        </div>
                        <div className={`flex gap-1 ${isRtl ? 'justify-start' : 'justify-start'}`}>
                          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Arrow between steps — desktop only */}
                  {i < 2 && (
                    <div className="hidden md:flex items-center justify-center px-3 mt-8">
                      <svg width="28" height="28" viewBox="0 0 32 32" className={`text-teal-300 ${isRtl ? 'rotate-180' : ''}`}>
                        <path d="M6 16h20M18 8l8 8-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                      </svg>
                    </div>
                  )}
                </div>
              </FadeInSection>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 3.5. DOCTOR TRIO ════════════════════════════════════════════ */}
      <section className="py-20 px-4 bg-gradient-to-br from-teal-700 to-[#1A2F4A]">
        <div className="max-w-5xl mx-auto text-center">
          <FadeInSection>
            <span className="inline-block bg-white/20 text-white text-sm font-bold px-4 py-1 rounded-full mb-4">
              {DOCTOR_TRIO.badge[lang]}
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
              {DOCTOR_TRIO.title[lang]}
            </h2>
            <p className="text-white/70 text-lg mb-4 max-w-2xl mx-auto">
              {DOCTOR_TRIO.subtitle[lang]}
            </p>
            <p className="text-white/50 text-sm mb-12 max-w-xl mx-auto">
              {DOCTOR_TRIO.problem[lang]}
            </p>
          </FadeInSection>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {DOCTOR_TRIO.steps[lang].map((step, i) => (
              <FadeInSection key={i} delay={i * 120}>
                <div className="relative bg-white/10 backdrop-blur-sm rounded-2xl p-6 text-start">
                  <span className="absolute -top-3 start-4 w-8 h-8 rounded-full bg-teal-500 text-white text-sm font-bold flex items-center justify-center">
                    {step.number}
                  </span>
                  {/* Online / In Clinic tag */}
                  <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full mb-3 mt-1 ${
                    step.tagColor === 'teal'
                      ? 'bg-teal-500/30 text-teal-200'
                      : 'bg-white/20 text-white/80'
                  }`}>
                    {step.icon} {step.tag}
                  </span>
                  <h3 className="text-lg font-bold text-white mb-2">{step.title}</h3>
                  <p className="text-white/70 text-sm">{step.desc}</p>
                </div>
                {i < 2 && (
                  <div className="hidden md:flex justify-center mt-4">
                    <span className="text-2xl text-white/30">{isRtl ? '←' : '→'}</span>
                  </div>
                )}
              </FadeInSection>
            ))}
          </div>

          {/* Saving line */}
          <div className="flex items-center justify-center gap-3 mt-8 mb-2">
            <div className="h-px w-12 bg-white/30" />
            <span className="text-white font-semibold text-sm">{DOCTOR_TRIO.saving[lang]}</span>
            <div className="h-px w-12 bg-white/30" />
          </div>
          <p className="text-white/60 text-xs text-center mb-6">{DOCTOR_TRIO.price[lang]}</p>

          <Link
            href={`/${lang}/chat`}
            className="inline-block bg-white text-teal-700 font-bold text-lg px-8 py-4 rounded-xl hover:bg-teal-50 transition-all shadow-lg hover:-translate-y-0.5 duration-200"
          >
            {DOCTOR_TRIO.cta[lang]}
          </Link>
        </div>
      </section>

      {/* ═══ 4. FOR PATIENTS ═════════════════════════════════════════════ */}
      <section id="patients" className="py-20 px-4 bg-slate-50">
        <div className="max-w-5xl mx-auto">
          <FadeInSection>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 text-center mb-2">
              {FOR_PATIENTS.title[lang]}
            </h2>
            <p className="text-teal-600 font-semibold text-center text-lg mb-2">
              {FOR_PATIENTS.tagline[lang]}
            </p>
            <p className="text-gray-600 text-center mb-12">
              {FOR_PATIENTS.subtitle[lang]}
            </p>
          </FadeInSection>

          {/* AI Call Center Section */}
          <FadeInSection>
            <div className="bg-[#1A2F4A] rounded-2xl p-8 md:p-10 mb-10 relative overflow-hidden">
              {/* Decorative glow */}
              <div className={`absolute -top-10 ${isRtl ? '-right-10' : '-left-10'} w-48 h-48 bg-teal-500/10 rounded-full blur-3xl pointer-events-none`} aria-hidden="true" />

              <div className="relative grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                {/* Text side */}
                <div>
                  <span className="inline-flex items-center gap-2 bg-teal-500/20 text-teal-300 text-xs font-bold px-3 py-1 rounded-full mb-4 border border-teal-500/30">
                    {CALL_CENTER.badge[lang]}
                  </span>
                  <h3 className="text-white font-bold text-2xl md:text-3xl mb-2">{CALL_CENTER.title[lang]}</h3>
                  <p className="text-white/60 text-sm mb-6 max-w-md">{CALL_CENTER.subtitle[lang]}</p>

                  {/* Comparison table */}
                  <div className="bg-white/5 rounded-xl p-4 mb-6 border border-white/10">
                    <p className="text-white/40 text-xs mb-3 font-medium">{CALL_CENTER.comparison.label[lang]}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {CALL_CENTER.comparison.items[lang].map((item, i) => (
                        <div key={i} className="contents">
                          <div className="flex items-center gap-2">
                            <span className="text-red-400 text-xs">✗</span>
                            <span className="text-white/50 text-xs line-through">{item.old}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-teal-400 text-xs">✓</span>
                            <span className="text-teal-300 text-xs font-semibold">{item.nu}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <a href={`tel:${CALL_CENTER.phone}`} className="block mb-4" dir="ltr">
                    <span className="text-4xl font-black text-white tracking-wider">{CALL_CENTER.phone}</span>
                  </a>

                  <a
                    href={`tel:${CALL_CENTER.phone}`}
                    className="inline-flex items-center gap-3 bg-teal-500 hover:bg-teal-400 text-white font-bold px-6 py-3 rounded-xl transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 text-lg"
                  >
                    {CALL_CENTER.phoneLabel[lang]}
                  </a>
                  <p className="text-white/40 text-xs mt-2">{CALL_CENTER.note[lang]}</p>
                </div>

                {/* Capabilities grid */}
                <div>
                  <div className="grid grid-cols-2 gap-3">
                    {CALL_CENTER.capabilities[lang].map((cap, i) => (
                      <div key={i} className="bg-white/5 rounded-xl p-4 border border-white/10 hover:bg-white/10 transition-colors">
                        <div className="text-2xl mb-2">{cap.icon}</div>
                        <h4 className="text-white font-semibold text-sm mb-1">{cap.title}</h4>
                        <p className="text-white/50 text-xs leading-relaxed">{cap.desc}</p>
                      </div>
                    ))}
                  </div>

                  {/* AI status indicator */}
                  <div className="flex items-center gap-2 mt-4 justify-center">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-teal-500" />
                    </span>
                    <span className="text-teal-400 text-xs font-medium">{CALL_CENTER.statusLine[lang]}</span>
                  </div>
                </div>
              </div>
            </div>
          </FadeInSection>

          {/* Unified 12-feature grid — all 12 on desktop, first 6 on mobile with toggle */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FOR_PATIENTS.features[lang].map((feat, i) => {
              const tagColor = feat.tag === 'الأول في مصر' || feat.tag === 'First in Egypt'
                ? 'bg-red-50 text-red-600'
                : feat.tag === 'AI 24/7'
                  ? 'bg-purple-50 text-purple-700'
                  : feat.tag === 'جديد' || feat.tag === 'New'
                    ? 'bg-amber-50 text-amber-700'
                    : 'bg-teal-50 text-teal-700';
              return (
                <FadeInSection key={i} delay={i * 50}>
                  <div className={`bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-200 flex flex-col gap-2 ${i >= 6 ? 'hidden md:flex' : ''}`}>
                    <div className="flex items-start justify-between">
                      <span className="text-2xl">{feat.icon}</span>
                      {feat.tag && (
                        <span className={`${tagColor} text-xs font-semibold px-2 py-0.5 rounded-full`}>
                          {feat.tag}
                        </span>
                      )}
                    </div>
                    <h3 className="text-gray-900 font-bold text-sm">{feat.title}</h3>
                    <p className="text-gray-500 text-xs leading-relaxed">{feat.desc}</p>
                  </div>
                </FadeInSection>
              );
            })}
          </div>

          {/* Mobile "Show more" for cards 7-12 */}
          <ShowMoreToggle
            showMoreLabel={FOR_PATIENTS.showMore[lang]}
            showLessLabel={FOR_PATIENTS.showLess[lang]}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 md:hidden">
              {FOR_PATIENTS.features[lang].slice(6).map((feat, i) => {
                const tagColor = feat.tag === 'الأول في مصر' || feat.tag === 'First in Egypt'
                  ? 'bg-red-50 text-red-600'
                  : feat.tag === 'AI 24/7'
                    ? 'bg-purple-50 text-purple-700'
                    : feat.tag === 'جديد' || feat.tag === 'New'
                      ? 'bg-amber-50 text-amber-700'
                      : 'bg-teal-50 text-teal-700';
                return (
                  <div key={`more-${i}`} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex flex-col gap-2">
                    <div className="flex items-start justify-between">
                      <span className="text-2xl">{feat.icon}</span>
                      {feat.tag && (
                        <span className={`${tagColor} text-xs font-semibold px-2 py-0.5 rounded-full`}>
                          {feat.tag}
                        </span>
                      )}
                    </div>
                    <h3 className="text-gray-900 font-bold text-sm">{feat.title}</h3>
                    <p className="text-gray-500 text-xs leading-relaxed">{feat.desc}</p>
                  </div>
                );
              })}
            </div>
          </ShowMoreToggle>
        </div>
      </section>

      {/* ═══ 5. FOR DOCTORS ══════════════════════════════════════════════ */}
      <section id="doctors" className="py-20 px-4 bg-[#1A2F4A] border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <FadeInSection>
            <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-2">
              {FOR_DOCTORS.title[lang]}
            </h2>
            <p className="text-white/70 text-center mb-12">
              {FOR_DOCTORS.subtitle[lang]}
            </p>
          </FadeInSection>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-10">
            {FOR_DOCTORS.features[lang].map((feat, i) => (
              <FadeInSection key={i} delay={i * 80}>
                {'highlight' in feat && feat.highlight ? (
                  <div className="bg-red-500/10 rounded-xl p-5 border border-red-500/20 hover:bg-red-500/15 transition-all duration-200">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-2xl">{feat.icon}</span>
                      <span className="bg-red-500/20 text-red-400 text-xs px-1.5 py-0.5 rounded font-bold">
                        {lang === 'ar' ? 'جديد' : 'New'}
                      </span>
                    </div>
                    <h4 className="font-bold text-white mt-2 mb-1">{feat.title}</h4>
                    <p className="text-white/60 text-sm">{feat.desc}</p>
                  </div>
                ) : 'clinic' in feat && feat.clinic ? (
                  <div className="bg-indigo-500/10 rounded-xl p-5 border border-indigo-500/20 hover:bg-indigo-500/15 transition-all duration-200">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-2xl">{feat.icon}</span>
                      <span className="bg-indigo-500/20 text-indigo-300 text-xs font-bold px-2 py-0.5 rounded-full border border-indigo-500/30">
                        {lang === 'ar' ? 'لأصحاب العيادات' : 'For clinic owners'}
                      </span>
                    </div>
                    <h4 className="font-bold text-white mt-2 mb-1">{feat.title}</h4>
                    <p className="text-white/60 text-sm">{feat.desc}</p>
                  </div>
                ) : (
                  <div className="bg-white/10 rounded-xl p-5 border border-white/10 hover:bg-white/15 transition-all duration-200">
                    <span className="text-2xl">{feat.icon}</span>
                    <h4 className="font-bold text-white mt-3 mb-1">{feat.title}</h4>
                    <p className="text-white/60 text-sm">{feat.desc}</p>
                  </div>
                )}
              </FadeInSection>
            ))}
          </div>

          {/* Clinic Owner Banner */}
          <div className="mt-10 mx-auto max-w-4xl">
            <div className="relative overflow-hidden bg-gradient-to-br from-indigo-900 to-[#1A2F4A] rounded-2xl p-6 md:p-8 border border-indigo-500/20">
              <div className={`absolute -top-8 ${isRtl ? '-left-8' : '-right-8'} w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none`} aria-hidden="true" />

              <div className="relative flex flex-col md:flex-row md:items-start gap-6">
                <div className="flex-1">
                  <span className="inline-flex items-center gap-1.5 bg-indigo-500/20 text-indigo-300 text-xs font-bold px-3 py-1 rounded-full border border-indigo-500/30 mb-3">
                    {lang === 'ar' ? '🏥 أنت صاحب عيادة؟' : '🏥 Do you own a clinic?'}
                  </span>
                  <h3 className="text-white font-bold text-lg md:text-xl mb-4">
                    {lang === 'ar' ? 'نظام إدارة عيادة كامل — مجاناً مع التسجيل' : 'Complete clinic management system — free with registration'}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {(lang === 'ar' ? [
                      { icon: '👥', text: 'قائمة انتظار لحظية للاستقبال' },
                      { icon: '📅', text: 'حجوزات أونلاين + زيارات بدون موعد' },
                      { icon: '💰', text: 'فواتير وتقارير مالية يومية وشهرية' },
                      { icon: '📊', text: 'تحليلات الأداء — مرضى، أطباء، إيرادات' },
                      { icon: '🏢', text: 'دعم السلاسل متعددة الفروع' },
                      { icon: '💳', text: 'دفع أونلاين — فوري وباي موب وفودافون كاش' },
                    ] : [
                      { icon: '👥', text: 'Real-time reception queue' },
                      { icon: '📅', text: 'Online bookings + walk-in appointments' },
                      { icon: '💰', text: 'Invoices and daily/monthly financial reports' },
                      { icon: '📊', text: 'Performance analytics — patients, doctors, revenue' },
                      { icon: '🏢', text: 'Multi-branch chain support' },
                      { icon: '💳', text: 'Online payment — Fawry, Paymob, Vodafone Cash' },
                    ]).map((f, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-base" aria-hidden="true">{f.icon}</span>
                        <span className="text-white/70 text-sm">{f.text}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col items-center md:items-end gap-3 shrink-0 md:pt-2">
                  <Link
                    href={`/${lang}/register/provider`}
                    className="inline-flex items-center gap-2 bg-indigo-500 hover:bg-indigo-400 text-white font-bold px-6 py-3 rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-indigo-500/25 hover:-translate-y-0.5 whitespace-nowrap"
                  >
                    {lang === 'ar' ? '🏥 سجّل عيادتك الآن' : '🏥 Register your clinic now'}
                  </Link>
                  <p className={`text-white/30 text-xs ${isRtl ? 'text-center md:text-right' : 'text-center md:text-left'}`}>
                    {lang === 'ar' ? 'يعمل مع العيادات الفردية والسلاسل متعددة الفروع' : 'Works for solo clinics and multi-branch chains'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center mt-10">
            <Link
              href={`/${lang}/doctor/register`}
              className="inline-block bg-teal-500 hover:bg-teal-400 text-white font-bold px-8 py-4 rounded-xl transition-all duration-200 shadow-md hover:shadow-lg hover:-translate-y-0.5"
            >
              {FOR_DOCTORS.cta[lang]}
            </Link>
          </div>
        </div>
      </section>

      {/* ═══ 6. FOR PROVIDERS ════════════════════════════════════════════ */}
      <section id="providers" className="py-20 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <FadeInSection>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 text-center mb-2">
              {FOR_PROVIDERS.title[lang]}
            </h2>
            <p className="text-gray-600 text-center mb-14">
              {FOR_PROVIDERS.subtitle[lang]}
            </p>
          </FadeInSection>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
            {FOR_PROVIDERS.cards[lang].map((card, i) => (
              <FadeInSection key={i} delay={i * 80}>
                <div className={`bg-white rounded-xl p-5 shadow-sm border-t-4 ${COLOR_MAP[card.color]} border border-gray-100`}>
                  <h4 className="font-bold text-gray-900 text-lg mb-3">{card.title}</h4>
                  <ul className="space-y-2">
                    {card.features.map((f, j) => (
                      <li key={j} className="text-gray-600 text-sm flex items-start gap-2">
                        <span className="text-teal-600 mt-0.5">✓</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              </FadeInSection>
            ))}
          </div>

          {/* Widget Showcase */}
          <FadeInSection>
            <div className="mt-14 bg-[#1A2F4A] rounded-2xl p-8 md:p-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                {/* Text side */}
                <div>
                  <h3 className="text-2xl font-bold text-white mb-3">{WIDGET_SHOWCASE.title[lang]}</h3>
                  <p className="text-white/70 text-sm mb-6">{WIDGET_SHOWCASE.subtitle[lang]}</p>
                  <ul className="space-y-2 mb-6">
                    {WIDGET_SHOWCASE.features[lang].map((f, i) => (
                      <li key={i} className="text-white/80 text-sm flex items-start gap-2">
                        <span className="text-teal-400 mt-0.5">✓</span> {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="#"
                    className="inline-block bg-teal-600 hover:bg-teal-700 text-white font-bold px-6 py-3 rounded-xl transition-colors"
                  >
                    {WIDGET_SHOWCASE.cta[lang]}
                  </Link>
                  <p className="text-white/40 text-xs mt-2">{WIDGET_SHOWCASE.ctaNote[lang]}</p>
                </div>

                {/* Code side */}
                <div>
                  <p className="text-white/50 text-xs mb-2">{WIDGET_SHOWCASE.codeLabel[lang]}</p>
                  <div className="relative bg-black/50 rounded-xl p-4 border border-white/10">
                    <CopyCodeButton code={WIDGET_SHOWCASE.code} label={WIDGET_SHOWCASE.copyLabel[lang]} />
                    <pre dir="ltr" className="text-sm font-mono text-white/90 overflow-x-auto whitespace-pre">
                      <span className="text-teal-400">{'<script'}</span>{'\n'}
                      {'  '}src=<span className="text-amber-400">{'"https://doctortrio.online/widget.js"'}</span>{'\n'}
                      {'  '}data-tenant=<span className="text-amber-400">{'"HOSPITAL_ID"'}</span>{'\n'}
                      <span className="text-teal-400">{'></script>'}</span>
                    </pre>
                  </div>

                  {/* Widget preview mockup */}
                  <div className="mt-4 bg-gray-100 rounded-xl overflow-hidden border border-gray-300">
                    <div className="bg-gray-200 px-3 py-2 flex items-center gap-2">
                      <div className="flex gap-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
                        <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                        <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
                      </div>
                      <div className="flex-1 bg-white rounded text-xs text-gray-500 px-2 py-0.5 text-center" dir="ltr">
                        {lang === 'ar' ? 'مستشفاك.com' : 'your-hospital.com'}
                      </div>
                    </div>
                    <div className="relative bg-white p-4 h-28">
                      <div className="h-3 w-3/4 bg-gray-200 rounded mb-2" />
                      <div className="h-2 w-1/2 bg-gray-200 rounded mb-1.5" />
                      <div className="h-2 w-2/3 bg-gray-200 rounded mb-1.5" />
                      <div className="h-2 w-1/3 bg-gray-200 rounded" />
                      <div className="absolute bottom-3 end-3 bg-teal-600 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg">
                        🏥 {lang === 'ar' ? 'دكتور تريو' : 'DoctorTrio'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </FadeInSection>
        </div>
      </section>

      {/* ═══ 7b. DEDICATED ICU SECTION ═══════════════════════════════════ */}
      <section className="py-16 px-4 md:px-8 bg-[#0F1F30]">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-start">
            {/* Left column: text content */}
            <div>
              <span className="inline-flex items-center gap-2 bg-red-500/20 text-red-400 text-xs font-bold px-3 py-1 rounded-full mb-4 border border-red-500/30">
                {ICU_SECTION[lang].badge}
              </span>
              <h2 className="text-white font-bold text-2xl md:text-3xl mb-3">
                {ICU_SECTION[lang].title}
              </h2>
              <p className="text-white/70 text-sm mb-4 max-w-lg">
                {ICU_SECTION[lang].subtitle}
              </p>

              {/* Problem statement */}
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6">
                <p className="text-red-300 text-sm leading-relaxed">
                  {ICU_SECTION[lang].problem}
                </p>
              </div>

              {/* 4 feature items */}
              <div className="space-y-3 mb-8">
                {ICU_SECTION[lang].features.map((feat, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="text-xl mt-0.5">{feat.icon}</span>
                    <div>
                      <h4 className="text-white font-semibold text-sm">{feat.title}</h4>
                      <p className="text-white/50 text-xs mt-0.5">{feat.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <Link
                href={`/${lang}/icu`}
                className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-bold px-6 py-3 rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-red-500/25"
              >
                🚨 {ICU_SECTION[lang].cta}
              </Link>
              <p className="text-white/30 text-xs mt-2">
                {ICU_SECTION[lang].ctaNote}
              </p>

              {/* For hospitals link */}
              <div className="mt-4 flex items-center gap-2">
                <span className="text-white/40 text-xs">
                  {ICU_SECTION[lang].forHospitals}
                </span>
                <a href="#providers" className="text-teal-400 text-xs hover:text-teal-300 underline underline-offset-2">
                  {ICU_SECTION[lang].forHospitalsLink}
                </a>
              </div>
            </div>

            {/* Right column: simulated live ICU display */}
            <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold text-sm">
                  {ICU_SECTION[lang].liveDisplay.label}
                </h3>
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                  </span>
                  <span className="text-green-400 text-xs">{ICU_SECTION[lang].liveDisplay.live}</span>
                </div>
              </div>

              <div className="space-y-2">
                {ICU_SECTION[lang].liveDisplay.hospitals.map((hospital, i) => (
                  <div
                    key={i}
                    className={`bg-white/5 rounded-xl p-4 border border-white/10 ${hospital.status === 'full' ? 'opacity-60' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`${hospital.status === 'full' ? 'text-white/60' : 'text-white'} font-semibold text-sm`}>
                        {hospital.name}
                      </span>
                      {hospital.status === 'available' ? (
                        <span className="bg-green-500/20 text-green-400 text-xs font-bold px-2 py-0.5 rounded-full">
                          {hospital.beds} {ICU_SECTION[lang].liveDisplay.bedLabel}
                        </span>
                      ) : (
                        <span className="bg-red-500/20 text-red-400 text-xs font-bold px-2 py-0.5 rounded-full">
                          {ICU_SECTION[lang].liveDisplay.fullLabel}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={`${hospital.status === 'full' ? 'text-white/30' : 'text-white/40'} text-xs`}>
                        {hospital.unit} · {hospital.distance}
                      </span>
                      {hospital.status === 'available' && (
                        <span className="text-white/30 text-xs">
                          {ICU_SECTION[lang].liveDisplay.lastUpdate}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-white/20 text-xs text-center mt-3 italic">
                {ICU_SECTION[lang].liveDisplay.disclaimer}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ 8. TRUST & TECHNOLOGY ═══════════════════════════════════════ */}
      <section className="py-16 px-4 bg-slate-50">
        <div className="max-w-4xl mx-auto">
          <FadeInSection>
            <h2 className="text-3xl font-bold text-gray-900 text-center mb-10">
              {TRUST.title[lang]}
            </h2>
          </FadeInSection>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
            {TRUST.stats[lang].map((stat, i) => (
              <FadeInSection key={i} delay={i * 80}>
                <div className="text-center p-4 bg-white rounded-xl shadow-sm">
                  <div className="text-3xl mb-2">{stat.icon}</div>
                  <div className="text-3xl font-bold text-teal-600">{stat.value}</div>
                  <div className="text-gray-600 text-sm mt-1">{stat.label}</div>
                </div>
              </FadeInSection>
            ))}
          </div>

          <p className="text-center text-gray-500 text-sm flex items-center justify-center gap-2">
            🔒 {TRUST.security[lang]}
          </p>
        </div>
      </section>

      {/* ═══ PATIENT JOURNEY ════════════════════════════════════════════ */}
      <section className="py-20 px-4 bg-teal-600">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-white text-center mb-2">
            {JOURNEY.title[lang]}
          </h2>
          <p className="text-white/70 text-sm text-center mb-10">
            {JOURNEY.subtitle[lang]}
          </p>

          {/* Desktop: horizontal with connecting line */}
          <div className="hidden md:block">
            <div className="relative flex items-start justify-between">
              <div className="absolute top-7 left-0 right-0 h-0.5 bg-white/20" aria-hidden="true" />
              {JOURNEY.steps[lang].map((step, i) => (
                <div key={i} className="relative z-10 text-center flex-1">
                  <div className="w-14 h-14 rounded-full bg-teal-700 border-2 border-white/40 flex items-center justify-center text-2xl mx-auto mb-3">
                    {step.icon}
                  </div>
                  <p className="text-white/50 text-xs font-medium mb-1">
                    {lang === 'ar' ? `الخطوة ${step.num}` : `Step ${step.num}`}
                  </p>
                  <p className="text-white font-semibold text-sm max-w-[90px] mx-auto leading-tight">
                    {step.label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Mobile: 4x2 grid */}
          <div className="md:hidden grid grid-cols-4 gap-4">
            {JOURNEY.steps[lang].map((step, i) => (
              <div key={i} className="text-center">
                <div className="w-12 h-12 rounded-full bg-teal-700 border-2 border-white/30 flex items-center justify-center text-xl mx-auto mb-2">
                  {step.icon}
                </div>
                <p className="text-white/50 text-[9px]">{step.num}</p>
                <p className="text-white text-[10px] font-medium leading-tight">{step.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 9. SPLIT CTA ════════════════════════════════════════════════ */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-10">
            {CTA.title[lang]}
          </h2>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href={`/${lang}/chat`}
              className="bg-teal-600 hover:bg-teal-700 text-white font-bold text-lg px-8 py-4 rounded-xl transition-all shadow-lg hover:shadow-xl w-full sm:w-auto"
            >
              {CTA.patient[lang]}
            </Link>
            <Link
              href={`/${lang}/doctor/register`}
              className="bg-indigo-700 hover:bg-indigo-800 text-white font-bold px-6 py-4 rounded-xl transition-all w-full sm:w-auto"
            >
              {CTA.doctor[lang]}
            </Link>
            <Link
              href="#providers"
              className="border-2 border-gray-800 text-gray-800 hover:bg-gray-800 hover:text-white font-bold px-6 py-3.5 rounded-xl transition-all w-full sm:w-auto"
            >
              {CTA.provider[lang]}
            </Link>
          </div>

          <div className="mt-6 flex items-center justify-center gap-2 text-gray-400 text-sm">
            <span>{lang === 'ar' ? 'أو اتصل بنا' : 'Or call us'}</span>
            <a href="tel:19009" className="text-teal-600 font-bold text-lg hover:text-teal-500 transition-colors" dir="ltr">
              19009
            </a>
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
