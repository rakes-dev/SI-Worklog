"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { FormType, Site, WorkCategory, WorkForm } from "@/types";
import { dbService, type SeedResult } from "@/services/db";
import { slugify } from "@/constants/seed";
import { currentMonth, defaultForm, generateId } from "@/utils/helpers";

interface CreateFormInput {
  site: Site;
  category: WorkCategory;
  ownerEmail: string;
  empName: string;
}

interface AppStore {
  sites: Site[];
  categories: WorkCategory[];
  forms: WorkForm[];

  theme: "light" | "dark";
  sidebarCollapsed: boolean;

  isLoaded: boolean;
  isLoadingData: boolean;
  isOnline: boolean;
  isSaving: boolean;

  // Lifecycle
  loadAll: () => Promise<void>;
  startLiveSync: () => void;
  stopLiveSync: () => void;

  // Forms
  createForm: (input: CreateFormInput) => Promise<WorkForm>;
  updateForm: (form: WorkForm) => Promise<void>;
  softDeleteForm: (id: string) => Promise<void>;
  restoreForm: (id: string) => Promise<void>;
  permanentlyDeleteForm: (id: string) => Promise<void>;
  duplicateForm: (id: string) => Promise<WorkForm | undefined>;
  copyForm: (
    id: string,
    target: { site: Site; category: WorkCategory },
  ) => Promise<WorkForm | undefined>;

  // Sites (admin)
  createSite: (name: string, address: string) => Promise<Site>;
  updateSite: (site: Site) => Promise<void>;
  deleteSite: (id: string) => Promise<void>;

  // Categories (admin)
  createCategory: (name: string, formType: string) => Promise<WorkCategory>;
  updateCategory: (category: WorkCategory) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;

  // Structure blueprint (admin)
  seedDefaults: () => Promise<SeedResult>;

  toggleTheme: () => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (v: boolean) => void;
}

// Live-sync bookkeeping (module scope so listeners register once)
let sitesUnsub: (() => void) | null = null;
let categoriesUnsub: (() => void) | null = null;
let formsUnsub: (() => void) | null = null;
let currentFormScope: string | null = null;
let onlineListenersBound = false;
let liveSyncDone = false;
let liveSyncRetryTimer: ReturnType<typeof setTimeout> | null = null;

// Idempotent live-sync starter. Safe to call repeatedly — subscriber guards
// (`sitesUnsub` / `categoriesUnsub` / `currentFormScope`) mean only one set of
// listeners exists and a role/scope change (user→admin) re-subscribes the forms
// listener. Retries INDEFINITELY (deduped) until the signed-in user's email is
// known — cold loads restore Firebase auth + read the allowlist asynchronously,
// which on a slow network can take longer than a fixed number of retries.
export function startLiveSync(set: (partial: Partial<AppStore>) => void): void {
  if (typeof window === "undefined") return;
  // NOTE: no early-return on `liveSyncDone`. Each call re-runs with the current
  // auth scope; the per-subscriber guards below (sitesUnsub / categoriesUnsub /
  // currentFormScope) dedupe actual onSnapshot registration, so re-entry is
  // cheap and correctly handles a role change (user→admin) after first setup.

  const setup = async () => {
    try {
      const { useAuthStore } = await import("@/store/useAuthStore");
      const { user, role } = useAuthStore.getState();
      const email = user?.email?.trim().toLowerCase();
      if (!email) {
        scheduleRetry(setup, 750);
        return;
      }
      const isAdmin = role === "admin" || role === "admin_viewer";
      if (!sitesUnsub) {
        sitesUnsub = dbService.observeSites(
          (sites) => set({ sites, isLoadingData: false }), () => {},
        );
      }
      if (!categoriesUnsub) {
        categoriesUnsub = dbService.observeCategories(
          (categories) => set({ categories, isLoadingData: false }), () => {},
        );
      }
      const scope = isAdmin ? "__admin__" : email;
      if (scope !== currentFormScope) {
        if (formsUnsub) { formsUnsub(); formsUnsub = null; }
        currentFormScope = scope;
        formsUnsub = isAdmin
          ? dbService.observeForms(
              (forms) => set({ forms, isLoadingData: false }), () => {},
            )
          : dbService.observeUserForms(
              email, (forms) => set({ forms, isLoadingData: false }), () => {},
            );
      }
      liveSyncDone = true;
    } catch (error) {
      console.warn("startLiveSync failed — will retry automatically.", error);
      scheduleRetry(setup, 1000);
    }
  };
  void setup();
}

/** Schedule a retry but never more than one pending at a time. */
function scheduleRetry(fn: () => void, ms: number): void {
  if (liveSyncRetryTimer) return;
  liveSyncRetryTimer = setTimeout(() => {
    liveSyncRetryTimer = null;
    fn();
  }, ms);
}

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => {
      /** Persist a form to Firestore with a saving indicator. */
      const persistForm = async (form: WorkForm): Promise<void> => {
        set({ isSaving: true });
        try {
          await dbService.saveForm(form);
        } finally {
          set({ isSaving: false });
        }
      };

      return {
        sites: [],
        categories: [],
        forms: [],

        theme: "light",
        sidebarCollapsed: false,

        isLoaded: false,
        isLoadingData: false,
        isOnline:
          typeof navigator !== "undefined" ? navigator.onLine : true,
        isSaving: false,

        loadAll: async () => {
          set({ isLoaded: true, isLoadingData: true });
          if (typeof window !== "undefined" && !onlineListenersBound) {
            onlineListenersBound = true;
            window.addEventListener("online", () => set({ isOnline: true }));
            window.addEventListener("offline", () => set({ isOnline: false }));
          }
          startLiveSync(set);
        },

        startLiveSync: () => startLiveSync(set),

        stopLiveSync: () => {
          sitesUnsub?.();
          categoriesUnsub?.();
          formsUnsub?.();
          sitesUnsub = null;
          categoriesUnsub = null;
          formsUnsub = null;
          currentFormScope = null;
          if (liveSyncRetryTimer) {
            clearTimeout(liveSyncRetryTimer);
            liveSyncRetryTimer = null;
          }
          liveSyncDone = false;
          set({ forms: [], sites: [], categories: [] });
        },

        // === FORMS ===============================================
        createForm: async ({ site, category, ownerEmail, empName }) => {
          const owner = ownerEmail.trim().toLowerCase();
          const mineInCategory = get().forms.filter(
            (f) =>
              f.siteId === site.id &&
              f.categoryId === category.id &&
              f.ownerEmail === owner &&
              !f.isDeleted,
          ).length;
          const base = defaultForm("", mineInCategory + 1, category.defaultFormType);
          const form: WorkForm = {
            ...base,
            id: generateId("form"),
            siteId: site.id,
            siteName: site.name,
            siteAddress: site.address,
            categoryId: category.id,
            ownerEmail: owner,
            empName: empName.trim(),
            month: currentMonth(),
          };
          set((s) => ({ forms: [...s.forms, form] }));
          await persistForm(form);
          return form;
        },

        updateForm: async (form) => {
          set((s) => ({
            forms: s.forms.map((f) => (f.id === form.id ? form : f)),
          }));
          await persistForm(form);
        },

        softDeleteForm: async (id) => {
          const form = get().forms.find((f) => f.id === id);
          if (!form) return;
          const updated: WorkForm = {
            ...form,
            isDeleted: true,
            deletedAt: new Date().toISOString(),
          };
          set((s) => ({
            forms: s.forms.map((f) => (f.id === id ? updated : f)),
          }));
          await persistForm(updated);
        },

        restoreForm: async (id) => {
          const form = get().forms.find((f) => f.id === id);
          if (!form) return;
          const updated: WorkForm = {
            ...form,
            isDeleted: false,
            deletedAt: undefined,
          };
          set((s) => ({
            forms: s.forms.map((f) => (f.id === id ? updated : f)),
          }));
          await persistForm(updated);
        },

        permanentlyDeleteForm: async (id) => {
          await dbService.deleteFormDoc(id);
          set((s) => ({
            forms: s.forms.filter((f) => f.id !== id),
          }));
        },

        duplicateForm: async (id) => {
          const src = get().forms.find((f) => f.id === id);
          if (!src) return undefined;
          const copy: WorkForm = {
            ...src,
            id: generateId("form"),
            formName: `${src.formName} (Copy)`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          set((s) => ({ forms: [...s.forms, copy] }));
          await persistForm(copy);
          return copy;
        },

        copyForm: async (id, target) => {
          const src = get().forms.find((f) => f.id === id);
          if (!src) return undefined;
          const copy: WorkForm = {
            ...src,
            id: generateId("form"),
            siteId: target.site.id,
            siteName: target.site.name,
            siteAddress: target.site.address,
            categoryId: target.category.id,
            formName: `${src.formName} (Copy)`,
          };
          set((s) => ({ forms: [...s.forms, copy] }));
          await persistForm(copy);
          return copy;
        },

        // === SITES (admin) =======================================
        createSite: async (name, address) => {
          const site: Site = {
            id: generateId("site"),
            name: name.trim(),
            address: address.trim(),
            order: get().sites.length,
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          await dbService.saveSite(site);
          set((s) => ({ sites: [...s.sites, site] }));
          return site;
        },

        updateSite: async (site) => {
          await dbService.saveSite(site);
          set((s) => ({
            sites: s.sites.map((x) => (x.id === site.id ? site : x)),
          }));
        },

        deleteSite: async (id) => {
          await dbService.deleteSiteDoc(id);
          set((s) => ({
            sites: s.sites.filter((x) => x.id !== id),
          }));
        },

        // === CATEGORIES (admin) ==================================
        createCategory: async (name, formType) => {
          const category: WorkCategory = {
            id: generateId("cat"),
            name: name.trim(),
            defaultFormType: formType as FormType,
            order: get().categories.length,
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          await dbService.saveCategory(category);
          set((s) => ({ categories: [...s.categories, category] }));
          return category;
        },

        updateCategory: async (category) => {
          await dbService.saveCategory(category);
          set((s) => ({
            categories: s.categories.map((x) =>
              x.id === category.id ? category : x,
            ),
          }));
        },

        deleteCategory: async (id) => {
          await dbService.deleteCategoryDoc(id);
          set((s) => ({
            categories: s.categories.filter((x) => x.id !== id),
          }));
        },

        // === STRUCTURE BLUEPRINT (admin) =========================
        seedDefaults: async () => {
          return dbService.seedDefaults();
        },

        // === THEME / SIDEBAR =====================================
        toggleTheme: () =>
          set((s) => ({ theme: s.theme === "dark" ? "light" : "dark" })),

        toggleSidebar: () =>
          set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

        setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
      };
    },
    {
      name: "si-worklog-storage",
      version: 1,
      migrate: (persistedState) => {
        const prev = (persistedState ?? {}) as Partial<AppStore>;
        return { ...prev, theme: "light" } as AppStore;
      },
      partialize: (s) => ({
        theme: s.theme,
        sidebarCollapsed: s.sidebarCollapsed,
      }),
    },
  ),
);
