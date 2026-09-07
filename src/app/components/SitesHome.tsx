"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Building2, FileText, IndianRupee, Loader2, MapPin, Plus } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { useAuthStore } from "@/store/useAuthStore";
import { describeError } from "@/services/db";
import { formatCurrency } from "@/utils/helpers";
import { byRecencyThenOrder, loadLastWork } from "@/utils/recents";
import QuickCreateFormModal from "./QuickCreateFormModal";
import ToastContainer from "@/components/ui/Toast";
import { useToast } from "@/hooks/useToast";

export default function SitesHome() {
  const { sites, categories, forms, seedDefaults, isLoadingData } = useAppStore();
  const { user, role } = useAuthStore();
  const { toasts, addToast, removeToast } = useToast();

  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const canCreate =
    sites.some((s) => s.isActive) && categories.some((c) => c.isActive);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const { sitesCreated, categoriesCreated, failures } = await seedDefaults();
      if (failures.length > 0) {
        addToast("error", "Blueprint push failed", failures.slice(0, 2).join(" • "));
      } else {
        addToast(
          "success",
          sitesCreated || categoriesCreated
            ? `Structure blueprint pushed — ${sitesCreated} site(s), ${categoriesCreated} categor(ies).`
            : "Structure blueprint already up to date.",
        );
      }
    } catch (error) {
      console.error("Seed failed:", error);
      addToast("error", "Seed failed", describeError(error));
    } finally {
      setSeeding(false);
    }
  };

  const activeSites = sites.filter((s) => s.isActive);
  const activeForms = forms.filter((f) => !f.isDeleted);

  const perSite = useMemo(() => {
    // The site the user worked in most recently comes first; the rest keep
    // their configured order. Mirrors the category ordering on site pages.
    const lastWork = loadLastWork(user?.email);
    return byRecencyThenOrder(
      activeSites.map((site) => {
        const siteForms = activeForms.filter((f) => f.siteId === site.id);
        return {
          site,
          count: siteForms.length,
          amount: siteForms.reduce((sum, f) => sum + (f.grandTotal || 0), 0),
        };
      }),
      ({ site }) => site.id,
      ({ site }) => lastWork.siteAt[site.id] ?? 0,
      ({ site }) => site.order,
    );
  }, [activeSites, activeForms, user?.email]);

  const totalForms = activeForms.length;
  const totalAmount = activeForms.reduce((sum, f) => sum + (f.grandTotal || 0), 0);

  return (
    <div className="min-h-full p-4 lg:p-6 xl:p-8 pb-[calc(6rem_+_env(safe-area-inset-bottom))] lg:pb-8 max-w-screen-2xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            <Building2 size={22} className="text-primary" />
            Sites
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {role === "admin" ? "All employees' forms across work sites" : "My forms across work sites"} ·{" "}
            {user?.displayName || user?.email || "Me"}
          </p>
        </div>
        <button
          onClick={() => setShowQuickCreate(true)}
          disabled={!canCreate}
          title={
            canCreate
              ? "Create a new form"
              : "Set up sites & categories first (Admin → Sites & Categories)"
          }
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity scale-press disabled:opacity-60"
        >
          <Plus size={16} />
          New Form
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-3 gap-3 mb-6">
        <div className="bg-card border border-border rounded-lg p-4 flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-blue-500 shrink-0" />
            <p className="text-xl sm:text-2xl font-bold font-tabular text-foreground">{totalForms}</p>
          </div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Forms</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4 flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <IndianRupee size={16} className="text-emerald-500 shrink-0" />
            <p className="text-xl sm:text-2xl font-bold font-tabular text-foreground whitespace-nowrap">₹{formatCurrency(totalAmount)}</p>
          </div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Value</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4 flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <Building2 size={16} className="text-purple-500 shrink-0" />
            <p className="text-xl sm:text-2xl font-bold font-tabular text-foreground">{activeSites.length}</p>
          </div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Sites</p>
        </div>
      </div>

      {/* Site cards */}
      {isLoadingData && perSite.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Loader2 size={28} className="animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground mt-3">
            Loading sites & forms…
          </p>
        </div>
      ) : perSite.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
            <Building2 size={28} className="text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-foreground text-lg mb-1">No sites yet</h3>
          <p className="text-muted-foreground text-sm max-w-sm mb-4">
            {role === "admin"
              ? "Push the structure blueprint (ITC ROYAL, ITC SONAR + the 7 work categories) to start creating forms."
              : "The work structure isn't set up yet. Ask an admin to push it from Admin → Sites & Categories."}
          </p>
          {role === "admin" && (
            <button
              onClick={handleSeed}
              disabled={seeding}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity scale-press disabled:opacity-60"
            >
              {seeding ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              {seeding ? "Pushing..." : "Push structure blueprint"}
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {perSite.map(({ site, count, amount }) => (
            <Link
              key={site.id}
              href={`/site/${site.id}`}
              className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3 hover:border-primary/50 hover:shadow-md transition-all duration-200 group"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h2 className="font-semibold text-foreground text-lg truncate">{site.name}</h2>
                  {site.address && (
                    <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1">
                      <MapPin size={12} className="flex-shrink-0" />
                      <span className="truncate">{site.address}</span>
                    </p>
                  )}
                </div>
                <span className="shrink-0 p-2.5 rounded-lg bg-primary/10 text-primary">
                  <Building2 size={18} />
                </span>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-border">
                <span className="text-sm text-muted-foreground">
                  {count} form{count !== 1 ? "s" : ""}
                </span>
                <span className="font-semibold font-tabular text-sm text-foreground">
                  ₹{formatCurrency(amount)}
                </span>
              </div>
              <div className="flex items-center gap-1 text-xs font-medium text-primary opacity-70 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                <Plus size={12} /> Open site
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Mobile quick-create FAB */}
      <button
        onClick={() => setShowQuickCreate(true)}
        disabled={!canCreate}
        className="fixed bottom-20 right-4 lg:hidden w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:opacity-90 transition-opacity scale-press z-20 no-print disabled:opacity-60"
        aria-label="Create new form"
      >
        <Plus size={24} />
      </button>

      <QuickCreateFormModal
        open={showQuickCreate}
        onClose={() => setShowQuickCreate(false)}
      />
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}