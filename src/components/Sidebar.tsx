'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Briefcase, FileText, Settings, Database, ChevronLeft, ChevronRight,  } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';


const NAV_ITEMS = [
  { key: 'nav-dashboard', href: '/', label: 'Dashboard', icon: LayoutDashboard, badge: null },
  { key: 'nav-jobs', href: '/jobs', label: 'Jobs', icon: Briefcase, badge: null },
  { key: 'nav-forms', href: '/form-editor', label: 'Form Editor', icon: FileText, badge: null },
  { key: 'nav-arc', href: '/arc', label: 'ARC Rates', icon: Database, badge: null },
];

export default function Sidebar() {
  const { sidebarCollapsed, toggleSidebar, jobs } = useAppStore();
  const pathname = usePathname();

  const pendingCount = jobs?.filter((j) => j?.status === 'Pending')?.length;

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        data-sidebar
        className={`
          hidden lg:flex flex-col bg-card border-r border-border sidebar-transition
          ${sidebarCollapsed ? 'w-sidebar-collapsed' : 'w-sidebar'}
          flex-shrink-0 z-20
        `}
      >
        {/* Logo */}
        <div
          className={`flex items-center h-topbar border-b border-border px-3 gap-3 ${
            sidebarCollapsed ? 'justify-center' : ''
          }`}
        >
          <AppLogo size={32} />
          {!sidebarCollapsed && (
            <span className="font-semibold text-base text-foreground tracking-tight">
SI WorkLog
            </span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 flex flex-col gap-1 px-2">
          {NAV_ITEMS?.map((item) => {
            const isActive =
              item?.href === '/'
                ? pathname === '/'
                : pathname === item?.href || pathname?.startsWith(item?.href + '/') ||
                  (item?.href === '/jobs' && pathname === '/job-detail');
            const Icon = item?.icon;
            return (
              <Link
                key={item?.key}
                href={item?.href}
                title={sidebarCollapsed ? item?.label : undefined}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium
                  transition-all duration-150 group relative
                  ${
                    isActive
                      ? 'bg-primary/10 text-primary' :'text-muted-foreground hover:bg-secondary hover:text-foreground'
                  }
                  ${sidebarCollapsed ? 'justify-center' : ''}
                `}
              >
                <Icon size={18} className="flex-shrink-0" />
                {!sidebarCollapsed && <span>{item?.label}</span>}
                {!sidebarCollapsed && item?.label === 'Jobs' && pendingCount > 0 && (
                  <span className="ml-auto text-xs bg-accent text-accent-foreground rounded-full px-1.5 py-0.5 font-tabular">
                    {pendingCount}
                  </span>
                )}
                {sidebarCollapsed && item?.label === 'Jobs' && pendingCount > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-accent rounded-full" />
                )}
                {/* Tooltip for collapsed */}
                {sidebarCollapsed && (
                  <span className="absolute left-full ml-2 px-2 py-1 bg-foreground text-background text-xs rounded whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                    {item?.label}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="border-t border-border p-2 flex flex-col gap-1">
          <Link
            href="#settings"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-all ${
              sidebarCollapsed ? 'justify-center' : ''
            }`}
          >
            <Settings size={18} />
            {!sidebarCollapsed && <span>Settings</span>}
          </Link>
          <button
            onClick={toggleSidebar}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-all ${
              sidebarCollapsed ? 'justify-center' : ''
            }`}
          >
            {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            {!sidebarCollapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>
      {/* Mobile bottom tab bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border z-30 flex no-print">
        {NAV_ITEMS?.map((item) => {
          const isActive =
            item?.href === '/'
              ? pathname === '/'
              : pathname === item?.href || pathname?.startsWith(item?.href + '/') ||
                (item?.href === '/jobs' && pathname === '/job-detail');
          const Icon = item?.icon;
          return (
            <Link
              key={`mob-${item?.key}`}
              href={item?.href}
              className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs font-medium transition-colors ${
                isActive ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <Icon size={20} />
              <span>{item?.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}