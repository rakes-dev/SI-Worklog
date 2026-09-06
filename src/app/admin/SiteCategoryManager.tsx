"use client";

import React, { useState } from "react";
import {
  Building2,
  Layers,
  Loader2,
  MapPin,
  Paintbrush,
  Hammer,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { describeError } from "@/services/db";
import { useAppStore } from "@/store/useAppStore";
import type { FormType, Site, WorkCategory } from "@/types";
import ToastContainer from "@/components/ui/Toast";
import { useToast } from "@/hooks/useToast";

export default function SiteCategoryManager() {
  const {
    sites,
    categories,
    createSite,
    updateSite,
    deleteSite,
    createCategory,
    updateCategory,
    deleteCategory,
    seedDefaults,
  } = useAppStore();
  const { toasts, addToast, removeToast } = useToast();

  const [newSiteName, setNewSiteName] = useState("");
  const [newSiteAddress, setNewSiteAddress] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryType, setNewCategoryType] = useState<FormType>("painting");
  const [editingSiteId, setEditingSiteId] = useState<string | null>(null);
  const [editingSiteAddress, setEditingSiteAddress] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [editingCategoryType, setEditingCategoryType] = useState<FormType>("painting");
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      if (ok) addToast("success", ok);
    } catch (error) {
      console.error("Admin action failed:", error);
      addToast("error", "Action failed", describeError(error));
    } finally {
      setBusy(false);
    }
  };

  const handleAddSite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSiteName.trim()) return;
    const name = newSiteName.trim();
    void run(async () => {
      await createSite(name, newSiteAddress.trim());
      setNewSiteName("");
      setNewSiteAddress("");
      addToast("success", `Site "${name}" created.`);
    }, "");
  };

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    const name = newCategoryName.trim();
    void run(async () => {
      await createCategory(name, newCategoryType);
      setNewCategoryName("");
      addToast("success", `Category "${name}" created.`);
    }, "");
  };

  const handleUpdateSiteAddress = async (site: Site) => {
    await run(
      () => updateSite({ ...site, address: editingSiteAddress.trim() }),
      `Site "${site.name}" address updated.`,
    );
    setEditingSiteId(null);
  };

  const handleUpdateCategory = async (
    category: WorkCategory,
    name?: string,
    type?: FormType,
  ) => {
    const nextName = name?.trim() || category.name;
    const nextType = type || category.defaultFormType;
    await run(
      () => updateCategory({ ...category, name: nextName, defaultFormType: nextType }),
      `Category "${nextName}" updated.`,
    );
    setEditingCategoryId(null);
  };

  const handleSeed = () => {
    void run(async () => {
      const { sitesCreated, categoriesCreated, failures } = await seedDefaults();
      if (failures.length > 0) {
        addToast(
          "error",
          `Blueprint partially pushed (${failures.length} failed)`,
          failures.slice(0, 3).join(" • "),
        );
        return;
      }
      addToast(
        "success",
        sitesCreated || categoriesCreated
          ? `Structure blueprint pushed — ${sitesCreated} site(s) and ${categoriesCreated} categor(ies) created.`
          : "Structure blueprint already up to date — nothing to add.",
      );
    }, "");
  };

  const sortedSites = [...sites].sort((a, b) => a.order - b.order);
  const sortedCategories = [...categories].sort((a, b) => a.order - b.order);
return (
    <>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-6">
        {/* SITES */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-foreground flex items-center gap-2">
                <Building2 size={17} /> Sites
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Work locations (e.g. ITC ROYAL, ITC SONAR). The address prints on the form.
              </p>
            </div>
            {busy && <Loader2 size={16} className="animate-spin text-muted-foreground" />}
          </div>

          <div className="px-5 pt-4">
            <form onSubmit={handleAddSite} className="flex flex-col sm:flex-row gap-2">
              <input
                value={newSiteName}
                onChange={(e) => setNewSiteName(e.target.value)}
                placeholder="Site name (e.g. ITC ROYAL)"
                className="flex-1 px-3 py-2 rounded-md border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <input
                value={newSiteAddress}
                onChange={(e) => setNewSiteAddress(e.target.value)}
                placeholder="Address"
                className="flex-1 px-3 py-2 rounded-md border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="submit"
                disabled={busy || !newSiteName.trim()}
                className="flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                <Plus size={14} /> Add
              </button>
            </form>
          </div>

          <ul className="p-3 flex flex-col gap-1.5 max-h-[360px] overflow-y-auto">
            {sortedSites.length === 0 && (
              <li className="text-sm text-muted-foreground text-center py-6">
                No sites yet.{" "}
                <button onClick={handleSeed} className="text-primary underline">
                  Seed defaults
                </button>
              </li>
            )}
            {sortedSites.map((site) => (
              <li
                key={site.id}
                className="flex items-center gap-2 px-3 py-2 rounded-md border border-border hover:bg-secondary/40 transition-colors"
              >
                {editingSiteId === site.id ? (
                  <form
                    className="flex-1 flex items-center gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void handleUpdateSiteAddress(site);
                    }}
                  >
                    <MapPin size={13} className="text-muted-foreground shrink-0" />
                    <input
                      value={editingSiteAddress}
                      onChange={(e) => setEditingSiteAddress(e.target.value)}
                      placeholder="Address"
                      className="flex-1 px-2 py-1 rounded-md border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2"
                      autoFocus
                    />
                    <button type="submit" className="p-1 rounded text-primary hover:bg-primary/10" title="Save">
                      <Save size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingSiteId(null)}
                      className="p-1 rounded text-muted-foreground hover:bg-secondary"
                      title="Cancel"
                    >
                      <X size={14} />
                    </button>
                  </form>
                ) : (
                  <>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{site.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{site.address || "No address set"}</p>
                    </div>
                    <button
                      onClick={() => {
                        setEditingSiteId(site.id);
                        setEditingSiteAddress(site.address || "");
                      }}
                      className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                      title="Edit address"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() =>
                        void run(() => deleteSite(site.id), `Site "${site.name}" deleted.`)
                      }
                      className="p-1.5 rounded text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      title="Delete site"
                    >
                      <Trash2 size={13} />
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
{/* CATEGORIES */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-foreground flex items-center gap-2">
                <Layers size={17} /> Work Categories
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                The same set applies to every site. Type decides the form template.
              </p>
            </div>
            {busy && <Loader2 size={16} className="animate-spin text-muted-foreground" />}
          </div>

          <div className="px-5 pt-4">
            <form onSubmit={handleAddCategory} className="flex flex-col sm:flex-row gap-2">
              <input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Category name (e.g. Public Area)"
                className="flex-1 px-3 py-2 rounded-md border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <select
                value={newCategoryType}
                onChange={(e) => setNewCategoryType(e.target.value as FormType)}
                className="px-3 py-2 rounded-md border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="painting">Painting</option>
                <option value="carpenter">Carpenter</option>
              </select>
              <button
                type="submit"
                disabled={busy || !newCategoryName.trim()}
                className="flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                <Plus size={14} /> Add
              </button>
            </form>
          </div>

          <ul className="p-3 flex flex-col gap-1.5 max-h-[360px] overflow-y-auto">
            {sortedCategories.length === 0 && (
              <li className="text-sm text-muted-foreground text-center py-6">
                No categories yet.{" "}
                <button onClick={handleSeed} className="text-primary underline">
                  Seed defaults
                </button>
              </li>
            )}
{sortedCategories.map((category) => (
              <li
                key={category.id}
                className="flex items-center gap-2 px-3 py-2 rounded-md border border-border hover:bg-secondary/40 transition-colors"
              >
                {editingCategoryId === category.id ? (
                  <form
                    className="flex-1 flex items-center gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void handleUpdateCategory(category, editingCategoryName, editingCategoryType);
                    }}
                  >
                    <input
                      value={editingCategoryName}
                      onChange={(e) => setEditingCategoryName(e.target.value)}
                      placeholder="Category name"
                      className="flex-1 px-2 py-1 rounded-md border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2"
                      autoFocus
                    />
                    <select
                      value={editingCategoryType}
                      onChange={(e) => setEditingCategoryType(e.target.value as FormType)}
                      className="px-2 py-1 rounded-md border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2"
                    >
                      <option value="painting">Painting</option>
                      <option value="carpenter">Carpenter</option>
                    </select>
                    <button type="submit" className="p-1 rounded text-primary hover:bg-primary/10" title="Save">
                      <Save size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingCategoryId(null)}
                      className="p-1 rounded text-muted-foreground hover:bg-secondary"
                      title="Cancel"
                    >
                      <X size={14} />
                    </button>
                  </form>
                ) : (
                  <>
                    <span
                      className={`shrink-0 p-1.5 rounded ${
                        category.defaultFormType === "carpenter"
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                          : "bg-primary/10 text-primary"
                      }`}
                    >
                      {category.defaultFormType === "carpenter" ? <Hammer size={13} /> : <Paintbrush size={13} />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{category.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {category.defaultFormType === "carpenter" ? "Carpenter template" : "Painting template"}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setEditingCategoryId(category.id);
                        setEditingCategoryName(category.name);
                        setEditingCategoryType(category.defaultFormType);
                      }}
                      className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                      title="Edit"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => {
                        void run(
                          () => deleteCategory(category.id),
                          `Category "${category.name}" deleted.`,
                        );
                      }}
                      className="p-1.5 rounded text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      title="Delete category"
                    >
                      <Trash2 size={13} />
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  );
}