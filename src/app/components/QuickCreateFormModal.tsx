"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Hammer, Loader2, Paintbrush, X } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { useAuthStore } from "@/store/useAuthStore";
import { describeError } from "@/services/db";
import { loadLastWork, rememberWork } from "@/utils/recents";
import ToastContainer from "@/components/ui/Toast";
import { useToast } from "@/hooks/useToast";

interface QuickCreateFormModalProps {
  open: boolean;
  onClose: () => void;
  /** Preselect a site (used when opened from a site page). */
  defaultSiteId?: string;
}

export default function QuickCreateFormModal({
  open,
  onClose,
  defaultSiteId,
}: QuickCreateFormModalProps) {
  const router = useRouter();
  const { sites, categories, createForm } = useAppStore();
  const { user } = useAuthStore();
  const { toasts, addToast, removeToast } = useToast();

  const activeSites = useMemo(
    () => sites.filter((s) => s.isActive).sort((a, b) => a.order - b.order),
    [sites],
  );
  const activeCategories = useMemo(
    () => categories.filter((c) => c.isActive).sort((a, b) => a.order - b.order),
    [categories],
  );

  const [siteId, setSiteId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [creating, setCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Reset the selection every time the modal opens. Defaults come from the
  // user's "last worked" memory: preselected site (when opened from a site
  // page) wins, otherwise the last site they created a form in — and the last
  // category is preselected as long as it belongs to that same site choice.
  useEffect(() => {
    if (!open) return;
    const last = loadLastWork(user?.email);
    const preferredSiteId = defaultSiteId ?? last.lastSiteId;
    const siteIsValid =
      Boolean(preferredSiteId) &&
      activeSites.some((s) => s.id === preferredSiteId);
    const categoryIsValid =
      Boolean(last.lastCategoryId) &&
      preferredSiteId === last.lastSiteId &&
      activeCategories.some((c) => c.id === last.lastCategoryId);
    setSiteId(siteIsValid ? preferredSiteId : "");
    setCategoryId(categoryIsValid ? last.lastCategoryId : "");
    setErrorMsg("");
    // Lists/auth are read at the moment of opening; re-running on their later
    // changes would clobber a selection the user is already making.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultSiteId]);

  const site = activeSites.find((s) => s.id === siteId);
  const category = activeCategories.find((c) => c.id === categoryId);

  const canCreate = Boolean(site && category && user?.email && !creating);

  const handleCreate = async () => {
    if (!site || !category || !user?.email) return;
    setCreating(true);
    setErrorMsg("");
    try {
      const form = await createForm({
        site,
        category,
        ownerEmail: user.email.trim().toLowerCase(),
        empName: user.displayName || user.email,
      });
      // Remember this site+category as the user's last worked — it becomes the
      // default selection next time they open this modal.
      rememberWork(user.email, site.id, category.id);
      onClose();
      router.push(`/form-editor?formId=${form.id}`);
    } catch (error) {
      console.error("Create form failed:", error);
      setErrorMsg(describeError(error));
    } finally {
      setCreating(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-md fade-in">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="font-semibold text-foreground text-lg">New Form</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Site, category and your name are filled in automatically.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <X size={18} />
          </button>
        </div>
<div className="p-5 flex flex-col gap-4">
          {activeSites.length === 0 || activeCategories.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              The work structure (sites / categories) is not set up yet. Ask an
              admin to push it from Admin → Sites &amp; Categories.
            </p>
          ) : (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Site
                </label>
                <select
                  value={siteId}
                  onChange={(e) => {
                    setSiteId(e.target.value);
                    setErrorMsg("");
                  }}
                  className="w-full px-3 py-2 rounded-md border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Select a site...</option>
                  {activeSites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Work category
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => {
                    setCategoryId(e.target.value);
                    setErrorMsg("");
                  }}
                  className="w-full px-3 py-2 rounded-md border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Select a category...</option>
                  {activeCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} —{" "}
                      {c.defaultFormType === "carpenter" ? "Carpenter" : "Painting"}
                    </option>
                  ))}
                </select>
                {category && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    {category.defaultFormType === "carpenter" ? (
                      <Hammer size={12} />
                    ) : (
                      <Paintbrush size={12} />
                    )}
                    Uses the{" "}
                    {category.defaultFormType === "carpenter"
                      ? "carpenter"
                      : "painting"}{" "}
                    form template.
                  </p>
                )}
              </div>
            </>
          )}

          {errorMsg && <p className="text-xs text-red-500">{errorMsg}</p>}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-md border border-border text-foreground hover:bg-secondary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!canCreate}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed scale-press"
          >
            {creating ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Paintbrush size={14} />
            )}
            {creating ? "Creating..." : "Create Form"}
          </button>
        </div>
      </div>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}