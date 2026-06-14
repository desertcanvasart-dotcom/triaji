'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { AdminRole } from '@/lib/auth/types';

interface LabSidebarProps {
  role: AdminRole;
  collapsed: boolean;
  onToggle: () => void;
}

interface LabNavItem {
  label: string;
  href: string;
  icon: string;
  roles: string[];
}

const LAB_NAV_ITEMS: LabNavItem[] = [
  {
    label: 'لوحة التحكم',
    href: '/lab/dashboard',
    icon: '🧪',
    roles: ['lab_owner', 'platform_admin'],
  },
  {
    label: 'الاستقبال',
    href: '/lab/reception',
    icon: '👥',
    roles: ['lab_owner', 'lab_receptionist', 'platform_admin'],
  },
  {
    label: 'الطلبات الواردة',
    href: '/lab/orders',
    icon: '📋',
    roles: ['lab_owner', 'lab_technician', 'platform_admin'],
  },
  {
    label: 'رفع النتائج',
    href: '/lab/results',
    icon: '🔬',
    roles: ['lab_technician', 'lab_owner', 'platform_admin'],
  },
  {
    label: 'الفواتير',
    href: '/lab/billing',
    icon: '💰',
    roles: ['lab_owner', 'lab_billing', 'platform_admin'],
  },
  {
    label: 'الإعدادات',
    href: '/lab/settings',
    icon: '⚙️',
    roles: ['lab_owner', 'platform_admin'],
  },
];

export default function LabSidebar({ role, collapsed, onToggle }: LabSidebarProps) {
  const pathname = usePathname();
  const filteredItems = LAB_NAV_ITEMS.filter((item) => item.roles.includes(role));

  return (
    <aside
      className={`fixed top-0 left-0 h-screen bg-emerald-700 text-white flex flex-col transition-all duration-300 z-40 ${
        collapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-5 border-b border-white/10">
        {!collapsed && (
          <h1 className="text-lg font-bold tracking-wide">مختبري</h1>
        )}
        <button
          onClick={onToggle}
          className="text-white/70 hover:text-white p-1"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? '→' : '←'}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {filteredItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== '/lab/dashboard' && pathname.startsWith(item.href));

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
          <p className="text-xs text-white/50">Triajji Lab</p>
        )}
      </div>
    </aside>
  );
}
