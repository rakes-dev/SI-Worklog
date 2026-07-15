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
        const jobs = await dbService.getAllJobs();
        set({ jobs, isLoaded: true });
      },

      addJob: async (job) => {
        await dbService.saveJob(job);
        set((s) => ({ jobs: [job, ...s.jobs] }));
      },

      updateJob: async (job) => {
        const updated = recalcJobTotal(job);
        await dbService.saveJob(updated);
        set((s) => ({ jobs: s.jobs.map((j) => (j.id === updated.id ? updated : j)) }));
      },

      deleteJob: async (id) => {
        await dbService.deleteJob(id);
        set((s) => ({ jobs: s.jobs.filter((j) => j.id !== id) }));
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
        await dbService.saveJob(newJob);
        set((s) => ({ jobs: [newJob, ...s.jobs] }));
        return newJob;
      },

      updateJobStatus: async (id, status) => {
        const job = get().jobs.find((j) => j.id === id);
        if (!job) return;
        const updated = { ...job, status, updatedAt: new Date().toISOString() };
        await dbService.saveJob(updated);
        set((s) => ({ jobs: s.jobs.map((j) => (j.id === id ? updated : j)) }));
      },

      addForm: async (jobId, form) => {
        const job = get().jobs.find((j) => j.id === jobId);
        if (!job) return;
        const updated = recalcJobTotal({ ...job, forms: [...job.forms, form] });
        await dbService.saveJob(updated);
        set((s) => ({ jobs: s.jobs.map((j) => (j.id === jobId ? updated : j)) }));
      },

      updateForm: async (jobId, form) => {
        const job = get().jobs.find((j) => j.id === jobId);
        if (!job) return;
        const updated = recalcJobTotal({
          ...job,
          forms: job.forms.map((f) => (f.id === form.id ? form : f)),
        });
        await dbService.saveJob(updated);
        set((s) => ({ jobs: s.jobs.map((j) => (j.id === jobId ? updated : j)) }));
      },

      deleteForm: async (jobId, formId) => {
        const job = get().jobs.find((j) => j.id === jobId);
        if (!job) return;
        const updated = recalcJobTotal({
          ...job,
          forms: job.forms.filter((f) => f.id !== formId),
        });
        await dbService.saveJob(updated);
        set((s) => ({ jobs: s.jobs.map((j) => (j.id === jobId ? updated : j)) }));
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
        await dbService.saveJob(updated);
        set((s) => ({ jobs: s.jobs.map((j) => (j.id === jobId ? updated : j)) }));
      },

      toggleTheme: () =>
        set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),

      toggleSidebar: () =>
        set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

      setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
    }),
    {
      name: 'paintpro-ui-prefs',
      partialize: (s) => ({ theme: s.theme, sidebarCollapsed: s.sidebarCollapsed }),
    }
  )
);