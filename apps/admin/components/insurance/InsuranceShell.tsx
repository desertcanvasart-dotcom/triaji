'use client';

import { useState } from 'react';
import InsuranceSidebar from './InsuranceSidebar';
import TopBar from '../layout/TopBar';
import type { AdminRole } from '@/lib/auth/types';

interface InsuranceShellProps {
  children: React.ReactNode;
  name: string;
  role: AdminRole;
}

export default function InsuranceShell({ children, name, role }: InsuranceShellProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      <InsuranceSidebar
        role={role}
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
      />
      <TopBar name={name} role={role} sidebarCollapsed={collapsed} />
      <main
        className={`pt-14 transition-all duration-300 ${
          collapsed ? 'ml-16' : 'ml-60'
        }`}
      >
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
