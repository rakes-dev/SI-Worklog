'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Job, JobStatus, PaintForm } from '@/types';
import { dbService } from '@/services/db';

interface AppStore {
  jobs: Job[];
  theme: 'light' | 'dark';
  sidebarCollapsed: boolean;
  isLoaded: boolean;

  // Actions
  loadJobs: () => Promise<void>;
  addJob: (job: Job) => Promise<void>;
  updateJob: (job: Job) => Promise<void>;
  deleteJob: (id: string) => Promise<void>;
  duplicateJob: (id: string) => Promise<Job>;
  updateJobStatus: (id: string, status: JobStatus) => Promise<void>;
  addForm: (jobId: string, form: PaintForm) => Promise<void>;
  updateForm: (jobId: string, form: PaintForm) => Promise<void>;
  deleteForm: (jobId: string, formId: string) => Promise<void>;
  duplicateForm: (jobId: string, formId: string) => Promise<void>;
  toggleTheme: () => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (v: boolean) => void;
}

function recalcJobTotal(job: Job): Job {
  const total = job.forms.reduce((sum, f) => sum + (f.grandTotal || 0), 0);
  return { ...job, totalAmount: total };
}

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      jobs: [],
      theme: 'dark',
      sidebarCollapsed: false,
      isLoaded: false,

      loadJobs: async () => {
        // Always mark as loaded immediately so UI doesn't hang
        // Local persisted data is already available from zustand persist middleware
        set({ isLoaded: true });

        // Try Firestore sync in background (best-effort, non-blocking)
        dbService.getAllJobs()
          .then((jobs) => {
            if (jobs.length > 0) set({ jobs });
          })
          .catch((error) => {
            console.warn('Firestore sync unavailable, using local data.', error);
          });
      },

      addJob: async (job) => {
        // Update local state immediately (persisted to localStorage via persist middleware)
        set((s) => ({ jobs: [job, ...s.jobs] }));
        // Try Firestore sync in background (non-blocking, best-effort)
        dbService.saveJob(job).catch((error) => {
          console.warn('Firestore sync failed for new job (local save preserved):', error);
        });
      },

      updateJob: async (job) => {
        const updated = recalcJobTotal(job);
        set((s) => ({ jobs: s.jobs.map((j) => (j.id === updated.id ? updated : j)) }));
        dbService.saveJob(updated).catch((error) => {
          console.warn('Firestore sync failed for job update (local save preserved):', error);
        });
      },

      deleteJob: async (id) => {
        set((s) => ({ jobs: s.jobs.filter((j) => j.id !== id) }));
        dbService.deleteJob(id).catch((error) => {
          console.warn('Firestore sync failed for job deletion:', error);
        });
      },

      duplicateJob: async (id) => {
        const src = get().jobs.find((j) => j.id === id);
        if (!src) throw new Error('Job not found');
        const newJob: Job = {
          ...src,
          id: `job-${Date.now()}`,
          jobName: `${src.jobName} (Copy)`,
          status: 'Draft',
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
        dbService.saveJob(newJob).catch((error) => {
          console.warn('Firestore sync failed for duplicateJob (local save preserved):', error);
        });
        return newJob;
      },

      updateJobStatus: async (id, status) => {
        const job = get().jobs.find((j) => j.id === id);
        if (!job) return;
        const updated = { ...job, status, updatedAt: new Date().toISOString() };
        set((s) => ({ jobs: s.jobs.map((j) => (j.id === id ? updated : j)) }));
        dbService.saveJob(updated).catch((error) => {
          console.warn('Firestore sync failed for status update (local save preserved):', error);
        });
      },

      addForm: async (jobId, form) => {
        const job = get().jobs.find((j) => j.id === jobId);
        if (!job) return;
        const updated = recalcJobTotal({ ...job, forms: [...job.forms, form] });
        set((s) => ({ jobs: s.jobs.map((j) => (j.id === jobId ? updated : j)) }));
        dbService.saveJob(updated).catch((error) => {
          console.warn('Firestore sync failed for addForm (local save preserved):', error);
        });
      },

      updateForm: async (jobId, form) => {
        const job = get().jobs.find((j) => j.id === jobId);
        if (!job) return;
        const updated = recalcJobTotal({
          ...job,
          forms: job.forms.map((f) => (f.id === form.id ? form : f)),
        });
        set((s) => ({ jobs: s.jobs.map((j) => (j.id === jobId ? updated : j)) }));
        dbService.saveJob(updated).catch((error) => {
          console.warn('Firestore sync failed for updateForm (local save preserved):', error);
        });
      },

      deleteForm: async (jobId, formId) => {
        const job = get().jobs.find((j) => j.id === jobId);
        if (!job) return;
        const updated = recalcJobTotal({
          ...job,
          forms: job.forms.filter((f) => f.id !== formId),
        });
        set((s) => ({ jobs: s.jobs.map((j) => (j.id === jobId ? updated : j)) }));
        dbService.saveJob(updated).catch((error) => {
          console.warn('Firestore sync failed for deleteForm (local save preserved):', error);
        });
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
        const updated = recalcJobTotal({ ...job, forms: [...job.forms, newForm] });
        set((s) => ({ jobs: s.jobs.map((j) => (j.id === jobId ? updated : j)) }));
        dbService.saveJob(updated).catch((error) => {
          console.warn('Firestore sync failed for duplicateForm (local save preserved):', error);
        });
      },

      toggleTheme: () =>
        set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),

      toggleSidebar: () =>
        set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

      setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
    }),
    {
      name: 'paintpro-storage',
      partialize: (s) => ({
        theme: s.theme,
        sidebarCollapsed: s.sidebarCollapsed,
        jobs: s.jobs, // Also persist jobs to localStorage so app works offline
      }),
    }
  )
);