"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/store/useAppStore";
import { useAuthStore } from "@/store/useAuthStore";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { Loader2, LogOut } from "lucide-react";

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { theme, sidebarCollapsed, loadJobs, isLoaded } = useAppStore();
  const { user, status, authorized, accessError, logOut } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) loadJobs();
  }, [isLoaded, loadJobs]);

  // Gate the app: unauthenticated users are sent to /login.
  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  const deciding =
    status === "loading" || (status === "authenticated" && authorized === null);

  if (deciding || status === "unauthenticated") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 size={28} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (status === "authenticated" && authorized === false) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center">
        <div className="text-5xl mb-4">🔒</div>
        <h1 className="text-xl font-semibold text-foreground">
          Not Authorized
        </h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-md">
          Your email{" "}
          <span className="font-medium text-foreground">{user?.email}</span> has
          not been added to the access list. Ask an admin to add it in the Admin
          panel before you can use the app.
        </p>
        {accessError && (
          <p className="text-xs text-amber-600 mt-3 max-w-md">{accessError}</p>
        )}
        <button
          onClick={logOut}
          className="mt-5 flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <LogOut size={15} /> Sign out
        </button>
      </div>
    );
  }

  return (
    <div className={theme === "dark" ? "dark" : ""}>
      <div className="flex h-screen bg-background text-foreground overflow-hidden">
        <Sidebar />
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <Topbar />
          <main
            className="flex-1 overflow-y-auto scrollbar-thin"
            style={{ paddingLeft: sidebarCollapsed ? "0" : "0" }}
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
