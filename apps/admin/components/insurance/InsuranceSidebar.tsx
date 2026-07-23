'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { AdminRole } from '@/lib/auth/types';

interface InsuranceSidebarProps {
  role: AdminRole;
  collapsed: boolean;
  onToggle: () => void;
}

interface InsuranceNavItem {
  label: string;
  href: string;
  icon: string;
  roles: string[];
}

const INSURANCE_NAV_ITEMS: InsuranceNavItem[] = [
  {
    label: '\u0644\u0648\u062D\u0629 \u0627\u0644\u062A\u062D\u0643\u0645',
    href: '/insurance/dashboard',
    icon: '\uD83C\uDFDB\uFE0F',
    roles: ['insurance_admin', 'platform_admin'],
  },
  {
    label: '\u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u0627\u0644\u0628\u0648\u0644\u064A\u0635\u0627\u062A',
    href: '/insurance/verifications',
    icon: '\u2713',
    roles: ['insurance_admin', 'insurance_reviewer', 'platform_admin'],
  },
  {
    label: '\u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0627\u062A \u0627\u0644\u0645\u0633\u0628\u0642\u0629',
    href: '/insurance/pre-auth',
    icon: '\uD83D\uDCCB',
    roles: ['insurance_admin', 'insurance_reviewer', 'platform_admin'],
  },
  {
    label: '\u0627\u0644\u0645\u0637\u0627\u0644\u0628\u0627\u062A',
    href: '/insurance/claims',
    icon: '\uD83D\uDCC4',
    roles: ['insurance_admin', 'insurance_reviewer', 'platform_admin'],
  },
  {
    label: '\u0627\u0644\u062A\u0633\u0648\u064A\u0627\u062A',
    href: '/insurance/remittance',
    icon: '\uD83D\uDCB0',
    roles: ['insurance_admin', 'insurance_finance', 'platform_admin'],
  },
  {
    label: '\u0627\u0644\u0625\u0639\u062F\u0627\u062F\u0627\u062A',
    href: '/insurance/settings',
    icon: '\u2699\uFE0F',
    roles: ['insurance_admin', 'platform_admin'],
  },
];

export default function InsuranceSidebar({ role, collapsed, onToggle }: InsuranceSidebarProps) {
  const pathname = usePathname();
  const filteredItems = INSURANCE_NAV_ITEMS.filter((item) => item.roles.includes(role));

  return (
    <aside
      className={`fixed top-0 left-0 h-screen bg-amber-700 text-white flex flex-col transition-all duration-300 z-40 ${
        collapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-5 border-b border-white/10">
        {!collapsed && (
          <h1 className="text-lg font-bold tracking-wide">{'\u0627\u0644\u062A\u0623\u0645\u064A\u0646'}</h1>
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
            (item.href !== '/insurance/dashboard' && pathname.startsWith(item.href));

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
          <p className="text-xs text-white/50">DoctorTrio Insurance</p>
        )}
      </div>
    </aside>
  );
}
