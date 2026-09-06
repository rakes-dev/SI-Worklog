"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Building2, ChevronLeft, Hammer, Loader2, MapPin, Paintbrush, Plus } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { useAuthStore } from "@/store/useAuthStore";
import { describeError } from "@/services/db";
import { formatCurrency } from "@/utils/helpers";
import QuickCreateFormModal from "@/app/components/QuickCreateFormModal";
import ToastContainer from "@/components/ui/Toast";
import { useToast } from "@/hooks/useToast";

export default function CategoriesClient() {
    // The route folder is [id], so Next exposes the URL param as `id` — alias it
  // to siteId for readability.
  const { id: siteId } = useParams<{ id: string }>();
  const { sites, categories, forms, seedDefaults } = useAppStore();
  const { role } = useAuthStore();
  const { toasts, addToast, removeToast } = useToast();

  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [seeding, setSeeding] = useState(false);

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

  const site = sites.find((s) => s.id === siteId);
  const activeCategories = categories.filter((c) => c.isActive);
  const activeForms = forms.filter((f) => !f.isDeleted);

  const perCategory = useMemo(() => {
    return activeCategories
      .map((category) => {
        const catForms = activeForms.filter(
          (f) => f.siteId === siteId && f.categoryId === category.id,
        );
        return {
          category,
          count: catForms.length,
          amount: catForms.reduce((sum, f) => sum + (f.grandTotal || 0), 0),
        };
      })
      .sort((a, b) => a.category.order - b.category.order);
  }, [activeCategories, activeForms, siteId]);

  if (!site) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
        <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
          <Building2 size={28} className="text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold text-foreground mb-2">Site not found</h2>
        <p className="text-muted-foreground text-sm mb-5">
          This site may have been removed or the link is invalid.
        </p>
        <Link
          href="/"
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <ChevronLeft size={16} /> Back to Sites
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-full p-4 lg:p-6 xl:p-8 pb-[calc(6rem_+_env(safe-area-inset-bottom))] lg:pb-8 max-w-screen-2xl mx-auto">
      {/* Breadcrumb + header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Link href="/" className="hover:text-foreground transition-colors">
              Sites
            </Link>
            <span>/</span>
            <span className="text-foreground font-medium">{site.name}</span>
          </div>
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            <Building2 size={22} className="text-primary" />
            {site.name}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1">
            {site.address && (
              <>
                <MapPin size={12} />
                <span>{site.address}</span>
                <span>·</span>
              </>
            )}
            Choose a work category to view or create forms
          </p>
        </div>
        <button
          onClick={() => setShowQuickCreate(true)}
          title="Create a new form on this site"
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity scale-press"
        >
          <Plus size={16} />
          New Form
        </button>
      </div>

      {/* Empty structure state */}
      {perCategory.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center mb-6">
          <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
            <Paintbrush size={28} className="text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-foreground text-lg mb-1">No work categories yet</h3>
          <p className="text-muted-foreground text-sm max-w-sm mb-4">
            {role === "admin"
              ? "Push the structure blueprint to add the 7 work categories for this site."
              : "Ask an admin to push the structure blueprint (Admin → Sites & Categories)."}
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
      )}

      {/* Category cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {perCategory.map(({ category, count, amount }) => {
          const Icon = category.defaultFormType === "carpenter" ? Hammer : Paintbrush;
          return (
            <Link
              key={category.id}
              href={`/site/${site.id}/category/${category.id}`}
              className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3 hover:border-primary/50 hover:shadow-md transition-all duration-200 group"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h2 className="font-semibold text-foreground truncate">{category.name}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {category.defaultFormType === "carpenter" ? "Carpenter template" : "Painting template"}
                  </p>
                </div>
                <span
                  className={`shrink-0 p-2.5 rounded-lg ${
                    category.defaultFormType === "carpenter"
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                      : "bg-primary/10 text-primary"
                  }`}
                >
                  <Icon size={18} />
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
              <div className="flex items-center gap-1 text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                Open category
              </div>
            </Link>
          );
        })}
      </div>

      <QuickCreateFormModal
        open={showQuickCreate}
        onClose={() => setShowQuickCreate(false)}
        defaultSiteId={site.id}
      />
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}