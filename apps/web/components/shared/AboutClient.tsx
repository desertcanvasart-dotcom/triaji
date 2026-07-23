'use client';

import { type Lang } from '@triaji/shared/i18n';
import Link from 'next/link';
import SiteNavbar from './SiteNavbar';
import SiteFooter from './SiteFooter';

const ABOUT: Record<Lang, {
  badge: string;
  title: string;
  subtitle: string;
  missionTitle: string;
  mission: string;
  storyTitle: string;
  storyIntro: string;
  storyPoints: { number: string; icon: string; title: string; body: string }[];
  storyClosing: string;
  valuesTitle: string;
  values: { icon: string; title: string; description: string }[];
  techTitle: string;
  techSubtitle: string;
  tech: { name: string; role: string }[];
  disclaimerTitle: string;
  disclaimer: string;
  teamTitle: string;
  team: string;
  nav: { home: string; about: string };
  footer: { emergency: string; copyright: string };
}> = {
  ar: {
    badge: '\u0642\u0635\u062a\u0646\u0627',
    title: '\u0623\u0637\u0628\u0627\u0621 \u062c\u0645\u0639\u062a\u0647\u0645 \u0631\u0633\u0627\u0644\u0629 \u0648\u0627\u062d\u062f\u0629',
    subtitle: '\u062a\u0631\u064a\u062c\u064a \u0648\u064f\u0644\u062f \u0645\u0646 \u062f\u0627\u062e\u0644 \u0639\u064a\u0627\u062f\u0627\u062a \u0645\u0635\u0631 \u2014 \u0645\u0646 \u0623\u0637\u0628\u0627\u0621 \u0639\u0627\u0634\u0648\u0627 \u0627\u0644\u0645\u0634\u0643\u0644\u0629 \u0648\u0642\u0631\u0631\u0648\u0627 \u064a\u062d\u0644\u0648\u0647\u0627',
    missionTitle: '\u0631\u0633\u0627\u0644\u062a\u0646\u0627',
    mission: 'تتمثل رسالتنا في تغيير جذري لطريقة تفاعل المرضى والممارسين الصحيين، من خلال تسخير التكنولوجيا المتقدمة لتقليل أوقات الانتظار، وتعزيز كفاءة الطواقم الطبية، وتقديم رعاية صحية سلسة وفورية. نحن هنا لجعل الرعاية الصحية أكثر إنسانية وسرعة مع ضمان الدقة و الجودة في كل مراحل الرحلة العلاجية، حيث يتم منح الأولوية لرفاهية المريض واحتياجاته من خلال حلول ذكية ومبتكرة.',
    storyTitle: '\u0643\u064a\u0641 \u0628\u062f\u0623\u062a \u0627\u0644\u0642\u0635\u0629',
    storyIntro: 'لقد كانت الشرارة الأولى لفكرتنا نابعة من معايشة شخصية لأحد أهم التحديات التي تواجه المرضى يومياً.',
    storyPoints: [
      { number: '\u0661', icon: '\u{1FA91}', title: 'تجربة الانتظار الطويل', body: 'بدأ كل شيء من غرفة انتظار مزدحمة، حيث كان الإحباط سيد الموقف بسبب طوابير الانتظار الطويلة وعدم وضوح الرؤية بشأن وقت الدخول للطبيب. هذه التجربة أبرزت الحاجة الماسة لنظام يُقلّل هذا العبء النفسي والزمني على المرضى — نظام يُعيد للمريض شعوره بالكرامة والاحترام وهو ينتظر رعايته الصحية.' },
      { number: '\u0662', icon: '\u{1F91D}', title: 'الرغبة المشتركة في التغيير', body: 'تلاقت هذه الفكرة مع شغف مجموعة من الأطباء والخبراء المهتمين بتحسين جودة الرعاية الصحية. اجتمعوا لمناقشة كيفية توظيف التكنولوجيا في إيجاد حلول لهذه التحديات، وكان الهدف واضحاً: ابتكار نظام يُسهّل على الفريق الطبي إدارة المواعيد بشكل أكثر كفاءة، ويضمن للمريض رحلة علاجية أسرع وأكثر سلاسة — حيث يصل كل مريض إلى الطبيب المناسب بأقصر الطرق وأوفرها.' },
      { number: '\u0663', icon: '\u{1F4A1}', title: 'ولادة الحل الذكي — دكتور تريو', body: 'من رحم هذه النقاشات والرؤى المشتركة، وُلدت فكرة "دكتور تريو". إنها ليست مجرد تطبيق، بل هي حل متكامل لإعادة تنظيم تجربة الرعاية الصحية. من خلال توفير خدمة فرز الحالات عن بعد، يستطيع المريض التواصل مع الأطباء عبر الدردشة الفورية، والحصول على التوجيه الطبي الصحيح — مما يُلغي الحاجة للانتظار الطويل ويضمن حصول كل حالة على الاهتمام الذي تستحقه فوراً.' },
    ],
    storyClosing: 'دكتور تريو هو الناتج من سنوات من العمل الطبي، والتكنولوجيا المتقدمة، والإيمان العميق بأن الرعاية الصحية في مصر ممكن تبقى أحسن بكتير.',
    valuesTitle: '\u0642\u064a\u0645\u0646\u0627',
    values: [
      { icon: '\u{1F468}\u200D\u2695\uFE0F', title: 'الطبيب أولاً و دائماً', description: 'نحن نساعدك في العثور على الطبيب المناسب، من خلال تزويدك بـ أدق وأشمل المعلومات المتاحة عن الأطباء، وتزويد الطبيب بـ تفاصيل طبية دقيقة عن حالتك.' },
      { icon: '\u{1F512}', title: '\u0627\u0644\u062e\u0635\u0648\u0635\u064a\u0629 \u062e\u0637 \u0623\u062d\u0645\u0631', description: '\u0628\u064a\u0627\u0646\u0627\u062a \u0627\u0644\u0645\u0631\u064a\u0636 \u0645\u0644\u0643\u0647. \u0628\u0646\u062d\u0645\u064a\u0647\u0627 \u0628\u0623\u0639\u0644\u0649 \u0645\u0639\u0627\u064a\u064a\u0631 \u0627\u0644\u062a\u0634\u0641\u064a\u0631 \u0648\u0644\u0627 \u0646\u0634\u0627\u0631\u0643\u0647\u0627 \u0625\u0644\u0627 \u0628\u0625\u0630\u0646 \u0635\u0631\u064a\u062d \u0645\u0646 \u0627\u0644\u0645\u0631\u064a\u0636.' },
      { icon: '\u26A1', title: 'السرعة تساعد كثيراً في إنقاذ الأرواح', description: 'كل دقيقة تأخير في الرعاية الصحية لها ثمن. لذا قمنا ببناء دكتور تريو على السرعة والكفاءة.' },
      { icon: '\u{1F30D}', title: '\u0644\u0643\u0644 \u0627\u0644\u0645\u0635\u0631\u064a\u064a\u0646', description: 'من الإسكندرية لأسوان، من المدينة للريف — دكتور تريو في كل محافظات مصر الـ27.' },
      { icon: '\u{1F9E0}', title: '\u0627\u0644\u062a\u0643\u0646\u0648\u0644\u0648\u062c\u064a\u0627 \u0641\u064a \u062e\u062f\u0645\u0629 \u0627\u0644\u0637\u0628', description: 'نستخدم أحدث تقنيات الذكاء الاصطناعي ولكن ليس للإبهار — بل لتقديم خدمة صحية استثنائية يستحقها المواطن المصري.' },
      { icon: '\u{1F91D}', title: '\u0634\u0631\u0627\u0643\u0629 \u062d\u0642\u064a\u0642\u064a\u0629 \u0645\u0639 \u0627\u0644\u0623\u0637\u0628\u0627\u0621', description: '\u062a\u0631\u064a\u062c\u064a \u0627\u062a\u0628\u0646\u0649 \u0628\u0627\u0644\u062a\u0639\u0627\u0648\u0646 \u0645\u0639 \u0627\u0644\u0623\u0637\u0628\u0627\u0621 \u0648\u0644\u064a\u0633 \u0636\u062f\u0647\u0645. \u0643\u0644 \u0645\u064a\u0632\u0629 \u0641\u064a \u0627\u0644\u0645\u0646\u0635\u0629 \u0645\u0635\u0645\u0645\u0629 \u062a\u0632\u064a\u062f \u0645\u0646 \u0643\u0641\u0627\u0621\u0629 \u0627\u0644\u0637\u0628\u064a\u0628.' },
    ],
    techTitle: '\u0627\u0644\u062a\u0643\u0646\u0648\u0644\u0648\u062c\u064a\u0627 \u0627\u0644\u0644\u064a \u0628\u0646\u0633\u062a\u062e\u062f\u0645\u0647\u0627',
    techSubtitle: '\u0628\u0646\u062c\u0645\u0639 \u0623\u062d\u062f\u062b \u0627\u0644\u062a\u0642\u0646\u064a\u0627\u062a \u0627\u0644\u0639\u0627\u0644\u0645\u064a\u0629 \u0641\u064a \u062e\u062f\u0645\u0629 \u0627\u0644\u0645\u0631\u064a\u0636 \u0627\u0644\u0645\u0635\u0631\u064a',
    tech: [
      { name: 'Claude AI', role: '\u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064a \u0644\u0644\u0641\u0631\u0632 \u0627\u0644\u0637\u0628\u064a \u0648\u0627\u0644\u062a\u062d\u0644\u064a\u0644' },
      { name: 'LiveKit', role: '\u0645\u0643\u0627\u0644\u0645\u0627\u062a \u0641\u064a\u062f\u064a\u0648 \u0637\u0628\u064a\u0629 \u0639\u0627\u0644\u064a\u0629 \u0627\u0644\u062c\u0648\u062f\u0629' },
      { name: 'Supabase', role: '\u0642\u0627\u0639\u062f\u0629 \u0628\u064a\u0627\u0646\u0627\u062a \u0622\u0645\u0646\u0629 \u0648\u0645\u0634\u0641\u0651\u0631\u0629 \u0628\u0627\u0644\u0643\u0627\u0645\u0644' },
      { name: 'Deepgram', role: '\u062a\u062d\u0648\u064a\u0644 \u0627\u0644\u0643\u0644\u0627\u0645 \u0644\u0646\u0635 \u0628\u0627\u0644\u0639\u0631\u0628\u064a\u0629 \u0627\u0644\u0645\u0635\u0631\u064a\u0629' },
      { name: 'PostGIS', role: '\u0628\u062d\u062b \u062c\u063a\u0631\u0627\u0641\u064a \u062f\u0642\u064a\u0642 \u0644\u0623\u0642\u0631\u0628 \u0645\u0632\u0648\u062f\u064a \u0627\u0644\u062e\u062f\u0645\u0629' },
    ],
    disclaimerTitle: '\u062a\u0631\u064a\u062c\u064a \u0644\u064a\u0633 \u0628\u062f\u064a\u0644\u0627\u064b \u0639\u0646 \u0627\u0644\u0637\u0628\u064a\u0628',
    disclaimer: '\u0646\u0624\u0643\u062f \u0628\u0648\u0636\u0648\u062d: \u062a\u0631\u064a\u062c\u064a \u0645\u0646\u0635\u0629 \u062a\u0646\u0638\u064a\u0645\u064a\u0629 \u0648\u0644\u064a\u0633\u062a \u0637\u0628\u064a\u0629. \u0646\u062d\u0646 \u0644\u0627 \u0646\u0634\u062e\u0651\u0635 \u0627\u0644\u0623\u0645\u0631\u0627\u0636\u060c \u0648\u0644\u0627 \u0646\u0635\u0641 \u0627\u0644\u0623\u062f\u0648\u064a\u0629\u060c \u0648\u0644\u0627 \u0646\u0642\u062f\u0645 \u0622\u0631\u0627\u0621 \u0637\u0628\u064a\u0629. \u062f\u0648\u0631\u0646\u0627 \u0627\u0644\u0648\u062d\u064a\u062f \u0647\u0648 \u0645\u0633\u0627\u0639\u062f\u0629 \u0627\u0644\u0645\u0631\u064a\u0636 \u0639\u0644\u0649 \u0627\u0644\u0648\u0635\u0648\u0644 \u0644\u0644\u0637\u0628\u064a\u0628 \u0627\u0644\u0645\u0646\u0627\u0633\u0628 \u0628\u0623\u0633\u0631\u0639 \u0648\u0642\u062a \u0648\u0628\u0623\u0643\u0628\u0631 \u0642\u062f\u0631 \u0645\u0646 \u0627\u0644\u0645\u0639\u0644\u0648\u0645\u0627\u062a \u2014 \u0648\u0627\u0644\u0642\u0631\u0627\u0631 \u0627\u0644\u0637\u0628\u064a \u064a\u0638\u0644 \u062f\u0627\u0626\u0645\u0627\u064b \u0641\u064a \u064a\u062f \u0627\u0644\u0637\u0628\u064a\u0628 \u0627\u0644\u0645\u0631\u062e\u0635.',
    teamTitle: '\u0641\u0631\u064a\u0642\u0646\u0627',
    team: '\u062a\u0631\u064a\u062c\u064a \u0628\u064f\u0646\u064a \u0628\u0648\u0627\u0633\u0637\u0629 \u0641\u0631\u064a\u0642 \u0645\u0646 \u0627\u0644\u0623\u0637\u0628\u0627\u0621 \u0648\u0627\u0644\u0645\u0647\u0646\u062f\u0633\u064a\u0646 \u0648\u0627\u0644\u0645\u062a\u062e\u0635\u0635\u064a\u0646 \u0641\u064a \u0627\u0644\u0631\u0639\u0627\u064a\u0629 \u0627\u0644\u0635\u062d\u064a\u0629 \u2014 \u062c\u0645\u0639\u0647\u0645 \u0647\u062f\u0641 \u0648\u0627\u062d\u062f: \u062a\u062d\u0633\u064a\u0646 \u062a\u062c\u0631\u0628\u0629 \u0627\u0644\u0631\u0639\u0627\u064a\u0629 \u0627\u0644\u0635\u062d\u064a\u0629 \u0641\u064a \u0645\u0635\u0631. \u0627\u0644\u0641\u0631\u064a\u0642 \u064a\u062c\u0645\u0639 \u0628\u064a\u0646 \u062e\u0628\u0631\u0629 \u0637\u0628\u064a\u0629 \u0639\u0645\u064a\u0642\u0629 \u0641\u064a \u0627\u0644\u062a\u0634\u062e\u064a\u0635 \u0648\u0627\u0644\u0639\u0644\u0627\u062c\u060c \u0648\u062e\u0628\u0631\u0629 \u062a\u0642\u0646\u064a\u0629 \u0645\u062a\u0642\u062f\u0645\u0629 \u0641\u064a \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064a \u0648\u0623\u0645\u0646 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a.',
    nav: { home: '\u0627\u0644\u0631\u0626\u064a\u0633\u064a\u0629', about: '\u0645\u0646 \u0646\u062d\u0646' },
    footer: { emergency: '\u26A0\uFE0F \u062f\u0643\u062a\u0648\u0631 \u062a\u0631\u064a\u0648 \u0644\u064a\u0633 \u0628\u062f\u064a\u0644\u0627\u064b \u0639\u0646 \u0627\u0644\u0637\u0648\u0627\u0631\u0626 \u2014 \u0641\u064a \u062d\u0627\u0644\u0627\u062a \u0627\u0644\u0637\u0648\u0627\u0631\u0626 \u0627\u062a\u0635\u0644 \u0628\u0640 123', copyright: '\u00A9 2026 \u062f\u0643\u062a\u0648\u0631 \u062a\u0631\u064a\u0648. \u062c\u0645\u064a\u0639 \u0627\u0644\u062d\u0642\u0648\u0642 \u0645\u062d\u0641\u0648\u0638\u0629.' },
  },
  en: {
    badge: 'Our Story',
    title: 'Doctors united by a single mission',
    subtitle: 'DoctorTrio was born inside Egyptian clinics \u2014 by doctors who lived the problem and decided to solve it',
    missionTitle: 'Our Mission',
    mission: 'We believe every Egyptian patient deserves smart, fast, and reliable healthcare \u2014 regardless of where they are or their circumstances. DoctorTrio is not a replacement for doctors \u2014 it is the bridge that connects patients to the right doctor as quickly as possible with the best available information.',
    storyTitle: 'How the Story Began',
    storyIntro: 'The spark behind our idea came from a personal experience with one of the most important challenges patients face every day.',
    storyPoints: [
      { number: '1', icon: '\u{1FA91}', title: 'The long waiting room experience', body: 'Everything started in a crowded waiting room, where frustration was the defining feeling \u2014 long queues with no clarity on when you would actually see the doctor. This experience made the need painfully obvious: a system that reduces this psychological and time burden on patients, one that restores the patient\'s sense of dignity and respect while they wait for their healthcare.' },
      { number: '2', icon: '\u{1F91D}', title: 'A shared desire to change things', body: 'This idea found resonance with a group of doctors and specialists passionate about improving the quality of healthcare. They came together to discuss how technology could solve these challenges. The goal was clear: to build a system that helps medical teams manage appointments more efficiently, and guarantees patients a faster and smoother treatment journey \u2014 where every patient reaches the right doctor by the shortest possible path.' },
      { number: '3', icon: '\u{1F4A1}', title: 'The birth of the smart solution \u2014 DoctorTrio', body: 'From these discussions and shared visions, DoctorTrio was born. It is not merely an application \u2014 it is a comprehensive solution for reorganising the entire healthcare experience. Through remote triage, patients can communicate with doctors via instant chat and receive the right medical guidance immediately. This eliminates the need for long waiting and ensures that every case receives the attention it deserves, right away.' },
    ],
    storyClosing: 'DoctorTrio is the result of years of medical practice, advanced technology, and a deep belief that healthcare in Egypt can be significantly better.',
    valuesTitle: 'Our Values',
    values: [
      { icon: '\u{1F468}\u200D\u2695\uFE0F', title: 'The doctor comes first \u2014 always', description: 'DoctorTrio does not diagnose or treat. Our role is to connect the patient to the right doctor \u2014 with the best possible information.' },
      { icon: '\u{1F512}', title: 'Privacy is non-negotiable', description: 'Patient data belongs to the patient. We protect it with the highest encryption standards and only share it with the patient\'s explicit consent.' },
      { icon: '\u26A1', title: 'Speed saves lives', description: 'Every minute of delay in healthcare has a cost. We build DoctorTrio with an obsession for speed and efficiency.' },
      { icon: '\u{1F30D}', title: 'For all Egyptians', description: 'From Alexandria to Aswan, from city to countryside \u2014 DoctorTrio operates across all 27 Egyptian governorates.' },
      { icon: '\u{1F9E0}', title: 'Technology in service of medicine', description: 'We use the latest AI technologies not to impress \u2014 but to serve the patient better.' },
      { icon: '\u{1F91D}', title: 'Real partnership with doctors', description: 'DoctorTrio was built with doctors, not against them. Every feature is designed to increase the doctor\'s efficiency.' },
    ],
    techTitle: 'The technology we use',
    techSubtitle: 'We combine the world\'s most advanced technologies in service of the Egyptian patient',
    tech: [
      { name: 'Claude AI', role: 'AI for medical triage and analysis' },
      { name: 'LiveKit', role: 'High-quality medical video calls' },
      { name: 'Supabase', role: 'Fully encrypted secure database' },
      { name: 'Deepgram', role: 'Speech-to-text in Egyptian Arabic' },
      { name: 'PostGIS', role: 'Precise geographic search for nearest providers' },
    ],
    disclaimerTitle: 'DoctorTrio is not a replacement for doctors',
    disclaimer: 'We state clearly: DoctorTrio is an organisational platform, not a medical one. We do not diagnose conditions, prescribe medications, or provide medical opinions. Our sole role is to help patients reach the right doctor as quickly as possible with the most information available \u2014 and medical decisions always remain with the licensed physician.',
    teamTitle: 'Our Team',
    team: 'DoctorTrio was built by a team of doctors, engineers, and healthcare specialists \u2014 united by a single goal: improving the healthcare experience in Egypt. The team combines deep medical expertise in diagnosis and treatment with advanced technical knowledge in artificial intelligence and data security.',
    nav: { home: 'Home', about: 'About Us' },
    footer: { emergency: '\u26A0\uFE0F DoctorTrio is not a substitute for emergency services \u2014 call 123 in emergencies', copyright: '\u00A9 2026 DoctorTrio. All rights reserved.' },
  },
};

/* ---- Graphic 1: Hero Network Pattern ---- */
function HeroNetworkSVG() {
  return (
    <svg
      aria-hidden="true"
      className="absolute inset-0 w-full h-full opacity-[0.25]"
      viewBox="0 0 800 400"
      fill="none"
      preserveAspectRatio="xMidYMid slice"
    >
      {/* Dots */}
      <circle cx="100" cy="80" r="4" fill="#0D7A7A" />
      <circle cx="200" cy="160" r="3" fill="#0D7A7A" />
      <circle cx="320" cy="60" r="5" fill="#0D7A7A" />
      <circle cx="440" cy="200" r="4" fill="#0D7A7A" />
      <circle cx="560" cy="100" r="3" fill="#0D7A7A" />
      <circle cx="680" cy="180" r="5" fill="#0D7A7A" />
      <circle cx="150" cy="300" r="4" fill="#0D7A7A" />
      <circle cx="350" cy="320" r="3" fill="#0D7A7A" />
      <circle cx="500" cy="280" r="4" fill="#0D7A7A" />
      <circle cx="650" cy="340" r="3" fill="#0D7A7A" />
      <circle cx="250" cy="240" r="3" fill="#0D7A7A" />
      <circle cx="720" cy="60" r="4" fill="#0D7A7A" />
      <circle cx="80" cy="200" r="3" fill="#0D7A7A" />
      <circle cx="600" cy="320" r="4" fill="#0D7A7A" />
      <circle cx="400" cy="120" r="3" fill="#0D7A7A" />
      {/* Lines */}
      <line x1="100" y1="80" x2="200" y2="160" stroke="#0D7A7A" strokeWidth="1" />
      <line x1="200" y1="160" x2="320" y2="60" stroke="#0D7A7A" strokeWidth="1" />
      <line x1="320" y1="60" x2="440" y2="200" stroke="#0D7A7A" strokeWidth="1" />
      <line x1="440" y1="200" x2="560" y2="100" stroke="#0D7A7A" strokeWidth="1" />
      <line x1="560" y1="100" x2="680" y2="180" stroke="#0D7A7A" strokeWidth="1" />
      <line x1="100" y1="80" x2="250" y2="240" stroke="#0D7A7A" strokeWidth="0.5" />
      <line x1="250" y1="240" x2="440" y2="200" stroke="#0D7A7A" strokeWidth="0.5" />
      <line x1="150" y1="300" x2="350" y2="320" stroke="#0D7A7A" strokeWidth="1" />
      <line x1="350" y1="320" x2="500" y2="280" stroke="#0D7A7A" strokeWidth="1" />
      <line x1="500" y1="280" x2="650" y2="340" stroke="#0D7A7A" strokeWidth="1" />
      <line x1="200" y1="160" x2="150" y2="300" stroke="#0D7A7A" strokeWidth="0.5" />
      <line x1="680" y1="180" x2="650" y2="340" stroke="#0D7A7A" strokeWidth="0.5" />
      <line x1="320" y1="60" x2="400" y2="120" stroke="#0D7A7A" strokeWidth="0.5" />
      <line x1="400" y1="120" x2="560" y2="100" stroke="#0D7A7A" strokeWidth="0.5" />
      <line x1="80" y1="200" x2="150" y2="300" stroke="#0D7A7A" strokeWidth="0.5" />
      <line x1="600" y1="320" x2="650" y2="340" stroke="#0D7A7A" strokeWidth="0.5" />
      <line x1="560" y1="100" x2="720" y2="60" stroke="#0D7A7A" strokeWidth="0.5" />
      <line x1="720" y1="60" x2="680" y2="180" stroke="#0D7A7A" strokeWidth="0.5" />
    </svg>
  );
}

/* ---- Graphic 3: Value SVG Icons ---- */
function StethoscopeHeartIcon() {
  return (
    <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center mb-4">
      <svg aria-hidden="true" width="32" height="32" viewBox="0 0 32 32" fill="none" className="text-teal-600">
        <path d="M8 6C8 6 4 10 4 14C4 18 8 20 8 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M12 6C12 6 16 10 16 14C16 18 12 20 12 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M8 20V22C8 25.3137 10.6863 28 14 28H18C21.3137 28 24 25.3137 24 22V18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx="24" cy="14" r="4" stroke="currentColor" strokeWidth="2" />
        <path d="M16 9L18 12L20 8L22 11L24 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function ShieldLockIcon() {
  return (
    <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center mb-4">
      <svg aria-hidden="true" width="32" height="32" viewBox="0 0 32 32" fill="none" className="text-teal-600">
        <path d="M16 3L4 8V15C4 22.18 9.12 28.84 16 30C22.88 28.84 28 22.18 28 15V8L16 3Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <rect x="12" y="14" width="8" height="7" rx="1" stroke="currentColor" strokeWidth="2" />
        <path d="M13 14V11C13 9.34315 14.3431 8 16 8C17.6569 8 19 9.34315 19 11V14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx="16" cy="18" r="1" fill="currentColor" />
      </svg>
    </div>
  );
}

function LightningCircleIcon() {
  return (
    <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center mb-4">
      <svg aria-hidden="true" width="32" height="32" viewBox="0 0 32 32" fill="none" className="text-teal-600">
        <circle cx="16" cy="16" r="13" stroke="currentColor" strokeWidth="2" />
        <path d="M17 7L11 18H16L15 25L21 14H16L17 7Z" fill="currentColor" />
      </svg>
    </div>
  );
}

function EgyptMapIcon() {
  return (
    <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center mb-4">
      <svg aria-hidden="true" width="32" height="32" viewBox="0 0 32 32" fill="none" className="text-teal-600">
        <path d="M8 4L6 8L4 10L5 14L4 18L6 22L8 28L12 26L16 28L20 26L24 28L26 24L28 20L27 16L28 12L26 8L24 4L20 6L16 4L12 6L8 4Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <path d="M14 12L16 20L18 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="16" cy="10" r="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10 22L16 24L22 22" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.5" />
      </svg>
    </div>
  );
}

function BrainCircuitIcon() {
  return (
    <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center mb-4">
      <svg aria-hidden="true" width="32" height="32" viewBox="0 0 32 32" fill="none" className="text-teal-600">
        <path d="M16 4C12 4 9 6 8 9C5 10 4 13 4 16C4 19 6 22 9 23C10 26 13 28 16 28C19 28 22 26 23 23C26 22 28 19 28 16C28 13 27 10 24 9C23 6 20 4 16 4Z" stroke="currentColor" strokeWidth="2" />
        <line x1="16" y1="10" x2="16" y2="22" stroke="currentColor" strokeWidth="1.5" />
        <line x1="10" y1="16" x2="22" y2="16" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="16" cy="10" r="2" fill="currentColor" />
        <circle cx="16" cy="22" r="2" fill="currentColor" />
        <circle cx="10" cy="16" r="2" fill="currentColor" />
        <circle cx="22" cy="16" r="2" fill="currentColor" />
        <circle cx="12" cy="12" r="1.5" fill="currentColor" opacity="0.5" />
        <circle cx="20" cy="12" r="1.5" fill="currentColor" opacity="0.5" />
        <circle cx="12" cy="20" r="1.5" fill="currentColor" opacity="0.5" />
        <circle cx="20" cy="20" r="1.5" fill="currentColor" opacity="0.5" />
      </svg>
    </div>
  );
}

function HandshakeIcon() {
  return (
    <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center mb-4">
      <svg aria-hidden="true" width="32" height="32" viewBox="0 0 32 32" fill="none" className="text-teal-600">
        <path d="M4 14L10 8L14 10L18 8L22 10L28 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4 14L8 18L12 16L16 20L20 16L24 18L28 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 16L16 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M20 16L16 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M8 18V24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M24 18V24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  );
}

const VALUE_ICONS = [
  StethoscopeHeartIcon,
  ShieldLockIcon,
  LightningCircleIcon,
  EgyptMapIcon,
  BrainCircuitIcon,
  HandshakeIcon,
];

/* ---- Graphic 4: Technology Architecture Diagram ---- */
function TechArchDiagram({ isRtl }: { isRtl: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={`w-full max-w-2xl mx-auto mb-8 ${isRtl ? 'scale-x-[-1]' : ''}`}
      viewBox="0 0 600 260"
      fill="none"
    >
      {/* Patient node */}
      <circle cx="60" cy="80" r="30" fill="#F0FDFA" stroke="#0D7A7A" strokeWidth="2" />
      <circle cx="60" cy="72" r="8" stroke="#0D7A7A" strokeWidth="1.5" fill="none" />
      <path d="M46 95C46 88 52 84 60 84C68 84 74 88 74 95" stroke="#0D7A7A" strokeWidth="1.5" fill="none" />

      {/* DoctorTrio (Claude AI) center node */}
      <rect x="230" y="50" width="140" height="60" rx="12" fill="#0D7A7A" />
      <text x="300" y="75" textAnchor="middle" fill="white" fontSize="13" fontWeight="bold" className={isRtl ? 'scale-x-[-1]' : ''} style={{ transformOrigin: '300px 75px' }}>DoctorTrio</text>
      <text x="300" y="93" textAnchor="middle" fill="#B2F5EA" fontSize="10" className={isRtl ? 'scale-x-[-1]' : ''} style={{ transformOrigin: '300px 93px' }}>Claude AI</text>

      {/* Doctor node */}
      <circle cx="540" cy="80" r="30" fill="#F0FDFA" stroke="#0D7A7A" strokeWidth="2" />
      <circle cx="540" cy="72" r="8" stroke="#0D7A7A" strokeWidth="1.5" fill="none" />
      <path d="M526 95C526 88 532 84 540 84C548 84 554 88 554 95" stroke="#0D7A7A" strokeWidth="1.5" fill="none" />
      <path d="M530 68L534 64L538 68" stroke="#0D7A7A" strokeWidth="1" fill="none" />

      {/* Arrows: Patient -> DoctorTrio */}
      <path d="M95 80H225" stroke="#0D7A7A" strokeWidth="2" markerEnd="url(#arrowhead)" />
      {/* Arrows: DoctorTrio -> Doctor */}
      <path d="M375 80H505" stroke="#0D7A7A" strokeWidth="2" markerEnd="url(#arrowhead)" />

      {/* Bottom tech nodes */}
      <g>
        <rect x="120" y="180" width="90" height="36" rx="8" fill="#F0FDFA" stroke="#0D7A7A" strokeWidth="1.5" />
        <text x="165" y="203" textAnchor="middle" fill="#0D7A7A" fontSize="11" fontWeight="600" className={isRtl ? 'scale-x-[-1]' : ''} style={{ transformOrigin: '165px 203px' }}>Supabase</text>
      </g>
      <g>
        <rect x="225" y="180" width="80" height="36" rx="8" fill="#F0FDFA" stroke="#0D7A7A" strokeWidth="1.5" />
        <text x="265" y="203" textAnchor="middle" fill="#0D7A7A" fontSize="11" fontWeight="600" className={isRtl ? 'scale-x-[-1]' : ''} style={{ transformOrigin: '265px 203px' }}>LiveKit</text>
      </g>
      <g>
        <rect x="320" y="180" width="90" height="36" rx="8" fill="#F0FDFA" stroke="#0D7A7A" strokeWidth="1.5" />
        <text x="365" y="203" textAnchor="middle" fill="#0D7A7A" fontSize="11" fontWeight="600" className={isRtl ? 'scale-x-[-1]' : ''} style={{ transformOrigin: '365px 203px' }}>Deepgram</text>
      </g>
      <g>
        <rect x="425" y="180" width="80" height="36" rx="8" fill="#F0FDFA" stroke="#0D7A7A" strokeWidth="1.5" />
        <text x="465" y="203" textAnchor="middle" fill="#0D7A7A" fontSize="11" fontWeight="600" className={isRtl ? 'scale-x-[-1]' : ''} style={{ transformOrigin: '465px 203px' }}>PostGIS</text>
      </g>

      {/* Lines from center to bottom nodes */}
      <line x1="270" y1="110" x2="165" y2="180" stroke="#0D7A7A" strokeWidth="1" strokeDasharray="4 3" />
      <line x1="290" y1="110" x2="265" y2="180" stroke="#0D7A7A" strokeWidth="1" strokeDasharray="4 3" />
      <line x1="310" y1="110" x2="365" y2="180" stroke="#0D7A7A" strokeWidth="1" strokeDasharray="4 3" />
      <line x1="330" y1="110" x2="465" y2="180" stroke="#0D7A7A" strokeWidth="1" strokeDasharray="4 3" />

      {/* Labels */}
      <text x="60" y="125" textAnchor="middle" fill="#64748B" fontSize="11" className={isRtl ? 'scale-x-[-1]' : ''} style={{ transformOrigin: '60px 125px' }}>Patient</text>
      <text x="540" y="125" textAnchor="middle" fill="#64748B" fontSize="11" className={isRtl ? 'scale-x-[-1]' : ''} style={{ transformOrigin: '540px 125px' }}>Doctor</text>

      {/* Arrowhead marker */}
      <defs>
        <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="#0D7A7A" />
        </marker>
      </defs>
    </svg>
  );
}

/* ---- Graphic 5: Disclaimer Bridge Illustration ---- */
function DisclaimerBridgeSVG() {
  return (
    <svg
      aria-hidden="true"
      width="100"
      height="80"
      viewBox="0 0 100 80"
      fill="none"
      className="shrink-0 hidden md:block opacity-30"
    >
      {/* Patient */}
      <circle cx="15" cy="30" r="8" stroke="#0D7A7A" strokeWidth="1.5" />
      <circle cx="15" cy="26" r="3" stroke="#0D7A7A" strokeWidth="1" fill="none" />
      <path d="M10 37C10 34 12 32 15 32C18 32 20 34 20 37" stroke="#0D7A7A" strokeWidth="1" fill="none" />

      {/* Phone (DoctorTrio) */}
      <rect x="40" y="18" width="20" height="34" rx="4" stroke="#0D7A7A" strokeWidth="1.5" fill="none" />
      <line x1="45" y1="24" x2="55" y2="24" stroke="#0D7A7A" strokeWidth="1" />
      <line x1="45" y1="44" x2="55" y2="44" stroke="#0D7A7A" strokeWidth="1" />
      <text x="50" y="37" textAnchor="middle" fill="#0D7A7A" fontSize="6" fontWeight="bold">T</text>

      {/* Doctor */}
      <circle cx="85" cy="30" r="8" stroke="#0D7A7A" strokeWidth="1.5" />
      <circle cx="85" cy="26" r="3" stroke="#0D7A7A" strokeWidth="1" fill="none" />
      <path d="M80 37C80 34 82 32 85 32C88 32 90 34 90 37" stroke="#0D7A7A" strokeWidth="1" fill="none" />
      <path d="M82 23L84 21L86 23" stroke="#0D7A7A" strokeWidth="0.8" fill="none" />

      {/* Arrows */}
      <path d="M24 35L39 35" stroke="#0D7A7A" strokeWidth="1" markerEnd="url(#discArrow)" />
      <path d="M61 35L76 35" stroke="#0D7A7A" strokeWidth="1" markerEnd="url(#discArrow)" />

      {/* Labels */}
      <text x="50" y="72" textAnchor="middle" fill="#0D7A7A" fontSize="7">DoctorTrio</text>

      <defs>
        <marker id="discArrow" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
          <polygon points="0 0, 6 2, 0 4" fill="#0D7A7A" />
        </marker>
      </defs>
    </svg>
  );
}

/* ---- Graphic 6: Team Avatar Cards ---- */
function TeamAvatarCards({ lang }: { lang: Lang }) {
  const roles = [
    {
      labelAr: '\u0637\u0628\u064a\u0628',
      labelEn: 'Doctor',
      bg: 'bg-teal-50',
      strokeColor: '#0D7A7A',
      fillHead: '#0D7A7A',
      svg: (stroke: string) => (
        <svg aria-hidden="true" width="48" height="48" viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="16" r="8" stroke={stroke} strokeWidth="2" fill="none" />
          <path d="M8 44C8 34 15 28 24 28C33 28 40 34 40 44" stroke={stroke} strokeWidth="2" fill="none" />
          <path d="M20 12L22 8L24 12L26 8L28 12" stroke={stroke} strokeWidth="1.5" fill="none" />
          <circle cx="24" cy="38" r="3" stroke={stroke} strokeWidth="1.5" fill="none" />
        </svg>
      ),
    },
    {
      labelAr: '\u0645\u0647\u0646\u062f\u0633',
      labelEn: 'Engineer',
      bg: 'bg-teal-600',
      strokeColor: '#FFFFFF',
      fillHead: '#FFFFFF',
      svg: (stroke: string) => (
        <svg aria-hidden="true" width="48" height="48" viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="16" r="8" stroke={stroke} strokeWidth="2" fill="none" />
          <path d="M8 44C8 34 15 28 24 28C33 28 40 34 40 44" stroke={stroke} strokeWidth="2" fill="none" />
          <path d="M18 18L22 22L30 14" stroke={stroke} strokeWidth="1.5" fill="none" />
          <rect x="20" y="32" width="8" height="6" rx="1" stroke={stroke} strokeWidth="1" fill="none" />
        </svg>
      ),
    },
    {
      labelAr: '\u0623\u0645\u0646 \u0628\u064a\u0627\u0646\u0627\u062a',
      labelEn: 'Data Security',
      bg: 'bg-teal-50',
      strokeColor: '#0D7A7A',
      fillHead: '#0D7A7A',
      svg: (stroke: string) => (
        <svg aria-hidden="true" width="48" height="48" viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="16" r="8" stroke={stroke} strokeWidth="2" fill="none" />
          <path d="M8 44C8 34 15 28 24 28C33 28 40 34 40 44" stroke={stroke} strokeWidth="2" fill="none" />
          <path d="M24 30L18 34V40C18 43 21 46 24 46C27 46 30 43 30 40V34L24 30Z" stroke={stroke} strokeWidth="1.5" fill="none" />
          <circle cx="24" cy="38" r="1.5" fill={stroke} />
        </svg>
      ),
    },
  ];

  return (
    <div className="flex flex-wrap justify-center gap-6 mt-10">
      {roles.map((role, i) => (
        <div
          key={i}
          className={`${role.bg} rounded-2xl p-6 flex flex-col items-center w-36 shadow-sm`}
        >
          {role.svg(role.strokeColor)}
          <span className={`mt-3 text-sm font-semibold ${role.bg === 'bg-teal-600' ? 'text-white' : 'text-gray-800'}`}>
            {lang === 'ar' ? role.labelAr : role.labelEn}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ---- Graphic 2: Origin Story Timeline ---- */
function StoryTimeline({ lang }: { lang: Lang }) {
  const panels = lang === 'ar'
    ? [
        { label: '\u063a\u0631\u0641\u0629 \u0627\u0644\u0627\u0646\u062a\u0638\u0627\u0631', icon: 'waiting' as const },
        { label: '\u0627\u062c\u062a\u0645\u0627\u0639 \u0627\u0644\u0623\u0637\u0628\u0627\u0621', icon: 'meeting' as const },
        { label: '\u0648\u064f\u0644\u062f \u062a\u0631\u064a\u062c\u064a', icon: 'born' as const },
      ]
    : [
        { label: 'Waiting Room', icon: 'waiting' as const },
        { label: 'Doctors Meet', icon: 'meeting' as const },
        { label: 'DoctorTrio is Born', icon: 'born' as const },
      ];

  const panelSVG = (icon: 'waiting' | 'meeting' | 'born') => {
    switch (icon) {
      case 'waiting':
        return (
          <svg aria-hidden="true" width="64" height="64" viewBox="0 0 64 64" fill="none">
            <rect x="8" y="28" width="48" height="28" rx="4" stroke="#0D7A7A" strokeWidth="2" fill="#F0FDFA" />
            <circle cx="24" cy="20" r="6" stroke="#0D7A7A" strokeWidth="1.5" fill="none" />
            <path d="M16 42C16 36 19 33 24 33" stroke="#0D7A7A" strokeWidth="1.5" />
            <circle cx="42" cy="20" r="6" stroke="#0D7A7A" strokeWidth="1.5" fill="none" />
            <path d="M34 42C34 36 37 33 42 33" stroke="#0D7A7A" strokeWidth="1.5" />
            <circle cx="32" cy="46" r="3" stroke="#0D7A7A" strokeWidth="1" strokeDasharray="2 2" />
          </svg>
        );
      case 'meeting':
        return (
          <svg aria-hidden="true" width="64" height="64" viewBox="0 0 64 64" fill="none">
            <circle cx="20" cy="18" r="6" stroke="#0D7A7A" strokeWidth="1.5" fill="none" />
            <circle cx="44" cy="18" r="6" stroke="#0D7A7A" strokeWidth="1.5" fill="none" />
            <circle cx="32" cy="22" r="6" stroke="#0D7A7A" strokeWidth="1.5" fill="#F0FDFA" />
            <path d="M14 44C14 36 18 30 24 30" stroke="#0D7A7A" strokeWidth="1.5" />
            <path d="M50 44C50 36 46 30 40 30" stroke="#0D7A7A" strokeWidth="1.5" />
            <path d="M24 44C24 36 27 32 32 32C37 32 40 36 40 44" stroke="#0D7A7A" strokeWidth="1.5" />
            <path d="M26 48L32 42L38 48" stroke="#0D7A7A" strokeWidth="1.5" fill="none" />
          </svg>
        );
      case 'born':
        return (
          <svg aria-hidden="true" width="64" height="64" viewBox="0 0 64 64" fill="none">
            <rect x="16" y="12" width="32" height="40" rx="6" stroke="#0D7A7A" strokeWidth="2" fill="#F0FDFA" />
            <line x1="22" y1="20" x2="42" y2="20" stroke="#0D7A7A" strokeWidth="1" />
            <line x1="22" y1="44" x2="42" y2="44" stroke="#0D7A7A" strokeWidth="1" />
            <text x="32" y="35" textAnchor="middle" fill="#0D7A7A" fontSize="11" fontWeight="bold">T</text>
            <circle cx="32" cy="8" r="4" fill="#0D7A7A" opacity="0.15" />
            <path d="M28 8L32 4L36 8" stroke="#0D7A7A" strokeWidth="1.5" fill="none" />
          </svg>
        );
    }
  };

  return (
    <>
      {/* Desktop timeline */}
      <div className="hidden md:flex items-center justify-center gap-4 mt-10">
        {panels.map((panel, i) => (
          <div key={i} className="flex items-center gap-4">
            <div className="flex flex-col items-center gap-2">
              <div className="w-24 h-24 rounded-2xl bg-teal-50 flex items-center justify-center">
                {panelSVG(panel.icon)}
              </div>
              <span className="text-xs text-gray-500 font-medium">{panel.label}</span>
            </div>
            {i < panels.length - 1 && (
              <svg aria-hidden="true" width="48" height="24" viewBox="0 0 48 24" fill="none" className="rtl:rotate-180">
                <path d="M0 12H40" stroke="#0D7A7A" strokeWidth="1.5" strokeDasharray="4 3" />
                <path d="M36 6L44 12L36 18" stroke="#0D7A7A" strokeWidth="1.5" fill="none" />
              </svg>
            )}
          </div>
        ))}
      </div>

      {/* Mobile timeline */}
      <div className="flex flex-col md:hidden items-center gap-4 mt-8">
        {panels.map((panel, i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <div className="w-20 h-20 rounded-2xl bg-teal-50 flex items-center justify-center">
              {panelSVG(panel.icon)}
            </div>
            <span className="text-xs text-gray-500 font-medium">{panel.label}</span>
            {i < panels.length - 1 && (
              <svg aria-hidden="true" width="24" height="32" viewBox="0 0 24 32" fill="none">
                <path d="M12 0V24" stroke="#0D7A7A" strokeWidth="1.5" strokeDasharray="4 3" />
                <path d="M6 20L12 28L18 20" stroke="#0D7A7A" strokeWidth="1.5" fill="none" />
              </svg>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

export default function AboutClient({ lang }: { lang: Lang }) {
  const isRtl = lang === 'ar';
  const otherLang = lang === 'ar' ? 'en' : 'ar';
  const c = ABOUT[lang];
  const logoText = lang === 'ar' ? '\u062f\u0643\u062a\u0648\u0631 \u062a\u0631\u064a\u0648' : 'DoctorTrio';

  return (
    <main
      dir={isRtl ? 'rtl' : 'ltr'}
      className="min-h-screen bg-white text-gray-900 font-[Cairo]"
    >
      <SiteNavbar lang={lang} />

      {/* Hero -- Graphic 1: Network Pattern */}
      <section className="relative overflow-hidden pt-28 pb-20 px-4 text-center">
        <HeroNetworkSVG />
        <div className="relative max-w-3xl mx-auto">
          <span className="inline-block px-4 py-1.5 rounded-full bg-teal-50 text-teal-600 text-sm font-medium mb-6">
            {c.badge}
          </span>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 leading-tight">
            {c.title}
          </h1>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">
            {c.subtitle}
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="bg-slate-50 py-16 px-4">
        <div className={`max-w-3xl mx-auto ${isRtl ? 'text-right' : 'text-left'}`}>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            {c.missionTitle}
          </h2>
          <p className="text-lg leading-relaxed text-gray-700">
            {c.mission}
          </p>
        </div>
      </section>

      {/* Story -- Three-point origin narrative */}
      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">
            {c.storyTitle}
          </h2>

          <p className="text-gray-600 text-base leading-relaxed text-center max-w-2xl mx-auto mb-10">
            {c.storyIntro}
          </p>

          <div className="space-y-6 max-w-3xl mx-auto">
            {c.storyPoints.map((point, i) => {
              const isLast = i === 2;
              const isMid = i === 1;
              return (
                <div
                  key={i}
                  className={`flex gap-5 items-start rounded-2xl p-6 shadow-sm ${
                    isLast
                      ? 'bg-teal-600'
                      : isMid
                        ? 'bg-white border border-teal-100'
                        : 'bg-white border border-gray-100'
                  }`}
                >
                  <div className="shrink-0 flex flex-col items-center gap-2">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      isLast
                        ? 'bg-white/20'
                        : isMid
                          ? 'bg-teal-50'
                          : 'bg-gray-100'
                    }`}>
                      <span className={`font-bold text-sm ${
                        isLast ? 'text-white' : isMid ? 'text-teal-600' : 'text-gray-400'
                      }`}>
                        {point.number}
                      </span>
                    </div>
                    {!isLast && (
                      <div className={`w-px h-full min-h-[40px] hidden md:block ${
                        isMid ? 'bg-teal-100' : 'bg-gray-100'
                      }`} />
                    )}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl" aria-hidden="true">{point.icon}</span>
                      <h3 className={`font-bold text-base ${isLast ? 'text-white' : 'text-gray-900'}`}>
                        {point.title}
                      </h3>
                    </div>
                    <p className={`text-sm leading-relaxed ${isLast ? 'text-white/80' : 'text-gray-500'}`}>
                      {point.body}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-gray-400 text-sm text-center max-w-xl mx-auto mt-8 leading-relaxed italic">
            {c.storyClosing}
          </p>
        </div>
      </section>

      {/* Values -- Graphic 3: SVG Icons replace emojis */}
      <section className="bg-slate-50 py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-10 text-center">
            {c.valuesTitle}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {c.values.map((value, i) => {
              const IconComponent = VALUE_ICONS[i];
              return (
                <div
                  key={i}
                  className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
                >
                  {IconComponent ? <IconComponent /> : <div className="text-3xl mb-3">{value.icon}</div>}
                  <h3 className="text-lg font-bold text-gray-900 mb-2">
                    {value.title}
                  </h3>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    {value.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Technology -- Graphic 4: Architecture Diagram */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            {c.techTitle}
          </h2>
          <p className="text-gray-500 mb-8">{c.techSubtitle}</p>
          <TechArchDiagram isRtl={isRtl} />
          <div className="flex flex-wrap justify-center gap-3">
            {c.tech.map((t, i) => (
              <div
                key={i}
                className="bg-gray-100 rounded-full px-4 py-2 text-sm"
              >
                <span className="font-semibold text-gray-900">{t.name}</span>
                <span className="text-gray-500"> &mdash; {t.role}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Disclaimer -- Graphic 5: Bridge Illustration */}
      <section className="py-12 px-4">
        <div className="max-w-3xl mx-auto">
          <div
            className={`bg-teal-50 rounded-xl p-6 ${
              isRtl ? 'border-r-4' : 'border-l-4'
            } border-teal-500 flex items-start gap-4 ${isRtl ? 'flex-row-reverse' : 'flex-row'}`}
          >
            <div className="flex-1">
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                {c.disclaimerTitle}
              </h3>
              <p className="text-gray-700 leading-relaxed">
                {c.disclaimer}
              </p>
            </div>
            <DisclaimerBridgeSVG />
          </div>
        </div>
      </section>

      {/* Team -- Graphic 6: Avatar Cards */}
      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            {c.teamTitle}
          </h2>
          <p className="text-gray-700 leading-relaxed text-lg">
            {c.team}
          </p>
          <TeamAvatarCards lang={lang} />
        </div>
      </section>

      <SiteFooter lang={lang} />
    </main>
  );
}
