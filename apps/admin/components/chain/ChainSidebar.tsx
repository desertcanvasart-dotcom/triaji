'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { AdminRole } from '@/lib/auth/types';

interface ChainSidebarProps {
  role: AdminRole;
  collapsed: boolean;
  onToggle: () => void;
}

interface ChainNavItem {
  label: string;
  href: string;
  icon: string;
  roles: string[];
}

const CHAIN_NAV_ITEMS: ChainNavItem[] = [
  {
    label: 'Chain Dashboard',
    href: '/chain/dashboard',
    icon: '\u{1F3E2}',
    roles: ['chain_owner', 'platform_admin'],
  },
  {
    label: 'Branches',
    href: '/chain/branches',
    icon: '\u{1F3EA}',
    roles: ['chain_owner', 'platform_admin'],
  },
  {
    label: 'Doctors',
    href: '/chain/doctors',
    icon: '\u{1F468}\u{200D}\u{2695}\u{FE0F}',
    roles: ['chain_owner', 'platform_admin'],
  },
  {
    label: 'Patients',
    href: '/chain/patients',
    icon: '\u{1F465}',
    roles: ['chain_owner', 'platform_admin'],
  },
  {
    label: 'Pricing',
    href: '/chain/pricing',
    icon: '\u{1F4B0}',
    roles: ['chain_owner', 'platform_admin'],
  },
  {
    label: 'Analytics',
    href: '/chain/analytics',
    icon: '\u{1F4CA}',
    roles: ['chain_owner', 'platform_admin'],
  },
  {
    label: 'Settings',
    href: '/chain/settings',
    icon: '\u{2699}\u{FE0F}',
    roles: ['chain_owner', 'platform_admin'],
  },
];

export default function ChainSidebar({ role, collapsed, onToggle }: ChainSidebarProps) {
  const pathname = usePathname();
  const filteredItems = CHAIN_NAV_ITEMS.filter((item) => item.roles.includes(role));

  return (
    <aside
      className={`fixed top-0 left-0 h-screen bg-violet-700 text-white flex flex-col transition-all duration-300 z-40 ${
        collapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-5 border-b border-white/10">
        {!collapsed && (
          <h1 className="text-lg font-bold tracking-wide">Chain Admin</h1>
        )}
        <button
          onClick={onToggle}
          className="text-white/70 hover:text-white p-1"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? '\u2192' : '\u2190'}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {filteredItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== '/chain/dashboard' && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-white/20 text-white'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
              }`}
              title={collapsed ? item.label : undefined}
            >
              <span className="text-lg flex-shrink-0">{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-white/10">
        {!collapsed && (
          <p className="text-xs text-white/50">Triajji Chain</p>
        )}
      </div>
    </aside>
  );
}
