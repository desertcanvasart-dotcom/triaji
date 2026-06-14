'use client';

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

    // Clear cookies
    document.cookie = 'sb-access-token=; path=/; max-age=0';
    document.cookie = 'sb-refresh-token=; path=/; max-age=0';

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
        <span className="text-sm font-medium text-gray-700">{name}</span>
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
