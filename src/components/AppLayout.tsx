'use client';

import React, { useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { theme, sidebarCollapsed, loadJobs, isLoaded } = useAppStore();

  useEffect(() => {
    if (!isLoaded) loadJobs();
  }, [isLoaded, loadJobs]);

  return (
    <div className={theme === 'dark' ? 'dark' : ''}>
      <div className="flex h-screen bg-background text-foreground overflow-hidden">
        <Sidebar />
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <Topbar />
          <main
            className="flex-1 overflow-y-auto scrollbar-thin"
            style={{ paddingLeft: sidebarCollapsed ? '0' : '0' }}
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}