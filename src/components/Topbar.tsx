"use client";

import React, { useState, useEffect } from "react";
import { Sun, Moon, WifiOff, Download, Menu, RefreshCw, CloudUpload, AlertTriangle } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import AppLogo from "@/components/ui/AppLogo";

export default function Topbar() {
  const { theme, toggleTheme, toggleSidebar, isOnline, pendingSyncCount, isSyncing, syncQueueHealthy } = useAppStore();
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null);

  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
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
        <span className="font-semibold text-sm text-foreground">
          SI WorkLog
        </span>
      </div>

      <div className="flex-1" />

      {/* Sync status */}
      {!isOnline && (
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 rounded-full text-xs font-medium">
          <WifiOff size={12} />
          <span>Offline</span>
        </div>
      )}

      {isOnline && pendingSyncCount > 0 && (
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full text-xs font-medium">
          <CloudUpload size={12} />
          <span>{pendingSyncCount} pending</span>
        </div>
      )}

      {isOnline && isSyncing && (
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-full text-xs font-medium">
          <RefreshCw size={12} className="animate-spin" />
          <span>Syncing...</span>
        </div>
      )}

      {!syncQueueHealthy && (
        <div
          title="The local sync queue could not be read. Pending offline changes were backed up in the browser under localStorage key 'paintpro-sync-queue-backup' — contact an admin to recover/re-queue them."
          className="flex items-center gap-1.5 px-2.5 py-1 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded-full text-xs font-medium"
        >
          <AlertTriangle size={12} />
          <span>Sync queue damaged</span>
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
        {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
      </button>
    </header>
  );
}

// Extend window for beforeinstallprompt
declare global {
  interface BeforeInstallPromptEvent extends Event {
    prompt?: () => Promise<void>;
    userChoice?: Promise<{ outcome: "accepted" | "dismissed" }>;
  }
}
