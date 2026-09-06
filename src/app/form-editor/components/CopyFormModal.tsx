"use client";

import React, { useMemo, useState } from "react";
import { X, Copy, Loader2 } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import type { Site, WorkCategory } from "@/types";

interface CopyFormModalProps {
  open: boolean;
  formId: string;
  formName: string;
  sourceSiteId: string;
  sourceCategoryId: string;
  sites: Site[];
  categories: WorkCategory[];
  onClose: () => void;
  onCopied: (targetName: string, newFormName: string) => void;
}

export default function CopyFormModal({
  open,
  formId,
  formName,
  sourceSiteId,
  sourceCategoryId,
  sites,
  categories,
  onClose,
  onCopied,
}: CopyFormModalProps) {
  const { copyForm } = useAppStore();
  const [targetSiteId, setTargetSiteId] = useState<string>("");
  const [targetCategoryId, setTargetCategoryId] = useState<string>("");
  const [copying, setCopying] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const targetSites = useMemo(
    () => sites.filter((s) => s.isActive && s.id !== sourceSiteId),
    [sites, sourceSiteId],
  );
  const targetCategories = useMemo(
    () => categories.filter((c) => c.isActive),
    [categories],
  );

  const selectedSite = targetSites.find((s) => s.id === targetSiteId);
  const selectedCategory = targetCategories.find((c) => c.id === targetCategoryId);

  const handleCopy = async () => {
    if (!selectedSite || !selectedCategory) {
      setErrorMsg("Select both a target site and a category first.");
      return;
    }
    setCopying(true);
    setErrorMsg("");
    try {
      const copy = await copyForm(formId, { site: selectedSite, category: selectedCategory });
      if (copy) onCopied(`${selectedSite.name} · ${selectedCategory.name}`, copy.formName);
      setTargetSiteId("");
      setTargetCategoryId("");
      onClose();
    } catch (error) {
      console.error("Copy form failed:", error);
      setErrorMsg("Copy failed. Please try again.");
    } finally {
      setCopying(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col fade-in">
<div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="font-semibold text-foreground text-lg">
              Copy Form to Another Site
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5 truncate">
              {formName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
          {targetSites.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No other sites available to copy into.

            </p>
          ) : (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Target Site
                </label>
                <select
                  value={targetSiteId}
                  onChange={(e) => {
                    setTargetSiteId(e.target.value);
                    setErrorMsg("");
                  }}
                  className="w-full px-3 py-2 rounded-md border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Select a site...</option>
                  {targetSites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Category
                </label>
                <select
                  value={targetCategoryId}
                  onChange={(e) => {
                    setTargetCategoryId(e.target.value);
                    setErrorMsg("");
                  }}
                  className="w-full px-3 py-2 rounded-md border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Select a category...</option>
                  {targetCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
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
            onClick={handleCopy}
            disabled={copying || !targetSiteId || !targetCategoryId}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed scale-press"
          >
            {copying ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Copy size={14} />
            )}
            {copying ? "Copying..." : "Copy Form"}
          </button>
        </div>
      </div>
    </div>
  );
}