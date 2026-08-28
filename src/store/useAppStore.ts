"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Job, PaintForm } from "@/types";
import { dbService } from "@/services/db";
import { syncService } from "@/services/sync";
import type { useAuthStore as AuthStoreType } from "@/store/useAuthStore";

interface AppStore {
  jobs: Job[];
  theme: "light" | "dark";
  sidebarCollapsed: boolean;
  isLoaded: boolean;
  isOnline: boolean;
  pendingSyncCount: number;
  isSyncing: boolean;
  syncQueueHealthy: boolean;

  // Actions
  loadJobs: () => Promise<void>;
  addJob: (job: Job) => Promise<void>;
  updateJob: (job: Job) => Promise<void>;
  deleteJob: (id: string) => Promise<void>;
  restoreJob: (id: string) => Promise<void>;
  duplicateJob: (id: string) => Promise<Job>;
  addForm: (jobId: string, form: PaintForm) => Promise<void>;
  updateForm: (jobId: string, form: PaintForm) => Promise<void>;
  deleteForm: (jobId: string, formId: string) => Promise<void>;
  permanentlyDeleteForm: (jobId: string, formId: string) => Promise<void>;
  restoreForm: (jobId: string, formId: string) => Promise<void>;
  duplicateForm: (jobId: string, formId: string) => Promise<void>;
  copyFormToJob: (
    sourceJobId: string,
    formId: string,
    targetJobId: string,
  ) => Promise<void>;
  toggleTheme: () => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (v: boolean) => void;
}

function recalcJobTotal(job: Job): Job {
  const total = job.forms.reduce((sum, f) => sum + (f.grandTotal || 0), 0);
  return { ...job, totalAmount: total };
}

function timestampMs(value: string | undefined): number {
  if (!value) return 0;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

/**
 * Merge server data with local data WITHOUT EVER dropping newer local edits.
 *
 * - Server data wins for a job only when it is not older than the local copy.
 * - If the local copy is strictly newer (e.g. edited offline while the sync
 *   queue was lost), keep the local copy and return it in `needSync` so it is
 *   re-queued — never silently overwritten by a stale server document.
 * - Local jobs with no server counterpart were never uploaded: keep + re-queue.
 */
function mergeServerAndLocalJobs(
  localJobs: Job[],
  serverJobs: Job[],
): { jobs: Job[]; needSync: Job[] } {
  const localById = new Map(localJobs.map((job) => [job.id, job]));
  const serverIds = new Set(serverJobs.map((job) => job.id));
  const needSync: Job[] = [];

  const resolved = serverJobs.map((serverJob) => {
    const localJob = localById.get(serverJob.id);
    if (!localJob) return serverJob;
    if (timestampMs(localJob.updatedAt) > timestampMs(serverJob.updatedAt)) {
      // Local is newer — keep it and re-queue it so it reaches the server.
      needSync.push(localJob);
      return localJob;
    }
    return serverJob;
  });

  // Jobs that only exist locally were never uploaded (or their queue entry was
  // lost) — keep them and re-queue so they aren't lost on the next load.
  const localOnly = localJobs
    .filter((job) => !serverIds.has(job.id))
    .sort((a, b) => timestampMs(b.createdAt) - timestampMs(a.createdAt));
  localOnly.forEach((job) => needSync.push(job));

  return { jobs: [...localOnly, ...resolved], needSync };
}

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      jobs: [],
      theme: "light",
      sidebarCollapsed: false,
      isLoaded: false,
      isOnline: syncService.getOnlineStatus(),
      pendingSyncCount: syncService.getPendingCount(),
      isSyncing: syncService.isSyncing(),
      syncQueueHealthy: syncService.isQueueHealthy(),

      loadJobs: async () => {
        // Always mark as loaded immediately so UI doesn't hang
        // Local persisted data is already available from zustand persist middleware
        set({ isLoaded: true });

        // Subscribe to sync state changes
        syncService.subscribe((state) => {
          set({
            isOnline: state.isOnline,
            pendingSyncCount: state.pendingCount,
            isSyncing: state.syncing,
            syncQueueHealthy: state.queueHealthy,
          });
        });

        // Try Firestore sync in background (best-effort, non-blocking)
        // Dynamically import to avoid circular dependency
        try {
          const { useAuthStore } = await import("@/store/useAuthStore");
          const { user, role } = useAuthStore.getState();
          const isAdmin = role === "admin";

          const applyServerMerge = (serverJobs: Job[]) => {
            const localJobs = get().jobs;
            const { jobs: merged, needSync } = mergeServerAndLocalJobs(
              localJobs,
              serverJobs,
            );
            // Re-queue anything that is newer locally or only exists locally so
            // the next flush pushes it up — never silently dropped.
            needSync.forEach((job) => syncService.queueJobSync(job));
            if (merged.length > 0) set({ jobs: merged });
          };
          const warnLocalFallback = (error: unknown) => {
            console.warn(
              "Firestore sync unavailable, using local data.",
              error,
            );
          };

          if (isAdmin) {
            dbService
              .getAllJobs()
              .then(applyServerMerge)
              .catch(warnLocalFallback);
          } else if (user?.email) {
            dbService
              .getUserJobs(user.email)
              .then(applyServerMerge)
              .catch(warnLocalFallback);
          }
        } catch (error) {
          console.warn("Could not load user info", error);
        }

        // Flush any pending syncs if online (e.g. changes made while offline)
        if (syncService.getOnlineStatus()) {
          syncService.flushPendingSyncs().catch((error) => {
            console.warn("Could not flush pending syncs on load:", error);
          });
        }
      },

      addJob: async (job) => {
        // Auto-assign userId to job if not already set
        try {
          const { useAuthStore } = await import("@/store/useAuthStore");
          const { user } = useAuthStore.getState();
          const jobWithUserId =
            user?.email && !job.userId ? { ...job, userId: user.email } : job;
          // Update local state immediately (persisted to localStorage via persist middleware)
          set((s) => ({ jobs: [jobWithUserId, ...s.jobs] }));
          // Queue for Firestore sync (local-first: stays local until synced)
          syncService.queueJobSync(jobWithUserId);
        } catch (error) {
          console.warn("Could not assign userId to job:", error);
          set((s) => ({ jobs: [job, ...s.jobs] }));
          syncService.queueJobSync(job);
        }
      },

      updateJob: async (job) => {
        const updated = recalcJobTotal(job);
        set((s) => ({
          jobs: s.jobs.map((j) => (j.id === updated.id ? updated : j)),
        }));
        syncService.queueJobSync(updated);
      },

      deleteJob: async (id) => {
        const job = get().jobs.find((j) => j.id === id);
        if (!job) return;
        // Soft delete: keep the job but mark it as deleted so it can be restored.
        const nowIso = new Date().toISOString();
        set((s) => ({
          jobs: s.jobs.map((j) =>
            j.id === id
              ? { ...j, isDeleted: true, deletedAt: nowIso, updatedAt: nowIso }
              : j,
          ),
        }));
        syncService.queueJobSync(
          recalcJobTotal({
            ...job,
            isDeleted: true,
            deletedAt: nowIso,
            updatedAt: nowIso,
          }),
        );
      },

      restoreJob: async (id) => {
        const job = get().jobs.find((j) => j.id === id);
        if (!job) return;
        const updated: Job = {
          ...job,
          isDeleted: false,
          deletedAt: undefined,
          updatedAt: new Date().toISOString(),
        };
        set((s) => ({ jobs: s.jobs.map((j) => (j.id === id ? updated : j)) }));
        syncService.queueJobSync(recalcJobTotal(updated));
      },

      duplicateJob: async (id) => {
        const src = get().jobs.find((j) => j.id === id);
        if (!src) throw new Error("Job not found");
        try {
          const { useAuthStore } = await import("@/store/useAuthStore");
          const { user } = useAuthStore.getState();
          const newJob: Job = {
            ...src,
            id: `job-${Date.now()}`,
            siteName: `${src.siteName} (Copy)`,
            userId: user?.email || src.userId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            forms: src.forms.map((f) => ({
              ...f,
              id: `form-${Date.now()}-${Math.floor(Math.random() * 9999)}`,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            })),
          };
          set((s) => ({ jobs: [newJob, ...s.jobs] }));
          syncService.queueJobSync(newJob);
          return newJob;
        } catch (error) {
          console.warn("Could not assign userId to duplicated job:", error);
          const newJob: Job = {
            ...src,
            id: `job-${Date.now()}`,
            siteName: `${src.siteName} (Copy)`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            forms: src.forms.map((f) => ({
              ...f,
              id: `form-${Date.now()}-${Math.floor(Math.random() * 9999)}`,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            })),
          };
          set((s) => ({ jobs: [newJob, ...s.jobs] }));
          syncService.queueJobSync(newJob);
          return newJob;
        }
      },

      addForm: async (jobId, form) => {
        const job = get().jobs.find((j) => j.id === jobId);
        if (!job) return;
        const updated = recalcJobTotal({ ...job, forms: [...job.forms, form] });
        set((s) => ({
          jobs: s.jobs.map((j) => (j.id === jobId ? updated : j)),
        }));
        syncService.queueJobSync(updated);
      },

      updateForm: async (jobId, form) => {
        const job = get().jobs.find((j) => j.id === jobId);
        if (!job) return;
        const updated = recalcJobTotal({
          ...job,
          forms: job.forms.map((f) => (f.id === form.id ? form : f)),
        });
        set((s) => ({
          jobs: s.jobs.map((j) => (j.id === jobId ? updated : j)),
        }));
        syncService.queueJobSync(updated);
      },

      deleteForm: async (jobId, formId) => {
        const job = get().jobs.find((j) => j.id === jobId);
        if (!job) return;
        const updated = recalcJobTotal({
          ...job,
          forms: job.forms.map((f) =>
            f.id === formId
              ? { ...f, isDeleted: true, deletedAt: new Date().toISOString() }
              : f,
          ),
        });
        set((s) => ({
          jobs: s.jobs.map((j) => (j.id === jobId ? updated : j)),
        }));
        syncService.queueJobSync(updated);
      },

      permanentlyDeleteForm: async (jobId, formId) => {
        const job = get().jobs.find((j) => j.id === jobId);
        if (!job) return;
        const updated = recalcJobTotal({
          ...job,
          forms: job.forms.filter((f) => f.id !== formId),
        });
        set((s) => ({
          jobs: s.jobs.map((j) => (j.id === jobId ? updated : j)),
        }));
        syncService.queueJobSync(updated);
      },

      restoreForm: async (jobId, formId) => {
        const job = get().jobs.find((j) => j.id === jobId);
        if (!job) return;
        const updated = recalcJobTotal({
          ...job,
          forms: job.forms.map((f) =>
            f.id === formId
              ? { ...f, isDeleted: false, deletedAt: undefined }
              : f,
          ),
        });
        set((s) => ({
          jobs: s.jobs.map((j) => (j.id === jobId ? updated : j)),
        }));
        syncService.queueJobSync(updated);
      },

      duplicateForm: async (jobId, formId) => {
        const job = get().jobs.find((j) => j.id === jobId);
        if (!job) return;
        const src = job.forms.find((f) => f.id === formId);
        if (!src) return;
        const newForm: PaintForm = {
          ...src,
          id: `form-${Date.now()}`,
          formName: `${src.formName} (Copy)`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        const updated = recalcJobTotal({
          ...job,
          forms: [...job.forms, newForm],
        });
        set((s) => ({
          jobs: s.jobs.map((j) => (j.id === jobId ? updated : j)),
        }));
        syncService.queueJobSync(updated);
      },

      copyFormToJob: async (sourceJobId, formId, targetJobId) => {
        const sourceJob = get().jobs.find((j) => j.id === sourceJobId);
        const targetJob = get().jobs.find((j) => j.id === targetJobId);
        if (!sourceJob || !targetJob) return;
        const src = sourceJob.forms.find((f) => f.id === formId);
        if (!src) return;
        const newForm: PaintForm = {
          ...src,
          id: `form-${Date.now()}`,
          isDeleted: false,
          deletedAt: undefined,
          formName: `${src.formName} (Copy)`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        const updated = recalcJobTotal({
          ...targetJob,
          forms: [...targetJob.forms, newForm],
        });
        set((s) => ({
          jobs: s.jobs.map((j) => (j.id === targetJobId ? updated : j)),
        }));
        syncService.queueJobSync(updated);
      },

      toggleTheme: () =>
        set((s) => ({ theme: s.theme === "dark" ? "light" : "dark" })),

      toggleSidebar: () =>
        set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

      setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
    }),
    {
      name: "paintpro-storage",
      version: 1,
      // Default theme is now light — reset any previously persisted dark theme.
      migrate: (persistedState) => {
        const prev = (persistedState ?? {}) as Partial<AppStore>;
        return { ...prev, theme: "light" } as AppStore;
      },
      partialize: (s) => ({
        theme: s.theme,
        sidebarCollapsed: s.sidebarCollapsed,
        jobs: s.jobs, // Also persist jobs to localStorage so app works offline
      }),
    },
  ),
);
