'use client';

import { useState } from 'react';
import PharmacySidebar from './PharmacySidebar';
import TopBar from './TopBar';
import type { AdminRole } from '@/lib/auth/types';

interface PharmacyShellProps {
  children: React.ReactNode;
  name: string;
  role: AdminRole;
}

export default function PharmacyShell({ children, name, role }: PharmacyShellProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      <PharmacySidebar
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
