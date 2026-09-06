"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Building2,
  ChevronLeft,
  Copy,
  Eye,
  FileText,
  Hammer,
  Loader2,
  Paintbrush,
  Plus,
  Printer,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { useAuthStore } from "@/store/useAuthStore";
import { currentMonth, formatCurrency, formatDate, monthLabel } from "@/utils/helpers";
import ConfirmModal from "@/components/ui/ConfirmModal";
import ToastContainer from "@/components/ui/Toast";
import { useToast } from "@/hooks/useToast";

export default function FormListClient() {
  // The route folders are [id] and [categoryId] — `id` is aliased to siteId.
  const { id: siteId, categoryId } = useParams<{
    id: string;
    categoryId: string;
  }>();
  const router = useRouter();
  const {
    sites,
    categories,
    forms,
    createForm,
    softDeleteForm,
    restoreForm,
    permanentlyDeleteForm,
    duplicateForm,
  } = useAppStore();
  const { user } = useAuthStore();
  const { toasts, addToast, removeToast } = useToast();

  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [permanentDeleteTarget, setPermanentDeleteTarget] = useState<string | null>(
    null,
  );
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth());

  const site = sites.find((s) => s.id === siteId);
  const category = categories.find((c) => c.id === categoryId);

  const activeForms = useMemo(
    () =>
      forms
        .filter(
          (f) =>
            !f.isDeleted &&
            f.siteId === siteId &&
            f.categoryId === categoryId &&
            f.month === selectedMonth,
        )
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
    [forms, siteId, categoryId, selectedMonth],
  );

  const deletedForms = useMemo(
    () => forms.filter((f) => f.isDeleted && f.siteId === siteId && f.categoryId === categoryId && f.month === selectedMonth),
    [forms, siteId, categoryId, selectedMonth],
  );

  // All distinct months that have forms for this site+category (for the month selector)
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    forms.forEach((f) => {
      if (f.siteId === siteId && f.categoryId === categoryId && f.month) {
        months.add(f.month);
      }
    });
    return Array.from(months).sort().reverse(); // newest first
  }, [forms, siteId, categoryId]);

  const displayForms = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return activeForms;
    return activeForms.filter(
      (f) =>
        f.formName.toLowerCase().includes(q) ||
        (f.suitPublicAreaName || "").toLowerCase().includes(q),
    );
  }, [activeForms, search]);

  const handleNewForm = async () => {
    if (!site || !category || !user?.email) return;
    setCreating(true);
    try {
      const empName = user.displayName || user.email;
      const form = await createForm({
        site,
        category,
        ownerEmail: user.email.trim().toLowerCase(),
        empName,
      });
      addToast("success", "Form created", `"${form.formName}" is ready.`);
      router.push(`/form-editor?formId=${form.id}`);
    } catch (error) {
      console.error("Create form failed:", error);
      addToast("error", "Create failed", "Could not create the form. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      const copy = await duplicateForm(id);
      if (copy) {
        addToast("success", "Form duplicated", `"${copy.formName}" created.`);
      }
    } catch (error) {
      console.error("Duplicate form failed:", error);
      addToast("error", "Duplicate failed", "Could not duplicate the form.");
    }
  };

  const handleSoftDelete = async () => {
    if (!deleteTarget) return;
    try {
      await softDeleteForm(deleteTarget);
      addToast("success", "Form moved to trash", "It can be restored anytime.");
    } catch (error) {
      console.error("Delete form failed:", error);
      addToast("error", "Delete failed", "Could not delete the form.");
    }
    setDeleteTarget(null);
  };

  const handlePermanentDelete = async () => {
    if (!permanentDeleteTarget) return;
    try {
      await permanentlyDeleteForm(permanentDeleteTarget);
      addToast("success", "Form permanently deleted", "");
    } catch (error) {
      console.error("Permanent delete failed:", error);
      addToast("error", "Delete failed", "Could not delete the form.");
    }
    setPermanentDeleteTarget(null);
  };

  const handleRestore = async (id: string) => {
    try {
      await restoreForm(id);
      addToast("success", "Form restored", "");
    } catch (error) {
      console.error("Restore form failed:", error);
      addToast("error", "Restore failed", "Could not restorethe form.");
    }
  };
if (!site || !category) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
        <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
          <FileText size={28} className="text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold text-foreground mb-2">Category not found</h2>
        <p className="text-muted-foreground text-sm mb-5">
          This site/category may have been removed or the link is invalid.
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

  const Icon = category.defaultFormType === "carpenter" ? Hammer : Paintbrush;

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
            <Link
              href={`/site/${site.id}`}
              className="hover:text-foreground transition-colors"
            >
              {site.name}
            </Link>
            <span>/</span>
            <span className="text-foreground font-medium">{category.name}</span>
          </div>
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            <Icon
              size={22}
              className={category.defaultFormType === "carpenter" ? "text-amber-500" : "text-primary"}
            />
            {category.name}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {site.name} · {user?.displayName || user?.email} · {activeForms.length} form·
            {activeForms.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={handleNewForm}
          disabled={creating}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity scale-press disabled:opacity-60"
        >
          {creating ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Plus size={16} />
          )}
          {creating ? "Creating..." : "New Form"}
        </button>
      </div>

      {/* Month selector */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">Month:</label>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-1.5 rounded-md border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring transition"
          >
            {availableMonths.length === 0 && (
              <option value={selectedMonth}>{monthLabel(selectedMonth)}</option>
            )}
            {availableMonths.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </select>
        </div>
        {selectedMonth !== currentMonth() && (
          <button
            onClick={() => setSelectedMonth(currentMonth())}
            className="text-sm text-primary hover:underline"
          >
            Back to current month
          </button>
        )}
        <Link
          href="/archive"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 ml-auto"
        >
          <span>📁</span> View Archive
        </Link>
      </div>

      {/* Search */}
      <div className="relative mb-5 max-w-md">
        <Search
          size={15}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search forms by name or suit area..."
          className="w-full pl-9 pr-4 py-2 rounded-md border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring transition"
        />
      </div>
{/* Forms list */}
      {displayForms.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
            <FileText size={28} className="text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-foreground text-lg mb-1">
            {search ? "No forms match your search" : "No forms yet"}
          </h3>
          <p className="text-muted-foreground text-sm max-w-sm">
            {search
              ? "Try adjusting your search."
              : "Create your first form here — the site and employee details are filled in automatically."}
          </p>
          {!search && (
            <button
              onClick={handleNewForm}
              disabled={creating}
              className="mt-4 flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity scale-press disabled:opacity-60"
            >
              {creating ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Plus size={16} />
              )}
              {creating ? "Creating..." : "Create First Form"}
            </button>
          )}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Form Name
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide hidden md:table-cell">
                    Suit / Area
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide hidden sm:table-cell">
                    Date
                  </th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Amount
                  </th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide w-36">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayForms.map((form) => (
                  <tr
                    key={form.id}
                    className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors"
                  >
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => router.push(`/form-editor?formId=${form.id}`)}
                        className="font-medium text-foreground hover:text-primary text-left"
                      >
                        {form.formName}
                      </button>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground truncate max-w-[200px] hidden md:table-cell">
                      {form.suitPublicAreaName || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground font-tabular text-xs hidden sm:table-cell">
                      {formatDate(form.date)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-tabular font-semibold text-foreground">
                      ₹{formatCurrency(form.grandTotal)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-0.5">
                        <button
                          onClick={() => router.push(`/form-editor?formId=${form.id}`)}
                          title="Open form"
                          className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={() => router.push(`/form-editor?formId=${form.id}&print=1`)}
                          title="Print form"
                          className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                        >
                          <Printer size={14} />
                        </button>
                        <button
                          onClick={() => handleDuplicate(form.id)}
                          title="Duplicate form"
                          className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                        >
                          <Copy size={14} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(form.id)}
                          title="Move to trash"
                          className="p-1.5 rounded text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
{/* Trash */}
      {deletedForms.length > 0 && (
        <div className="mt-10">
          <h2 className="text-lg font-semibold text-foreground mb-3">
            Trash ({deletedForms.length})
          </h2>
          <p className="text-xs text-muted-foreground mb-3 max-w-lg">
            These forms have been removed from your list. They are kept until you
            delete them permanently or restore them.
          </p>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/50">
                    <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Form Name
                    </th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Deleted At
                    </th>
                    <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide w-28">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {deletedForms.map((form) => (
                    <tr key={form.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2 text-muted-foreground truncate max-w-[220px]">
                        {form.formName}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground font-tabular text-xs">
                        {form.deletedAt ? formatDate(form.deletedAt) : "—"}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex items-center justify-end gap-0.5">
                          <button
                            onClick={() => handleRestore(form.id)}
                            title="Restore form"
                            className="p-1.5 rounded text-muted-foreground hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                          >
                            <RotateCcw size={14} />
                          </button>
                          <button
                            onClick={() => setPermanentDeleteTarget(form.id)}
                            title="Delete permanently"
                            className="p-1.5 rounded text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Mobile FAB */}
      <button
        onClick={handleNewForm}
        disabled={creating}
        className="fixed bottom-20 right-4 lg:hidden w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:opacity-90 transition-opacity scale-press z-20 no-print disabled:opacity-60"
        aria-label="Create new form"
      >
        {creating ? <Loader2 size={24} className="animate-spin" /> : <Plus size={24} />}
      </button>

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Form"
        message="Are you sure you want to delete this form? It will be moved to trash and can be restored anytime."
        confirmLabel="Move to Trash"
        onConfirm={handleSoftDelete}
        onCancel={() => setDeleteTarget(null)}
        destructive
      />

      <ConfirmModal
        open={!!permanentDeleteTarget}
        title="Permanently Delete Form"
        message="This removes the form permanently. This action cannot be undone."
        confirmLabel="Delete Permanently"
        onConfirm={handlePermanentDelete}
        onCancel={() => setPermanentDeleteTarget(null)}
        destructive
      />

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}