'use client';

import { useState } from 'react';
import LabSidebar from './LabSidebar';
import TopBar from './TopBar';
import type { AdminRole } from '@/lib/auth/types';

interface LabShellProps {
  children: React.ReactNode;
  name: string;
  role: AdminRole;
}

export default function LabShell({ children, name, role }: LabShellProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      <LabSidebar
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
