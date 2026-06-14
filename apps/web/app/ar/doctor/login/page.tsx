'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface LoginResponse {
  success?: boolean;
  error?: string;
  verification_status?: 'pending' | 'verified' | 'rejected';
  rejection_reason?: string;
  token?: string;
}

export default function DoctorLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('البريد الإلكتروني وكلمة المرور مطلوبين');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/doctor/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = (await res.json()) as LoginResponse;

      if (!res.ok || !data.success) {
        setError(data.error ?? 'البريد الإلكتروني أو كلمة المرور غير صحيحة');
        return;
      }

      switch (data.verification_status) {
        case 'pending':
          router.push('/ar/doctor/pending');
          break;
        case 'rejected':
          setError(
            data.rejection_reason
              ? `تم رفض الحساب: ${data.rejection_reason}`
              : 'تم رفض طلب التسجيل. تواصل معانا لو محتاج مساعدة.'
          );
          break;
        case 'verified':
          router.push('/ar/doctor/dashboard');
          break;
        default:
          router.push('/ar/doctor/pending');
      }
    } catch {
      setError('مفيش اتصال بالسيرفر، حاول تاني');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-md mx-auto px-4 pt-16 pb-20">
        <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8">
          <h1 className="text-2xl font-bold text-[#1A2F4A] mb-2">دخول الأطباء</h1>
          <p className="text-gray-500 text-sm mb-8">سجّل دخولك لإدارة حسابك ومواعيدك</p>

          {error && (
            <div className="bg-red-50 text-red-700 text-sm rounded-lg p-3 mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                البريد الإلكتروني
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="doctor@example.com"
                dir="ltr"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none transition-colors focus:border-teal-500 bg-white"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                كلمة المرور
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="كلمة المرور"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none transition-colors focus:border-teal-500 bg-white"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-teal-600 text-white font-semibold py-3 rounded-xl hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'جاري الدخول...' : 'دخول'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            مش معانا لسه؟{' '}
            <Link href="/ar/doctor/register" className="text-teal-600 font-semibold hover:text-teal-700">
              سجّل كطبيب
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
