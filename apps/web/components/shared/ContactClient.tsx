'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Lang } from '@triaji/shared/i18n';
import SiteNavbar from './SiteNavbar';
import SiteFooter from './SiteFooter';

const CONTACT = {
  ar: {
    title: 'تواصل معنا',
    subtitle: 'فريقنا جاهز لمساعدتك، ومتاحاً من خلال كل طرق التواصل الممكنة.',
    channels: [
      { icon: '📞', title: 'خط الدعم', value: '19009', description: 'السبت – الخميس، 8 صباحاً – 10 مساءً', action: 'اتصل الآن', href: 'tel:19009' },
      { icon: '💬', title: 'واتساب', value: '+20-1XX-XXXX-XXX', description: 'رد سريع خلال ساعات العمل', action: 'ابعت رسالة', href: 'https://wa.me/20XXXXXXXXXX' },
      { icon: '📧', title: 'البريد الإلكتروني', value: 'support@doctortrio.online', description: 'بنرد خلال 24 ساعة', action: 'ابعت إيميل', href: 'mailto:support@doctortrio.online' },
    ],
    topics: [
      { icon: '🏥', label: 'للمستشفيات والعيادات', email: 'providers@doctortrio.online' },
      { icon: '👨‍⚕️', label: 'للأطباء', email: 'doctors@doctortrio.online' },
      { icon: '🛡️', label: 'للخصوصية والبيانات', email: 'privacy@doctortrio.online' },
      { icon: '📰', label: 'للإعلام والصحافة', email: 'press@doctortrio.online' },
    ],
    formTitle: 'أو أرسل رسالتك مباشرة',
    form: { name: 'اسمك', phone: 'رقم موبايلك', email: 'بريدك الإلكتروني (اختياري)', subject: 'موضوع الرسالة', message: 'رسالتك', submit: 'إرسال الرسالة', successMsg: 'تم استلام رسالتك — هنرد عليك في أقرب وقت' },
    emergency: { title: 'في حالات الطوارئ الطبية', content: 'لا تتواصل معنا — اتصل بالإسعاف فوراً على 123' },
    nav: { home: 'الرئيسية', contact: 'تواصل معنا' },
    footer: { emergency: 'دكتور تريو ليس بديلاً عن الطوارئ — في حالات الطوارئ اتصل بـ 123', copyright: '© 2026 دكتور تريو. جميع الحقوق محفوظة.' },
  },
  en: {
    title: 'Contact Us',
    subtitle: 'Our team is ready to help, and available through every possible communication channel.',
    channels: [
      { icon: '📞', title: 'Support Line', value: '19009', description: 'Saturday - Thursday, 8AM - 10PM', action: 'Call now', href: 'tel:19009' },
      { icon: '💬', title: 'WhatsApp', value: '+20-1XX-XXXX-XXX', description: 'Quick response during working hours', action: 'Send message', href: 'https://wa.me/20XXXXXXXXXX' },
      { icon: '📧', title: 'Email', value: 'support@doctortrio.online', description: 'We respond within 24 hours', action: 'Send email', href: 'mailto:support@doctortrio.online' },
    ],
    topics: [
      { icon: '🏥', label: 'For hospitals and clinics', email: 'providers@doctortrio.online' },
      { icon: '👨‍⚕️', label: 'For doctors', email: 'doctors@doctortrio.online' },
      { icon: '🛡️', label: 'For privacy and data', email: 'privacy@doctortrio.online' },
      { icon: '📰', label: 'For media and press', email: 'press@doctortrio.online' },
    ],
    formTitle: 'Or send us a message directly',
    form: { name: 'Your name', phone: 'Your mobile number', email: 'Your email (optional)', subject: 'Subject', message: 'Your message', submit: 'Send message', successMsg: 'Message received — we\'ll get back to you shortly' },
    emergency: { title: 'Medical emergencies', content: 'Do not contact us — call an ambulance immediately on 123' },
    nav: { home: 'Home', contact: 'Contact Us' },
    footer: { emergency: 'DoctorTrio is not a substitute for emergency services — call 123 in emergencies', copyright: '© 2026 DoctorTrio. All rights reserved.' },
  },
};

export default function ContactClient({ lang }: { lang: Lang }) {
  const c = CONTACT[lang];
  const isRtl = lang === 'ar';
  const otherLang = lang === 'ar' ? 'en' : 'ar';

  const [formData, setFormData] = useState({ name: '', phone: '', email: '', subject: '', message: '' });
  const [formStatus, setFormStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormStatus('sending');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error('Failed');
      setFormStatus('sent');
      setFormData({ name: '', phone: '', email: '', subject: '', message: '' });
    } catch {
      setFormStatus('error');
    }
  };

  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} className="min-h-screen bg-white font-[family-name:var(--font-cairo)]">
      <SiteNavbar lang={lang} />

      {/* Hero */}
      <section className="py-16 px-4 text-center">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">{c.title}</h1>
          <p className="text-gray-500 text-lg">{c.subtitle}</p>
        </div>
      </section>

      {/* Emergency warning */}
      <section className="px-4 mb-12">
        <div className="max-w-3xl mx-auto bg-red-50 border border-red-200 rounded-xl p-4 text-center">
          <p className="text-red-700 font-bold text-sm mb-1">⚠️ {c.emergency.title}</p>
          <p className="text-red-600 text-sm">{c.emergency.content}</p>
        </div>
      </section>

      {/* Contact channels */}
      <section className="px-4 mb-12">
        <div className="max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4">
          {c.channels.map((ch, i) => (
            <div key={i} className="bg-gray-50 rounded-xl p-5 text-center">
              <span className="text-3xl mb-3 block">{ch.icon}</span>
              <h3 className="font-bold text-gray-900 text-sm mb-1">{ch.title}</h3>
              <p className="text-teal-600 font-medium text-sm mb-1">{ch.value}</p>
              <p className="text-gray-400 text-xs mb-3">{ch.description}</p>
              <a
                href={ch.href}
                className="inline-block bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors"
              >
                {ch.action}
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* Topic-specific emails */}
      <section className="px-4 mb-12">
        <div className="max-w-3xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-3">
          {c.topics.map((t, i) => (
            <a key={i} href={`mailto:${t.email}`} className="bg-gray-50 hover:bg-teal-50 rounded-xl p-4 text-center transition-colors group">
              <span className="text-2xl mb-2 block">{t.icon}</span>
              <p className="text-gray-700 text-xs font-medium mb-1">{t.label}</p>
              <p className="text-teal-600 text-xs group-hover:underline">{t.email}</p>
            </a>
          ))}
        </div>
      </section>

      {/* Contact form */}
      <section className="px-4 mb-16">
        <div className="max-w-lg mx-auto">
          <h2 className="text-xl font-bold text-gray-900 text-center mb-6">{c.formTitle}</h2>

          {formStatus === 'sent' ? (
            <div className="bg-teal-50 rounded-xl p-6 text-center">
              <p className="text-teal-700 font-bold">{c.form.successMsg}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-600 text-xs font-medium mb-1">{c.form.name}</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-gray-600 text-xs font-medium mb-1">{c.form.phone}</label>
                  <input
                    type="tel"
                    required
                    dir="ltr"
                    value={formData.phone}
                    onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-gray-600 text-xs font-medium mb-1">{c.form.email}</label>
                <input
                  type="email"
                  dir="ltr"
                  value={formData.email}
                  onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-gray-600 text-xs font-medium mb-1">{c.form.subject}</label>
                <input
                  type="text"
                  required
                  value={formData.subject}
                  onChange={(e) => setFormData((p) => ({ ...p, subject: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-gray-600 text-xs font-medium mb-1">{c.form.message}</label>
                <textarea
                  required
                  rows={5}
                  value={formData.message}
                  onChange={(e) => setFormData((p) => ({ ...p, message: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
                />
              </div>
              <button
                type="submit"
                disabled={formStatus === 'sending'}
                className="w-full bg-teal-600 hover:bg-teal-500 text-white font-bold py-3 rounded-xl text-sm transition-all duration-200 disabled:opacity-50"
              >
                {formStatus === 'sending' ? '...' : c.form.submit}
              </button>
              {formStatus === 'error' && (
                <p className="text-red-500 text-xs text-center">Something went wrong. Please try again.</p>
              )}
            </form>
          )}
        </div>
      </section>

      <SiteFooter lang={lang} />
    </main>
  );
}
