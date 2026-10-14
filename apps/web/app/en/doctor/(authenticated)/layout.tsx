'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { DoctorViewProvider, ASSISTANT_PREVIEW_KEY } from '@/components/doctor/DoctorViewContext';

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
  role?: 'doctor' | 'assistant';
  assistant?: { id: string; name: string };
}

interface NavItem {
  label: string;
  icon: string;
  href: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const NAV_ITEMS: NavItem[] = [
  { label: 'Today', icon: '🩺', href: '/en/doctor/today' },
  { label: 'My Appointments', icon: '📅', href: '/en/doctor/dashboard' },
  { label: 'Calendar', icon: '📆', href: '/en/doctor/calendar' },
  { label: 'My Availability', icon: '🗓️', href: '/en/doctor/availability' },
  { label: 'Followed Patients', icon: '👥', href: '/en/doctor/patients' },
  { label: 'Patient Summaries', icon: '📋', href: '/en/doctor/dashboard' },
  { label: 'Quick Intake', icon: '⚡', href: '/en/doctor/quick-intake' },
  { label: 'Exam fields', icon: '🧾', href: '/en/doctor/exam-fields' },
  { label: 'Assistants', icon: '🧑‍💼', href: '/en/doctor/assistants' },
  { label: 'Settings', icon: '⚙️', href: '/en/doctor/settings' },
];

/** The only pages an assistant (migration 077) may open — the front desk. */
const ASSISTANT_PATHS = ['/en/doctor/today', '/en/doctor/calendar'];

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
  const [assistantName, setAssistantName] = useState<string | null>(null);
  const isAssistant = assistantName !== null;
  // A doctor can preview exactly what their assistant sees (client-side only —
  // the server keeps treating them as the doctor).
  const [previewAssistant, setPreviewAssistant] = useState(false);
  const viewAsAssistant = isAssistant || previewAssistant;
  const assistantBlocked = viewAsAssistant && !ASSISTANT_PATHS.some((p) => pathname.startsWith(p));

  useEffect(() => {
    try {
      setPreviewAssistant(sessionStorage.getItem(ASSISTANT_PREVIEW_KEY) === '1');
    } catch {
      // Storage unavailable — no preview.
    }
  }, []);

  const togglePreview = useCallback(
    (on: boolean) => {
      try {
        if (on) sessionStorage.setItem(ASSISTANT_PREVIEW_KEY, '1');
        else sessionStorage.removeItem(ASSISTANT_PREVIEW_KEY);
      } catch {
        // Preview just won't survive a reload.
      }
      setPreviewAssistant(on);
      if (on) router.push('/en/doctor/today');
    },
    [router]
  );

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

        setAssistantName(data.role === 'assistant' ? (data.assistant?.name ?? '') : null);
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

  // Assistants only work the front desk — send them there from anywhere else.
  useEffect(() => {
    if (assistantBlocked) router.replace('/en/doctor/today');
  }, [assistantBlocked, router]);

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

  if (!doctor || assistantBlocked) {
    return null;
  }

  const navItems = viewAsAssistant ? NAV_ITEMS.filter((item) => ASSISTANT_PATHS.includes(item.href)) : NAV_ITEMS;

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
          {assistantName ? (
            <>
              <h2 className="text-lg font-bold text-[#1A2F4A]">{assistantName}</h2>
              <p className="text-sm text-gray-500 mt-1">Assistant to Dr. {displayName}</p>
              <span className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">
                Assistant
              </span>
            </>
          ) : (
            <>
              <h2 className="text-lg font-bold text-[#1A2F4A]">
                Dr. {displayName}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {doctor.specialty_ar}
              </p>
              <span className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                ✓ Verified
              </span>
            </>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
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

        {/* Doctor-only: preview the assistant's view */}
        {!isAssistant && (
          <div className="px-4 pb-2">
            <button
              type="button"
              onClick={() => togglePreview(!previewAssistant)}
              className={`w-full px-4 py-2 rounded-lg text-xs font-medium border transition-colors ${
                previewAssistant
                  ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700'
                  : 'bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50'
              }`}
            >
              {previewAssistant ? 'Back to doctor view' : '👁 View as assistant'}
            </button>
          </div>
        )}

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
        {previewAssistant && !isAssistant && (
          <div className="sticky top-0 z-20 bg-indigo-600 text-white text-sm px-4 py-2 flex flex-wrap items-center justify-center gap-3">
            <span>Preview: you are seeing the portal as your assistant sees it.</span>
            <button
              type="button"
              onClick={() => togglePreview(false)}
              className="underline font-semibold hover:no-underline"
            >
              Back to doctor view
            </button>
          </div>
        )}
        <DoctorViewProvider value={{ role: viewAsAssistant ? 'assistant' : 'doctor', preview: previewAssistant && !isAssistant }}>
          {children}
        </DoctorViewProvider>
      </main>
    </div>
  );
}
