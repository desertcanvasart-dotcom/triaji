'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getRoleBadge, type AdminRole } from '@/lib/auth/types';
import { getSupabaseBrowser } from '@/lib/supabase/browser';

interface TopBarProps {
  name: string;
  role: AdminRole;
  sidebarCollapsed: boolean;
}

export default function TopBar({ name, role, sidebarCollapsed }: TopBarProps) {
  const router = useRouter();
  const { label, className } = getRoleBadge(role);

  async function handleSignOut() {
    const supabase = getSupabaseBrowser();
    await supabase.auth.signOut();

    // Clear the httpOnly session cookies server-side (JS can't clear httpOnly).
    await fetch('/api/admin/auth/session', { method: 'DELETE' });

    router.push('/login');
  }

  return (
    <header
      className={`fixed top-0 right-0 h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 z-30 transition-all duration-300 ${
        sidebarCollapsed ? 'left-16' : 'left-60'
      }`}
    >
      <div />
      <div className="flex items-center gap-4">
        <span className={`badge ${className}`}>{label}</span>
        <Link
          href="/account"
          className="text-sm font-medium text-gray-700 hover:text-teal-600 transition-colors"
          title="My account — set the mobile your password-reset codes go to"
        >
          {name}
        </Link>
        <button
          onClick={handleSignOut}
          className="text-sm text-gray-500 hover:text-red-600 transition-colors"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
