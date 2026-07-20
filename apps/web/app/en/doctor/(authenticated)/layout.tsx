'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';

// ─── Types ──────────────────────────────────────────────────────────────────

interface DoctorAccount {
  id: string;
  name_en: string | null;
  name_ar: string;
  specialty_ar: string;
  verification_status: 'pending' | 'verified' | 'rejected';
}

interface MeResponse {
  doctorAccount: DoctorAccount;
}

interface NavItem {
  label: string;
  icon: string;
  href: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const NAV_ITEMS: NavItem[] = [
  { label: 'My Appointments', icon: '📅', href: '/en/doctor/dashboard' },
  { label: 'Followed Patients', icon: '👥', href: '/en/doctor/patients' },
  { label: 'Patient Summaries', icon: '📋', href: '/en/doctor/dashboard' },
  { label: 'Quick Intake', icon: '⚡', href: '/en/doctor/quick-intake' },
  { label: 'Settings', icon: '⚙️', href: '/en/doctor/settings' },
];

// ─── Sidebar Skeleton ───────────────────────────────────────────────────────

function SidebarSkeleton() {
  return (
    <aside className="w-64 min-h-screen bg-white border-r border-gray-200 p-6">
      <div className="animate-pulse space-y-4">
        <div className="h-6 bg-gray-200 rounded w-3/4" />
        <div className="h-4 bg-gray-200 rounded w-1/2" />
        <div className="h-4 bg-gray-200 rounded w-1/3" />
        <div className="mt-8 space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 bg-gray-100 rounded" />
          ))}
        </div>
      </div>
    </aside>
  );
}

// ─── Main Content Skeleton ──────────────────────────────────────────────────

function ContentSkeleton() {
  return (
    <main className="flex-1 p-8">
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-gray-200 rounded w-1/3" />
        <div className="h-4 bg-gray-200 rounded w-1/4" />
        <div className="mt-6 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded" />
          ))}
        </div>
      </div>
    </main>
  );
}

// ─── Layout Component ───────────────────────────────────────────────────────

export default function DoctorAuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [doctor, setDoctor] = useState<DoctorAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch('/api/doctor/auth/me');

        if (res.status === 401) {
          router.replace('/en/doctor/login');
          return;
        }

        if (!res.ok) {
          router.replace('/en/doctor/login');
          return;
        }

        const data: MeResponse = await res.json();
        const account = data.doctorAccount;

        if (!account || account.verification_status !== 'verified') {
          router.replace('/en/doctor/pending');
          return;
        }

        setDoctor(account);
      } catch {
        router.replace('/en/doctor/login');
      } finally {
        setLoading(false);
      }
    }

    checkAuth();
  }, [router]);

  const handleLogout = useCallback(async () => {
    setLoggingOut(true);
    try {
      await fetch('/api/doctor/auth/logout', { method: 'POST' });
    } finally {
      router.replace('/en/doctor/login');
    }
  }, [router]);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  if (loading) {
    return (
      <div className="flex min-h-screen bg-gray-50" dir="ltr">
        <SidebarSkeleton />
        <ContentSkeleton />
      </div>
    );
  }

  if (!doctor) {
    return null;
  }

  const displayName = doctor.name_en || doctor.name_ar;

  return (
    <div className="flex min-h-screen bg-gray-50" dir="ltr">
      {/* Mobile hamburger */}
      <button
        type="button"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed top-4 left-4 z-50 md:hidden bg-white border border-gray-200 rounded-lg p-2 shadow-sm"
        aria-label="Open menu"
      >
        <svg
          className="w-6 h-6 text-[#1A2F4A]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          {sidebarOpen ? (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          ) : (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          )}
        </svg>
      </button>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setSidebarOpen(false);
          }}
          role="button"
          tabIndex={0}
          aria-label="Close menu"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-40
          w-64 bg-white border-r border-gray-200
          transform transition-transform duration-200 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          flex flex-col
        `}
      >
        {/* Doctor info */}
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-[#1A2F4A]">
            Dr. {displayName}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {doctor.specialty_ar}
          </p>
          <span className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
            ✓ Verified
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium
                  transition-colors duration-150
                  ${
                    isActive
                      ? 'bg-teal-50 text-teal-700 border-l-4 border-teal-600'
                      : 'text-[#1A2F4A] hover:bg-gray-50'
                  }
                `}
              >
                <span className="text-lg">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-gray-100">
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50"
          >
            {loggingOut ? (
              <span className="inline-block w-4 h-4 border-2 border-red-300 border-t-red-600 rounded-full animate-spin" />
            ) : (
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
            )}
            <span>Log out</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-h-screen overflow-x-hidden">
        {children}
      </main>
    </div>
  );
}
