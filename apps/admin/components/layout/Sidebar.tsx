'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { AdminRole } from '@/lib/auth/types';
import { isPlatformAdmin, isIcuHospitalRole } from '@/lib/auth/types';

interface SidebarProps {
  role: AdminRole;
  collapsed: boolean;
  onToggle: () => void;
}

interface NavItem {
  label: string;
  href: string;
  icon: string;
  platformOnly?: boolean;
  roles?: AdminRole[];
  section?: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: '🏥' },
  { label: 'Doctors', href: '/doctors', icon: '👨‍⚕️' },
  { label: 'Bookings', href: '/bookings', icon: '📅' },
  { label: 'Analytics', href: '/analytics', icon: '📊' },
  { label: 'Phone Calls', href: '/calls', icon: '📞' },
  { label: 'Widget & Embed', href: '/widget', icon: '⚙️' },
  { label: 'Tenants', href: '/tenants', icon: '🏢', platformOnly: true },
  { label: 'Knowledge Base', href: '/knowledge-base', icon: '📚', platformOnly: true },
  { label: 'Emergency Rules', href: '/emergency-rules', icon: '🚨', platformOnly: true },
  { label: 'Doctor Verification', href: '/doctor-verification', icon: '🩺', platformOnly: true },
  { label: 'Clinical Documents', href: '/clinical-documents', icon: '📄', platformOnly: true },
];

const ICU_NAV_ITEMS: NavItem[] = [
  { label: 'ICU Setup', href: '/icu/setup', icon: '🏥', section: 'ICU', roles: ['tenant_admin'] },
  { label: 'ICU Beds', href: '/icu/beds', icon: '🛏️', section: 'ICU', roles: ['tenant_admin', 'tenant_manager', 'icu_coordinator'] },
  { label: 'Transfers', href: '/icu/transfers', icon: '🚨', section: 'ICU', roles: ['tenant_admin', 'tenant_manager', 'icu_coordinator'] },
];

export default function Sidebar({ role, collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const filteredItems = NAV_ITEMS.filter(
    (item) => !item.platformOnly || isPlatformAdmin(role)
  );

  const showIcu = isIcuHospitalRole(role) || isPlatformAdmin(role);
  const filteredIcuItems = ICU_NAV_ITEMS.filter(
    (item) => !item.roles || item.roles.includes(role) || isPlatformAdmin(role)
  );

  return (
    <aside
      className={`fixed top-0 left-0 h-screen bg-teal-600 text-white flex flex-col transition-all duration-300 z-40 ${
        collapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-5 border-b border-white/10">
        {!collapsed && (
          <h1 className="text-lg font-bold tracking-wide">Triajji Admin</h1>
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
            (item.href !== '/dashboard' && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-link ${
                isActive ? 'sidebar-link-active' : 'sidebar-link-inactive'
              }`}
              title={collapsed ? item.label : undefined}
            >
              <span className="text-lg flex-shrink-0">{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}

        {showIcu && filteredIcuItems.length > 0 && (
          <>
            {!collapsed && (
              <div className="pt-4 pb-1 px-3 text-xs font-semibold text-white/50 uppercase tracking-wider">
                ICU
              </div>
            )}
            {collapsed && <div className="pt-3 border-t border-white/10 mt-2" />}
            {filteredIcuItems.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`sidebar-link ${
                    isActive ? 'sidebar-link-active' : 'sidebar-link-inactive'
                  }`}
                  title={collapsed ? item.label : undefined}
                >
                  <span className="text-lg flex-shrink-0">{item.icon}</span>
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="px-4 py-3 border-t border-white/10 text-xs text-white/50">
          Triajji v1.0
        </div>
      )}
    </aside>
  );
}
