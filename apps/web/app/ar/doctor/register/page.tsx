'use client';

import { useState } from 'react';
import Link from 'next/link';

const SPECIALTIES = [
  'طب باطني',
  'أمراض القلب',
  'أمراض الأعصاب',
  'عظام',
  'جلدية',
  'أنف وأذن وحنجرة',
  'عيون',
  'مسالك بولية',
  'جهاز هضمي',
  'أمراض صدرية',
  'أطفال',
  'نساء وتوليد',
  'طب نفسي',
  'جراحة عامة',
  'طوارئ',
  'طب الأسرة',
  'أورام',
] as const;

const GOVERNORATES = [
  'القاهرة',
  'الجيزة',
  'الإسكندرية',
  'الدقهلية',
  'البحر الأحمر',
  'البحيرة',
  'الفيوم',
  'الغربية',
  'الإسماعيلية',
  'المنوفية',
  'المنيا',
  'القليوبية',
  'الوادي الجديد',
  'السويس',
  'أسوان',
  'أسيوط',
  'بني سويف',
  'بورسعيد',
  'دمياط',
  'الشرقية',
  'جنوب سيناء',
  'كفر الشيخ',
  'مطروح',
  'الأقصر',
  'قنا',
  'شمال سيناء',
  'سوهاج',
] as const;

interface FormData {
  name_ar: string;
  syndicate_number: string;
  specialty: string;
  governorate: string;
  clinic_name: string;
  phone: string;
  email: string;
  password: string;
  confirm_password: string;
}

interface FormErrors {
  name_ar?: string;
  syndicate_number?: string;
  specialty?: string;
  governorate?: string;
  phone?: string;
  email?: string;
  password?: string;
  confirm_password?: string;
  general?: string;
}

export default function DoctorRegisterPage() {
  const [form, setForm] = useState<FormData>({
    name_ar: '',
    syndicate_number: '',
    specialty: '',
    governorate: '',
    clinic_name: '',
    phone: '',
    email: '',
    password: '',
    confirm_password: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  function updateField(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field as keyof FormErrors];
        return next;
      });
    }
  }

  function validate(): FormErrors {
    const errs: FormErrors = {};

    if (!form.name_ar.trim()) {
      errs.name_ar = 'الاسم مطلوب';
    }

    if (!form.syndicate_number.trim()) {
      errs.syndicate_number = 'رقم النقابة مطلوب';
    } else if (!/^\d{4,8}$/.test(form.syndicate_number.trim())) {
      errs.syndicate_number = 'رقم النقابة لازم يكون من 4 لـ 8 أرقام';
    }

    if (!form.specialty) {
      errs.specialty = 'التخصص مطلوب';
    }

    if (!form.governorate) {
      errs.governorate = 'المحافظة مطلوبة';
    }

    if (!form.phone.trim()) {
      errs.phone = 'رقم الموبايل مطلوب';
    } else if (!/^01[0125]\d{8}$/.test(form.phone.trim())) {
      errs.phone = 'رقم الموبايل لازم يبدأ بـ 010 أو 011 أو 012 أو 015 ويكون 11 رقم';
    }

    if (!form.email.trim()) {
      errs.email = 'البريد الإلكتروني مطلوب';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      errs.email = 'البريد الإلكتروني مش صحيح';
    }

    if (!form.password) {
      errs.password = 'كلمة المرور مطلوبة';
    } else if (form.password.length < 8) {
      errs.password = 'كلمة المرور لازم تكون 8 حروف على الأقل';
    }

    if (!form.confirm_password) {
      errs.confirm_password = 'تأكيد كلمة المرور مطلوب';
    } else if (form.password !== form.confirm_password) {
      errs.confirm_password = 'كلمتين المرور مش متطابقين';
    }

    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    setIsLoading(true);

    try {
      const res = await fetch('/api/doctor/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name_ar: form.name_ar.trim(),
          syndicate_number: form.syndicate_number.trim(),
          specialty: form.specialty,
          governorate: form.governorate,
          clinic_name: form.clinic_name.trim() || undefined,
          phone: form.phone.trim(),
          email: form.email.trim(),
          password: form.password,
        }),
      });

      const data = (await res.json()) as { success?: boolean; error?: string };

      if (!res.ok || !data.success) {
        setErrors({ general: data.error ?? 'حصل مشكلة، حاول تاني' });
        return;
      }

      setIsSuccess(true);
    } catch {
      setErrors({ general: 'مفيش اتصال بالسيرفر، حاول تاني' });
    } finally {
      setIsLoading(false);
    }
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="max-w-md mx-auto px-4 pt-12 pb-20">
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">تم التسجيل بنجاح!</h2>
            <p className="text-gray-600 leading-relaxed mb-6">
              شكراً على تسجيلك! هراجع بياناتك خلال 24-48 ساعة وهبعتلك إيميل تأكيد.
            </p>
            <p className="text-sm text-gray-400">
              التحقق من رقم النقابة بيتم يدوياً في المرحلة التجريبية
            </p>
            <Link
              href="/ar/doctor/login"
              className="inline-block mt-8 text-teal-600 font-semibold hover:text-teal-700 transition-colors"
            >
              الذهاب لصفحة الدخول ←
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-md mx-auto px-4 pt-8 pb-20">
        <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8">
          <h1 className="text-2xl font-bold text-[#1A2F4A] mb-2">تسجيل طبيب جديد</h1>
          <p className="text-gray-500 text-sm mb-8">سجّل بياناتك وهنراجعها في أقرب وقت</p>

          {errors.general && (
            <div className="bg-red-50 text-red-700 text-sm rounded-lg p-3 mb-6">
              {errors.general}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <InputField
              label="الاسم بالكامل (بالعربي)"
              value={form.name_ar}
              onChange={(v) => updateField('name_ar', v)}
              error={errors.name_ar}
              placeholder="د. محمد أحمد"
            />

            <InputField
              label="رقم نقابة الأطباء"
              value={form.syndicate_number}
              onChange={(v) => updateField('syndicate_number', v)}
              error={errors.syndicate_number}
              placeholder="مثال: 12345"
              inputMode="numeric"
              pattern="[0-9]*"
            />

            <SelectField
              label="التخصص الرئيسي"
              value={form.specialty}
              onChange={(v) => updateField('specialty', v)}
              error={errors.specialty}
              placeholder="اختر التخصص"
              options={SPECIALTIES.map((s) => ({ value: s, label: s }))}
            />

            <SelectField
              label="المحافظة"
              value={form.governorate}
              onChange={(v) => updateField('governorate', v)}
              error={errors.governorate}
              placeholder="اختر المحافظة"
              options={GOVERNORATES.map((g) => ({ value: g, label: g }))}
            />

            <InputField
              label="اسم العيادة أو المستشفى"
              value={form.clinic_name}
              onChange={(v) => updateField('clinic_name', v)}
              placeholder="اختياري"
              required={false}
            />

            <InputField
              label="رقم الموبايل"
              value={form.phone}
              onChange={(v) => updateField('phone', v)}
              error={errors.phone}
              placeholder="01XXXXXXXXX"
              inputMode="tel"
              dir="ltr"
            />

            <InputField
              label="البريد الإلكتروني"
              value={form.email}
              onChange={(v) => updateField('email', v)}
              error={errors.email}
              placeholder="doctor@example.com"
              type="email"
              dir="ltr"
            />

            <InputField
              label="كلمة المرور"
              value={form.password}
              onChange={(v) => updateField('password', v)}
              error={errors.password}
              placeholder="8 حروف على الأقل"
              type="password"
            />

            <InputField
              label="تأكيد كلمة المرور"
              value={form.confirm_password}
              onChange={(v) => updateField('confirm_password', v)}
              error={errors.confirm_password}
              placeholder="أعد كتابة كلمة المرور"
              type="password"
            />

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-teal-600 text-white font-semibold py-3 rounded-xl hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'جاري التسجيل...' : 'تسجيل'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            عندك حساب؟{' '}
            <Link href="/ar/doctor/login" className="text-teal-600 font-semibold hover:text-teal-700">
              سجّل دخول
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}

function Navbar() {
  return (
    <nav className="bg-white border-b border-gray-100 px-4 py-3">
      <div className="max-w-md mx-auto flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-teal-600">
          ترياڃي
        </Link>
        <Link
          href="/ar/doctor/login"
          className="text-sm font-semibold text-[#1A2F4A] hover:text-teal-600 transition-colors"
        >
          دخول الأطباء
        </Link>
      </div>
    </nav>
  );
}

interface InputFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  placeholder?: string;
  type?: 'text' | 'email' | 'password';
  inputMode?: 'text' | 'numeric' | 'tel' | 'email';
  pattern?: string;
  required?: boolean;
  dir?: 'rtl' | 'ltr';
}

function InputField({
  label,
  value,
  onChange,
  error,
  placeholder,
  type = 'text',
  inputMode,
  pattern,
  required = true,
  dir,
}: InputFieldProps) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
        {label}
        {required && <span className="text-red-500 mr-1">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        pattern={pattern}
        dir={dir}
        className={`w-full border rounded-xl px-4 py-2.5 text-sm outline-none transition-colors ${
          error
            ? 'border-red-400 focus:border-red-500 bg-red-50'
            : 'border-gray-200 focus:border-teal-500 bg-white'
        }`}
      />
      {error && <p className="text-red-600 text-xs mt-1">{error}</p>}
    </div>
  );
}

interface SelectOption {
  value: string;
  label: string;
}

interface SelectFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  placeholder: string;
  options: SelectOption[];
}

function SelectField({ label, value, onChange, error, placeholder, options }: SelectFieldProps) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
        {label}
        <span className="text-red-500 mr-1">*</span>
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full border rounded-xl px-4 py-2.5 text-sm outline-none transition-colors appearance-none bg-no-repeat ${
          error
            ? 'border-red-400 focus:border-red-500 bg-red-50'
            : 'border-gray-200 focus:border-teal-500 bg-white'
        } ${!value ? 'text-gray-400' : 'text-gray-900'}`}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="text-red-600 text-xs mt-1">{error}</p>}
    </div>
  );
}
