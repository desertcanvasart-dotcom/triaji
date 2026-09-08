'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

type ClinicMode = 'independent' | 'own_clinic' | 'existing_clinic';

interface ClinicOption {
  id: string;
  name_ar: string;
  name_en: string;
  tier: string;
}

// `value` is the canonical `specialties.name_ar` — it lands in
// `doctor_accounts.specialty_ar` and the admin approval step looks the specialty
// up by that name. Only the label is localised; both register forms therefore
// store the exact same value.
const SPECIALTIES = [
  { value: 'باطنة', label: 'Internal Medicine' },
  { value: 'قلب وأوعية دموية', label: 'Cardiology' },
  { value: 'مخ وأعصاب', label: 'Neurology' },
  { value: 'عظام', label: 'Orthopaedics' },
  { value: 'جلدية', label: 'Dermatology' },
  { value: 'أنف وأذن وحنجرة', label: 'ENT' },
  { value: 'عيون', label: 'Ophthalmology' },
  { value: 'مسالك بولية', label: 'Urology' },
  { value: 'جهاز هضمي', label: 'Gastroenterology' },
  { value: 'صدر', label: 'Pulmonology' },
  { value: 'أطفال', label: 'Paediatrics' },
  { value: 'نساء وتوليد', label: 'Obstetrics & Gynaecology' },
  { value: 'نفسية', label: 'Psychiatry' },
  { value: 'جراحة عامة', label: 'General Surgery' },
  { value: 'طوارئ', label: 'Emergency Medicine' },
  { value: 'طب الأسرة', label: 'Family Medicine' },
  { value: 'أورام', label: 'Oncology' },
  { value: 'غدد صماء', label: 'Endocrinology' },
  { value: 'أسنان', label: 'Dentistry' },
  { value: 'علاج طبيعي', label: 'Physiotherapy' },
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
  foreign_degree: boolean;
  governorate: string;
  clinic_mode: ClinicMode;
  clinic_name: string;
  clinic_name_en: string;
  clinic_address: string;
  requested_tenant_id: string;
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
  clinic_name?: string;
  requested_tenant_id?: string;
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
    foreign_degree: false,
    governorate: '',
    clinic_mode: 'independent',
    clinic_name: '',
    clinic_name_en: '',
    clinic_address: '',
    requested_tenant_id: '',
    phone: '',
    email: '',
    password: '',
    confirm_password: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [clinics, setClinics] = useState<ClinicOption[]>([]);

  // Load the joinable-facilities list the first time it's needed.
  useEffect(() => {
    if (form.clinic_mode !== 'existing_clinic' || clinics.length > 0) return;
    fetch('/api/clinics')
      .then((r) => (r.ok ? r.json() : { clinics: [] }))
      .then((d) => setClinics(d.clinics ?? []))
      .catch(() => setClinics([]));
  }, [form.clinic_mode, clinics.length]);

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

    if (form.clinic_mode === 'own_clinic' && !form.clinic_name.trim()) {
      errs.clinic_name = 'Clinic name is required';
    }
    if (form.clinic_mode === 'existing_clinic' && !form.requested_tenant_id) {
      errs.requested_tenant_id = 'Select the facility you work at';
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
          foreign_degree: form.foreign_degree,
          governorate: form.governorate,
          clinic_mode: form.clinic_mode,
          clinic_name: form.clinic_name.trim() || undefined,
          requested_clinic_name_en: form.clinic_name_en.trim() || undefined,
          requested_clinic_address_ar: form.clinic_address.trim() || undefined,
          requested_tenant_id: form.requested_tenant_id || undefined,
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
              options={SPECIALTIES.map((s) => ({ value: s.value, label: s.label }))}
            />

            <label
              className={`flex items-start gap-2 border rounded-xl px-4 py-2.5 text-sm cursor-pointer transition-colors ${
                form.foreign_degree
                  ? 'border-teal-500 bg-teal-50 text-teal-900'
                  : 'border-gray-200 bg-white text-gray-700'
              }`}
            >
              <input
                type="checkbox"
                checked={form.foreign_degree}
                onChange={(e) => setForm((prev) => ({ ...prev, foreign_degree: e.target.checked }))}
                className="mt-0.5 accent-teal-600"
              />
              <span>
                My degree is from a university outside Egypt
                <span className="block text-xs text-gray-500 mt-0.5">
                  We&apos;ll ask for the Supreme Council of Universities equivalency during verification
                </span>
              </span>
            </label>

            <SelectField
              label="Governorate"
              value={form.governorate}
              onChange={(v) => updateField('governorate', v)}
              error={errors.governorate}
              placeholder="Select governorate"
              options={GOVERNORATES.map((g) => ({ value: g, label: g }))}
            />

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Where do you practice?
                <span className="text-red-500 ml-1">*</span>
              </label>
              <div className="space-y-2">
                {(
                  [
                    { value: 'independent', label: 'Independent doctor (no clinic)' },
                    { value: 'own_clinic', label: 'I have my own clinic' },
                    { value: 'existing_clinic', label: 'I work at a clinic or hospital on DoctorTrio' },
                  ] as { value: ClinicMode; label: string }[]
                ).map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex items-center gap-2 border rounded-xl px-4 py-2.5 text-sm cursor-pointer transition-colors ${
                      form.clinic_mode === opt.value
                        ? 'border-teal-500 bg-teal-50 text-teal-900'
                        : 'border-gray-200 bg-white text-gray-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="clinic_mode"
                      value={opt.value}
                      checked={form.clinic_mode === opt.value}
                      onChange={() => updateField('clinic_mode', opt.value)}
                      className="accent-teal-600"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            {form.clinic_mode === 'own_clinic' && (
              <>
                <InputField
                  label="Clinic name (Arabic)"
                  value={form.clinic_name}
                  onChange={(v) => updateField('clinic_name', v)}
                  error={errors.clinic_name}
                  placeholder="عيادة د. محمد أحمد"
                />
                <InputField
                  label="Clinic name (English)"
                  value={form.clinic_name_en}
                  onChange={(v) => updateField('clinic_name_en', v)}
                  placeholder="Optional — shown in the English directory"
                  required={false}
                />
                <InputField
                  label="Clinic address"
                  value={form.clinic_address}
                  onChange={(v) => updateField('clinic_address', v)}
                  placeholder="Optional"
                  required={false}
                />
                <p className="text-xs text-gray-400 -mt-3">
                  We&apos;ll create your clinic page and its own admin dashboard once your
                  account is approved.
                </p>
              </>
            )}

            {form.clinic_mode === 'existing_clinic' && (
              <SelectField
                label="Select facility"
                value={form.requested_tenant_id}
                onChange={(v) => updateField('requested_tenant_id', v)}
                error={errors.requested_tenant_id}
                placeholder={clinics.length === 0 ? 'Loading…' : 'Choose the clinic or hospital'}
                options={clinics.map((c) => ({ value: c.id, label: c.name_en || c.name_ar }))}
              />
            )}

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
            {' · '}
            <Link
              href="/en/doctor/forgot-password"
              className="text-teal-600 font-semibold hover:text-teal-700"
            >
              Forgot password?
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
          DoctorTrio
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
