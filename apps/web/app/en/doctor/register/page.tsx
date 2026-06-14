'use client';

import { useState } from 'react';
import Link from 'next/link';

const SPECIALTIES = [
  'Internal Medicine',
  'Cardiology',
  'Neurology',
  'Orthopedics',
  'Dermatology',
  'ENT',
  'Ophthalmology',
  'Urology',
  'Gastroenterology',
  'Pulmonology',
  'Pediatrics',
  'Obstetrics & Gynecology',
  'Psychiatry',
  'General Surgery',
  'Emergency Medicine',
  'Family Medicine',
  'Oncology',
] as const;

const GOVERNORATES = [
  'Cairo',
  'Giza',
  'Alexandria',
  'Dakahlia',
  'Red Sea',
  'Beheira',
  'Fayoum',
  'Gharbia',
  'Ismailia',
  'Monufia',
  'Minya',
  'Qalyubia',
  'New Valley',
  'Suez',
  'Aswan',
  'Asyut',
  'Beni Suef',
  'Port Said',
  'Damietta',
  'Sharqia',
  'South Sinai',
  'Kafr El Sheikh',
  'Matrouh',
  'Luxor',
  'Qena',
  'North Sinai',
  'Sohag',
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
      errs.name_ar = 'Full name is required';
    }

    if (!form.syndicate_number.trim()) {
      errs.syndicate_number = 'Syndicate number is required';
    } else if (!/^\d{4,8}$/.test(form.syndicate_number.trim())) {
      errs.syndicate_number = 'Syndicate number must be 4–8 digits';
    }

    if (!form.specialty) {
      errs.specialty = 'Specialty is required';
    }

    if (!form.governorate) {
      errs.governorate = 'Governorate is required';
    }

    if (!form.phone.trim()) {
      errs.phone = 'Mobile number is required';
    } else if (!/^01[0125]\d{8}$/.test(form.phone.trim())) {
      errs.phone = 'Mobile number must start with 010, 011, 012, or 015 and be 11 digits';
    }

    if (!form.email.trim()) {
      errs.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      errs.email = 'Invalid email address';
    }

    if (!form.password) {
      errs.password = 'Password is required';
    } else if (form.password.length < 8) {
      errs.password = 'Password must be at least 8 characters';
    }

    if (!form.confirm_password) {
      errs.confirm_password = 'Please confirm your password';
    } else if (form.password !== form.confirm_password) {
      errs.confirm_password = 'Passwords do not match';
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
        setErrors({ general: data.error ?? 'Something went wrong, please try again' });
        return;
      }

      setIsSuccess(true);
    } catch {
      setErrors({ general: 'Cannot connect to server, please try again' });
    } finally {
      setIsLoading(false);
    }
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gray-50" dir="ltr">
        <Navbar />
        <main className="max-w-md mx-auto px-4 pt-12 pb-20">
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Registration successful!</h2>
            <p className="text-gray-600 leading-relaxed mb-6">
              Thank you for registering! We will review your information within 24–48 hours and send you a confirmation email.
            </p>
            <p className="text-sm text-gray-400">
              Syndicate number verification is done manually during the beta phase
            </p>
            <Link
              href="/en/doctor/login"
              className="inline-block mt-8 text-teal-600 font-semibold hover:text-teal-700 transition-colors"
            >
              Go to login page &rarr;
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" dir="ltr">
      <Navbar />
      <main className="max-w-md mx-auto px-4 pt-8 pb-20">
        <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8">
          <h1 className="text-2xl font-bold text-[#1A2F4A] mb-2">Register as a new doctor</h1>
          <p className="text-gray-500 text-sm mb-8">Fill in your details and we will review them shortly</p>

          {errors.general && (
            <div className="bg-red-50 text-red-700 text-sm rounded-lg p-3 mb-6">
              {errors.general}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <InputField
              label="Full name"
              value={form.name_ar}
              onChange={(v) => updateField('name_ar', v)}
              error={errors.name_ar}
              placeholder="Dr. John Smith"
            />

            <InputField
              label="Medical Syndicate number"
              value={form.syndicate_number}
              onChange={(v) => updateField('syndicate_number', v)}
              error={errors.syndicate_number}
              placeholder="e.g. 12345"
              inputMode="numeric"
              pattern="[0-9]*"
            />

            <SelectField
              label="Primary specialty"
              value={form.specialty}
              onChange={(v) => updateField('specialty', v)}
              error={errors.specialty}
              placeholder="Select specialty"
              options={SPECIALTIES.map((s) => ({ value: s, label: s }))}
            />

            <SelectField
              label="Governorate"
              value={form.governorate}
              onChange={(v) => updateField('governorate', v)}
              error={errors.governorate}
              placeholder="Select governorate"
              options={GOVERNORATES.map((g) => ({ value: g, label: g }))}
            />

            <InputField
              label="Clinic or hospital name"
              value={form.clinic_name}
              onChange={(v) => updateField('clinic_name', v)}
              placeholder="Optional"
              required={false}
            />

            <InputField
              label="Mobile number"
              value={form.phone}
              onChange={(v) => updateField('phone', v)}
              error={errors.phone}
              placeholder="01XXXXXXXXX"
              inputMode="tel"
            />

            <InputField
              label="Email address"
              value={form.email}
              onChange={(v) => updateField('email', v)}
              error={errors.email}
              placeholder="doctor@example.com"
              type="email"
            />

            <InputField
              label="Password"
              value={form.password}
              onChange={(v) => updateField('password', v)}
              error={errors.password}
              placeholder="At least 8 characters"
              type="password"
            />

            <InputField
              label="Confirm password"
              value={form.confirm_password}
              onChange={(v) => updateField('confirm_password', v)}
              error={errors.confirm_password}
              placeholder="Re-enter your password"
              type="password"
            />

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-teal-600 text-white font-semibold py-3 rounded-xl hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Registering...' : 'Register'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Already have an account?{' '}
            <Link href="/en/doctor/login" className="text-teal-600 font-semibold hover:text-teal-700">
              Sign in
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
          Triajji
        </Link>
        <Link
          href="/en/doctor/login"
          className="text-sm font-semibold text-[#1A2F4A] hover:text-teal-600 transition-colors"
        >
          Doctor login
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
        {required && <span className="text-red-500 ml-1">*</span>}
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
        <span className="text-red-500 ml-1">*</span>
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
