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

// Auto-seed machinery — module-scoped so it survives route changes. The structure
// blueprint (2 sites + 7 categories) is pushed automatically the first time an
// admin has the app loaded, retrying up to 3 times per session with a growing
// delay. It is fully idempotent: only MISSING default docs are ever written
// (admin edits like custom addresses are preserved).
let adminSeeded = false;
let adminSeedAttempt = 0;
let adminSeedTimer: ReturnType<typeof setTimeout> | null = null;
const ADMIN_SEED_MAX_ATTEMPTS = 3;
const ADMIN_SEED_DELAYS_MS = [0, 8000, 20000];

function scheduleAdminSeed(seedDefaults: () => Promise<unknown>): void {
  if (adminSeeded || adminSeedTimer) return;
  const attempt = adminSeedAttempt + 1;
  if (attempt > ADMIN_SEED_MAX_ATTEMPTS) return;
  adminSeedAttempt = attempt;
  adminSeedTimer = setTimeout(
    () => {
      adminSeedTimer = null;
      seedDefaults()
        .then((result) => {
          const failures =
            (result as { failures?: string[] } | null)?.failures ?? [];
          if (failures.length > 0) {
            console.warn("Structure blueprint push incomplete:", failures);
            scheduleAdminSeed(seedDefaults);
            return;
          }
          adminSeeded = true;
        })
        .catch((error: unknown) => {
          console.warn(
            `Auto-seed of the structure blueprint failed ` +
              `(attempt ${attempt}/${ADMIN_SEED_MAX_ATTEMPTS}, non-fatal). ` +
              "Retrying is automatic; you can also use Admin → Sites & Categories → Seed defaults.",
            error,
          );
          scheduleAdminSeed(seedDefaults);
        });
    },
    ADMIN_SEED_DELAYS_MS[attempt - 1] ?? 0,
  );
}

export default function AppLayout({ children }: AppLayoutProps) {
  const {
    theme,
    sidebarCollapsed,
    loadAll,
    isLoaded,
    startLiveSync,
    seedDefaults,
  } =
    useAppStore();
  const { user, status, authorized, role, accessError, logOut } = useAuthStore();
  const router = useRouter();

  // Auth is "decided" once the allowlist check has resolved. An admin may still
  // have `authorized === null` ifthe app_users read failed — treat as allowed so that
  // the default-admin fallback keeps working.

  const decided =
    status === "authenticated" && (authorized === true || authorized === null);

  useEffect(() => {
    if (!isLoaded) loadAll();
  }, [isLoaded, loadAll]);

  // Push the structure blueprint (sites + categories) the first time an admin
  // opens the app with data loaded. Writes only what is missing — the writes are
  // small (2 sites + 7 categories) and go through the same `seedDefaults`
  // path as the Admin → "Seed defaults" button, with automatic retries.
  useEffect(() => {
    if (decided && role === "admin" && isLoaded) {
      scheduleAdminSeed(seedDefaults);
    }
  }, [decided, role, isLoaded, seedDefaults]);

  // Start the real-time listener once auth is resolved so form changes made on
  // other devices reflect live (covers the case where loadAll ran before the
  // user/role were known). `startLiveSync` is a stable module-level function,
  // so it's safe to omit from the dependency array — this effect only needs to
  // fire when auth state changes.
  useEffect(() => {
    if (decided) startLiveSync();
  }, [decided, status, authorized]);

  // Gate the app: unauthenticated users are sent to /login.
  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  // "Deciding" only while the allowlist check is genuinely in flight. If the
  // check FAILED (accessError set, authorized still null — e.g. the database
  // is unreachable), we let the user in rather than spinning forever: the
  // security rules still protect all data, and reads stay empty until the
  // connection returns.
  const deciding =
    status === "loading" ||
    (status === "authenticated" && authorized === null && !accessError);

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
