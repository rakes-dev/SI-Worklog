'use client';

import React, { useState, useEffect } from 'react';
import { Sun, Moon, WifiOff, Download, Menu } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import AppLogo from '@/components/ui/AppLogo';

export default function Topbar() {
  const { theme, toggleTheme, toggleSidebar } = useAppStore();
  const [isOffline, setIsOffline] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null);

  useEffect(() => {
    setIsOffline(!navigator.onLine);
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    const promptEvent = installPrompt as BeforeInstallPromptEvent;
    promptEvent.prompt?.();
    setInstallPrompt(null);
  };

  return (
    <header
      data-topbar
      className="h-topbar bg-card border-b border-border flex items-center px-4 gap-3 flex-shrink-0 no-print z-10"
    >
      {/* Mobile menu */}
      <button
        onClick={toggleSidebar}
        className="lg:hidden p-2 rounded-md text-muted-foreground hover:bg-secondary transition-colors"
        aria-label="Toggle menu"
      >
        <Menu size={20} />
      </button>

      {/* Mobile logo */}
      <div className="lg:hidden flex items-center gap-2">
        <AppLogo size={28} />
        <span className="font-semibold text-sm text-foreground">SI WorkLog</span>
      </div>

      <div className="flex-1" />

      {/* Offline indicator */}
      {isOffline && (
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 rounded-full text-xs font-medium">
          <WifiOff size={12} />
          <span>Offline</span>
        </div>
      )}

      {/* Install PWA */}
      {installPrompt && (
        <button
          onClick={handleInstall}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-xs font-medium hover:opacity-90 transition-opacity scale-press"
        >
          <Download size={13} />
          Install App
        </button>
      )}

      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        className="p-2 rounded-md text-muted-foreground hover:bg-secondary transition-colors"
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>
    </header>
  );
}

// Extend window for beforeinstallprompt
declare global {
  interface BeforeInstallPromptEvent extends Event {
    prompt?: () => Promise<void>;
    userChoice?: Promise<{ outcome: 'accepted' | 'dismissed' }>;
  }
}