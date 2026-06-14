'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { AdminRole } from '@/lib/auth/types';

interface PharmacySidebarProps {
  role: AdminRole;
  collapsed: boolean;
  onToggle: () => void;
}

interface PharmacyNavItem {
  label: string;
  href: string;
  icon: string;
  roles: string[];
}

const PHARMACY_NAV_ITEMS: PharmacyNavItem[] = [
  {
    label: 'الوصفات الواردة',
    href: '/pharmacy/prescriptions',
    icon: '\uD83D\uDC8A',
    roles: ['pharmacy_owner', 'pharmacy_staff', 'platform_admin'],
  },
  {
    label: 'لوحة التحكم',
    href: '/pharmacy/dashboard',
    icon: '\uD83C\uDFE5',
    roles: ['pharmacy_owner', 'platform_admin'],
  },
  {
    label: 'الأدوية',
    href: '/pharmacy/medications',
    icon: '\uD83D\uDCE6',
    roles: ['pharmacy_owner', 'pharmacy_staff', 'platform_admin'],
  },
  {
    label: 'الفواتير',
    href: '/pharmacy/billing',
    icon: '\uD83D\uDCB0',
    roles: ['pharmacy_owner', 'pharmacy_billing', 'platform_admin'],
  },
  {
    label: 'الإعدادات',
    href: '/pharmacy/settings',
    icon: '\u2699\uFE0F',
    roles: ['pharmacy_owner', 'platform_admin'],
  },
];

export default function PharmacySidebar({ role, collapsed, onToggle }: PharmacySidebarProps) {
  const pathname = usePathname();
  const filteredItems = PHARMACY_NAV_ITEMS.filter((item) => item.roles.includes(role));

  return (
    <aside
      className={`fixed top-0 left-0 h-screen bg-purple-700 text-white flex flex-col transition-all duration-300 z-40 ${
        collapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-5 border-b border-white/10">
        {!collapsed && (
          <h1 className="text-lg font-bold tracking-wide">صيدليتي</h1>
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
            (item.href !== '/pharmacy/dashboard' && pathname.startsWith(item.href));

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
          <p className="text-xs text-white/50">Triajji Pharmacy</p>
        )}
      </div>
    </aside>
  );
}
