'use client';

import { useState } from 'react';
import ClinicSidebar from './ClinicSidebar';
import TopBar from './TopBar';
import type { AdminRole } from '@/lib/auth/types';

interface ClinicShellProps {
  children: React.ReactNode;
  name: string;
  role: AdminRole;
  bookingMode?: string;
}

export default function ClinicShell({ children, name, role, bookingMode }: ClinicShellProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      <ClinicSidebar
        role={role}
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
        bookingMode={bookingMode}
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
