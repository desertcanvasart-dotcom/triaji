'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { AdminRole } from '@/lib/auth/types';

interface ClinicSidebarProps {
  role: AdminRole;
  collapsed: boolean;
  onToggle: () => void;
  bookingMode?: string;
}

interface ClinicNavItem {
  label: string;
  href: string;
  icon: string;
  roles: string[];
  requiresSlots?: boolean; // Only show when booking mode is 'slots_only' or 'both'
}

const CLINIC_NAV_ITEMS: ClinicNavItem[] = [
  {
    label: 'لوحة التحكم',
    href: '/clinic/dashboard',
    icon: '🏥',
    roles: ['clinic_owner', 'platform_admin'],
  },
  {
    label: 'الاستقبال',
    href: '/clinic/reception',
    icon: '👥',
    roles: ['clinic_owner', 'clinic_receptionist', 'clinic_doctor', 'platform_admin'],
  },
  {
    label: 'المواعيد',
    href: '/clinic/appointments',
    icon: '📅',
    roles: ['clinic_owner', 'clinic_receptionist', 'platform_admin'],
    requiresSlots: true,
  },
  {
    label: 'الفواتير',
    href: '/clinic/billing',
    icon: '💰',
    roles: ['clinic_owner', 'clinic_billing', 'platform_admin'],
  },
  {
    label: 'الإعدادات',
    href: '/clinic/settings',
    icon: '⚙️',
    roles: ['clinic_owner', 'platform_admin'],
  },
];

export default function ClinicSidebar({ role, collapsed, onToggle, bookingMode }: ClinicSidebarProps) {
  const pathname = usePathname();
  const hasSlots = bookingMode === 'slots_only' || bookingMode === 'both';
  const filteredItems = CLINIC_NAV_ITEMS.filter(
    (item) => item.roles.includes(role) && (!item.requiresSlots || hasSlots)
  );

  return (
    <aside
      className={`fixed top-0 left-0 h-screen bg-indigo-700 text-white flex flex-col transition-all duration-300 z-40 ${
        collapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-5 border-b border-white/10">
        {!collapsed && (
          <h1 className="text-lg font-bold tracking-wide">عيادتي</h1>
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
            (item.href !== '/clinic/dashboard' && pathname.startsWith(item.href));

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
          <p className="text-xs text-white/50">Triajji Clinic</p>
        )}
      </div>
    </aside>
  );
}
